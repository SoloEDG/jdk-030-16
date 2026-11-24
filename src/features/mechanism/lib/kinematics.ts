import type {
  CollisionHit,
  GearLink,
  SwingPose,
  SwingPreview,
  Vec,
} from "@/shared/types";
import {
  ANGLE_EPS,
  CONTACT_EPS,
  SWEEP_ANGLE,
  edgeSegment,
  polygonDistance,
  satPenetration,
} from "./geometry";
import type { CollisionShape } from "./shapes";

const PROBE_ANGLE = 1e-6;
const ROOT_EPS = 1e-10;
const GRAPH_EPS = 1e-5;
const EVENT_EPS = 1e-5;

export interface BodySpec {
  id: string;
  pivot: Vec;
  baseAngle: number;
  radius: number;
  teeth?: number;
  gearRadius?: number;
  shapeAt: (angle: number) => CollisionShape;
}

export interface PlanRotationOptions {
  driverId: string;
  handedness: 1 | -1;
  targetTravel?: number;
  bodies: BodySpec[];
  staticShapes: CollisionShape[];
  links?: GearLink[];
  dir?: SwingPreview["dir"];
  enableDynamicMesh?: boolean;
}

interface Phase {
  start: number;
  base: Record<string, number>;
  coeff: Record<string, number>;
  links: GearLink[];
}

interface EvaluatedPair {
  key: string;
  bodyA: BodySpec;
  bodyB?: BodySpec;
  shapeA: CollisionShape;
  shapeB: CollisionShape;
  polyA: Vec[];
  polyB: Vec[];
  kA: number;
  kB: number;
}

interface Impact {
  travel: number;
  reachableTravel: number;
  hits: CollisionHit[];
  pairs: EvaluatedPair[];
}

function signedLinkRatio(link: GearLink): number {
  if (link.ratio !== undefined) {
    const ratio = link.ratio;
    return link.external === false ? ratio : -Math.abs(ratio);
  }
  const a = link.teethA ?? 1;
  const b = link.teethB ?? 1;
  const ratio = a / b;
  return link.external === false ? ratio : -ratio;
}

function solveGraph(
  driverId: string,
  driverCoefficient: number,
  links: GearLink[],
): { coeff?: Record<string, number>; conflict?: GearLink[] } {
  const coeff: Record<string, number> = { [driverId]: driverCoefficient };
  const adjacency = new Map<string, Array<{ to: string; factor: number; link: GearLink }>>();
  const add = (from: string, to: string, factor: number, link: GearLink) => {
    const list = adjacency.get(from) ?? [];
    list.push({ to, factor, link });
    adjacency.set(from, list);
  };

  for (const link of links) {
    const ab = signedLinkRatio(link);
    if (!Number.isFinite(ab) || Math.abs(ab) < GRAPH_EPS) return { conflict: [link] };
    add(link.a, link.b, ab, link);
    add(link.b, link.a, 1 / ab, link);
  }

  const queue = [driverId];
  const conflicts: GearLink[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const current = coeff[id];
    for (const edge of adjacency.get(id) ?? []) {
      const expected = current * edge.factor;
      if (coeff[edge.to] === undefined) {
        coeff[edge.to] = expected;
        queue.push(edge.to);
      } else if (Math.abs(coeff[edge.to] - expected) > GRAPH_EPS) {
        conflicts.push(edge.link);
      }
    }
  }
  const uniqueConflicts = Array.from(
    new Map(conflicts.map((link) => [link.id ?? `${link.a}-${link.b}`, link])).values(),
  );
  return uniqueConflicts.length ? { conflict: uniqueConflicts } : { coeff };
}

function angleAtPhase(body: BodySpec, travel: number, phase: Phase): number {
  return (
    (phase.base[body.id] ?? body.baseAngle) +
    (phase.coeff[body.id] ?? 0) * (travel - phase.start)
  );
}

function evaluatePairs(
  bodies: BodySpec[],
  staticShapes: CollisionShape[],
  travel: number,
  phase: Phase,
): EvaluatedPair[] {
  const pairs: EvaluatedPair[] = [];
  const angleOf = (body: BodySpec) => angleAtPhase(body, travel, phase);

  for (const body of bodies) {
    const shapeA = body.shapeAt(angleOf(body));
    for (const staticShape of staticShapes) {
      pairs.push({
        key: `${body.id}->${staticShape.id}`,
        bodyA: body,
        shapeA,
        shapeB: staticShape,
        polyA: shapeA.polygon,
        polyB: staticShape.polygon,
        kA: phase.coeff[body.id] ?? 0,
        kB: 0,
      });
    }
  }

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i];
      const b = bodies[j];
      const shapeA = a.shapeAt(angleOf(a));
      const shapeB = b.shapeAt(angleOf(b));
      pairs.push({
        key: `${a.id}<>${b.id}`,
        bodyA: a,
        bodyB: b,
        shapeA,
        shapeB,
        polyA: shapeA.polygon,
        polyB: shapeB.polygon,
        kA: phase.coeff[a.id] ?? 0,
        kB: phase.coeff[b.id] ?? 0,
      });
    }
  }
  return pairs;
}

function hitFromPair(pair: EvaluatedPair, travel: number, index: number): CollisionHit {
  const distance = polygonDistance(pair.polyA, pair.polyB);
  const obstacleEdgeIndex = distance.edgeB;
  const actorEdgeIndex = distance.edgeA;
  const obstacleEdgeId =
    obstacleEdgeIndex !== undefined ? pair.shapeB.edgeIds[obstacleEdgeIndex] : undefined;
  const actorEdgeId =
    actorEdgeIndex !== undefined ? pair.shapeA.edgeIds[actorEdgeIndex] : undefined;
  const useObstacleEdge = obstacleEdgeIndex !== undefined;
  const edgeIndex = useObstacleEdge ? obstacleEdgeIndex : actorEdgeIndex;
  const polygon = useObstacleEdge ? pair.polyB : pair.polyA;
  const edge = edgeIndex !== undefined ? edgeSegment(polygon, edgeIndex) : undefined;
  const edgeId = obstacleEdgeId ?? actorEdgeId ?? pair.shapeB.edgeIds[0] ?? pair.shapeB.id;
  const point = useObstacleEdge ? distance.pointB : distance.pointA;
  return {
    id: `hit-${travel.toFixed(8)}-${index}-${pair.key}`,
    travel,
    point,
    edge,
    edgeId,
    edgeIndex,
    actorEdgeId,
    actorEdgeIndex,
    obstacleEdgeId,
    obstacleEdgeIndex,
    actorId: pair.bodyA.id,
    obstacleId: pair.shapeB.boxId ?? pair.shapeB.id,
    obstacleKind: pair.shapeB.kind,
  };
}

function collectImpact(
  bodies: BodySpec[],
  staticShapes: CollisionShape[],
  travel: number,
  phase: Phase,
  target: number,
): Impact | null {
  const pairs = evaluatePairs(bodies, staticShapes, travel, phase);
  const probeTravel = Math.min(target, travel + PROBE_ANGLE);
  const probePairs =
    probeTravel > travel + ROOT_EPS
      ? evaluatePairs(bodies, staticShapes, probeTravel, phase)
      : pairs;
  const blocking: EvaluatedPair[] = [];

  for (let i = 0; i < pairs.length; i += 1) {
    const pair = pairs[i];
    const probe = probePairs[i];
    const penetrationNow = satPenetration(pair.polyA, pair.polyB);
    const penetrationSoon = satPenetration(probe.polyA, probe.polyB);
    const distance = polygonDistance(pair.polyA, pair.polyB).distance;
    const touching = penetrationNow > 0 || distance <= CONTACT_EPS * 5;
    if (!touching) continue;
    if (penetrationNow > 0 || penetrationSoon > 0) blocking.push(pair);
  }

  if (!blocking.length) return null;
  return {
    travel,
    reachableTravel: travel,
    pairs: blocking,
    hits: blocking.map((pair, index) => hitFromPair(pair, travel, index)),
  };
}

function findImpact(
  target: number,
  phase: Phase,
  bodies: BodySpec[],
  staticShapes: CollisionShape[],
): Impact | null {
  let t = phase.start;

  for (let guard = 0; guard < 1600; guard += 1) {
    const pairs = evaluatePairs(bodies, staticShapes, t, phase);
    const initialPenetration = pairs.some((pair) => satPenetration(pair.polyA, pair.polyB) > 0);

    if (initialPenetration) {
      if (t <= phase.start + ANGLE_EPS * 100) {
        return collectImpact(bodies, staticShapes, phase.start, phase, target);
      }
      let low = phase.start;
      let high = t;
      for (let i = 0; i < 52; i += 1) {
        const mid = (low + high) / 2;
        const midPairs = evaluatePairs(bodies, staticShapes, mid, phase);
        if (midPairs.some((pair) => satPenetration(pair.polyA, pair.polyB) > 0)) high = mid;
        else low = mid;
      }
      const rootImpact = collectImpact(bodies, staticShapes, (low + high) / 2, phase, target);
      if (rootImpact) rootImpact.reachableTravel = low;
      return rootImpact;
    }

    if (target - t <= ANGLE_EPS) {
      return collectImpact(bodies, staticShapes, target, phase, target);
    }

    let step = Number.POSITIVE_INFINITY;
    for (const pair of pairs) {
      const info = polygonDistance(pair.polyA, pair.polyB);
      if (info.distance <= CONTACT_EPS * 5) continue;
      const speed =
        pair.bodyA.radius * Math.abs(pair.kA) +
        (pair.bodyB?.radius ?? 0) * Math.abs(pair.kB);
      if (speed <= ANGLE_EPS) continue;
      const safeDistance = Math.max(0, info.distance - CONTACT_EPS * 8);
      step = Math.min(step, safeDistance / speed);
    }

    let next: number;
    if (Number.isFinite(step) && step > ANGLE_EPS) {
      next = Math.min(target, t + step * 0.999);
    } else {
      const impact = collectImpact(bodies, staticShapes, t, phase, target);
      if (impact) return impact;
      next = Math.min(target, t + PROBE_ANGLE);
    }

    if (next <= t + ROOT_EPS) next = Math.min(target, t + ANGLE_EPS);
    if (next <= t + ROOT_EPS) {
      return collectImpact(bodies, staticShapes, t, phase, target);
    }

    const nextPairs = evaluatePairs(bodies, staticShapes, next, phase);
    if (nextPairs.some((pair) => satPenetration(pair.polyA, pair.polyB) > 0)) {
      let low = t;
      let high = next;
      for (let i = 0; i < 56; i += 1) {
        const mid = (low + high) / 2;
        const midPairs = evaluatePairs(bodies, staticShapes, mid, phase);
        if (midPairs.some((pair) => satPenetration(pair.polyA, pair.polyB) > 0)) high = mid;
        else low = mid;
      }
      const root = (low + high) / 2;
      const rootImpact = collectImpact(bodies, staticShapes, root, phase, target);
      if (rootImpact) rootImpact.reachableTravel = low;
      return rootImpact;
    }

    t = next;
  }

  return collectImpact(bodies, staticShapes, t, phase, target);
}

function posesAt(travel: number, phases: Phase[], bodies: BodySpec[], _target: number): SwingPose[] {
  const eligible = phases.filter((item) => item.start <= travel + ANGLE_EPS);
  const phase = eligible[eligible.length - 1] ?? phases[phases.length - 1];
  return bodies.map((body) => {
    const angle = angleAtPhase(body, travel, phase);
    return { id: body.id, angle, polygon: body.shapeAt(angle).polygon };
  });
}

function compatibleMesh(a: BodySpec, b: BodySpec): GearLink | null {
  if (!a.teeth || !b.teeth) return null;
  const ra = a.gearRadius ?? a.teeth / 16;
  const rb = b.gearRadius ?? b.teeth / 16;
  const distance = Math.hypot(a.pivot.x - b.pivot.x, a.pivot.y - b.pivot.y);
  if (Math.abs(distance - (ra + rb)) > 0.08) return null;
  const moduleA = (2 * ra) / a.teeth;
  const moduleB = (2 * rb) / b.teeth;
  if (Math.abs(moduleA - moduleB) > 0.025) return null;
  return {
    id: `mesh-${a.id}-${b.id}`,
    a: a.id,
    b: b.id,
    teethA: a.teeth,
    teethB: b.teeth,
    ratio: -a.teeth / b.teeth,
  };
}

function conflictPreview(
  options: PlanRotationOptions,
  travel: number,
  phases: Phase[],
  conflicts: GearLink[],
): SwingPreview {
  const driver = options.bodies.find((body) => body.id === options.driverId)!;
  const phase = phases[phases.length - 1];
  const target = options.targetTravel ?? SWEEP_ANGLE;
  const contacts: CollisionHit[] = conflicts.map((link, index) => ({
    id: `transmission-${index}-${link.id ?? `${link.a}-${link.b}`}`,
    travel,
    point: driver.pivot,
    actorId: link.a,
    obstacleId: link.b,
    obstacleKind: "transmission",
    edgeId: link.id ?? `${link.a}:${link.b}`,
    message: "同一角度的两组传动比不一致",
  }));
  return {
    kind: "swing",
    driverId: options.driverId,
    dir: options.dir,
    handedness: options.handedness,
    targetTravel: target,
    blockTravel: travel,
    reachableTravel: travel,
    blockAngle: driver.baseAngle + options.handedness * travel,
    completed: false,
    affectedIds: Object.keys(phase?.coeff ?? { [options.driverId]: options.handedness }),
    contacts,
    poses: posesAt(travel, phases, options.bodies, target),
    reason: "transmission-conflict",
  };
}

function blockedPreview(
  options: PlanRotationOptions,
  travel: number,
  phases: Phase[],
  phase: Phase,
  impact: Impact,
): SwingPreview {
  const target = options.targetTravel ?? SWEEP_ANGLE;
  const driver = options.bodies.find((body) => body.id === options.driverId)!;
  return {
    kind: "swing",
    driverId: options.driverId,
    dir: options.dir,
    handedness: options.handedness,
    targetTravel: target,
    blockTravel: travel,
    reachableTravel: impact.reachableTravel ?? Math.max(phase.start, travel - PROBE_ANGLE),
    blockAngle: driver.baseAngle + options.handedness * travel,
    completed: false,
    affectedIds: Object.keys(phase.coeff),
    contacts: impact.hits,
    poses: posesAt(travel, phases, options.bodies, target),
    arc: {
      pivot: driver.pivot,
      radius: driver.radius,
      fromAngle: driver.baseAngle,
      toAngle: driver.baseAngle + options.handedness * travel,
    },
    reason: "blocked",
  };
}

export function planRotation(options: PlanRotationOptions): SwingPreview {
  const target = options.targetTravel ?? SWEEP_ANGLE;
  const driver = options.bodies.find((body) => body.id === options.driverId);
  if (!driver) throw new Error(`找不到施力长箱 ${options.driverId}`);

  const initialBase = Object.fromEntries(options.bodies.map((body) => [body.id, body.baseAngle]));
  const allLinks = [...(options.links ?? [])];
  const activeLinks = allLinks.filter((link) => (link.engageTravel ?? 0) <= ANGLE_EPS * 100);
  const initialGraph = solveGraph(options.driverId, options.handedness, activeLinks);
  const firstPhase: Phase = {
    start: 0,
    base: initialBase,
    coeff: initialGraph.coeff ?? { [options.driverId]: options.handedness },
    links: activeLinks,
  };
  const phases: Phase[] = [firstPhase];

  if (initialGraph.conflict) {
    return conflictPreview(options, 0, phases, initialGraph.conflict);
  }

  let phase = firstPhase;
  const dynamicPairs = new Set<string>();

  for (let outer = 0; outer < 100; outer += 1) {
    const scheduledEvents = Array.from(
      new Set(
        allLinks
          .map((link) => link.engageTravel ?? 0)
          .filter((travel) => travel > phase.start + ANGLE_EPS && travel < target - ANGLE_EPS),
      ),
    ).sort((a, b) => a - b);
    const nextEvent = scheduledEvents[0];
    const limit = nextEvent === undefined ? target : Math.min(target, nextEvent);
    const impact = findImpact(limit, phase, options.bodies, options.staticShapes);

    if (impact) {
      const atScheduledEvent =
        nextEvent !== undefined && Math.abs(impact.travel - nextEvent) <= EVENT_EPS;

      if (atScheduledEvent) {
        const eventTravel = nextEvent;
        const eventLinks = allLinks.filter(
          (link) => Math.abs((link.engageTravel ?? 0) - eventTravel) <= EVENT_EPS,
        );
        const nextBase = Object.fromEntries(
          options.bodies.map((body) => [body.id, angleAtPhase(body, eventTravel, phase)]),
        );
        const links = Array.from(
          new Map([...phase.links, ...eventLinks].map((link) => [link.id ?? `${link.a}-${link.b}`, link])).values(),
        );
        const graph = solveGraph(options.driverId, options.handedness, links);
        if (graph.conflict) {
          phase = { start: eventTravel, base: nextBase, coeff: {}, links };
          phases.push(phase);
          return conflictPreview(options, eventTravel, phases, graph.conflict);
        }
        phase = { start: eventTravel, base: nextBase, coeff: graph.coeff!, links };
        phases.push(phase);
        continue;
      }

      // A beam-beam impact may be a gear engagement. Collect every contact at
      // this angle and add all constraints before re-checking the trajectory.
      const meshLinks: GearLink[] = [];
      if (options.enableDynamicMesh !== false && impact.travel < target - ANGLE_EPS) {
        for (const hitPair of impact.pairs) {
          if (!hitPair.bodyB) continue;
          const key = [hitPair.bodyA.id, hitPair.bodyB.id].sort().join("<>");
          if (dynamicPairs.has(key)) continue;
          const mesh = compatibleMesh(hitPair.bodyA, hitPair.bodyB);
          if (mesh) {
            mesh.engageTravel = impact.travel;
            meshLinks.push(mesh);
            dynamicPairs.add(key);
          }
        }
      }

      if (meshLinks.length) {
        const eventTravel = impact.travel;
        const nextBase = Object.fromEntries(
          options.bodies.map((body) => [body.id, angleAtPhase(body, eventTravel, phase)]),
        );
        const links = [...phase.links, ...meshLinks];
        const graph = solveGraph(options.driverId, options.handedness, links);
        if (graph.conflict) {
          phase = { start: eventTravel, base: nextBase, coeff: {}, links };
          phases.push(phase);
          return conflictPreview(options, eventTravel, phases, graph.conflict);
        }
        phase = { start: eventTravel, base: nextBase, coeff: graph.coeff!, links };
        phases.push(phase);
        continue;
      }

      return blockedPreview(options, impact.travel, phases, phase, impact);
    }

    if (nextEvent !== undefined) {
      const eventTravel = nextEvent;
      const eventLinks = allLinks.filter(
        (link) => Math.abs((link.engageTravel ?? 0) - eventTravel) <= EVENT_EPS,
      );
      const nextBase = Object.fromEntries(
        options.bodies.map((body) => [body.id, angleAtPhase(body, eventTravel, phase)]),
      );
      const links = Array.from(
        new Map([...phase.links, ...eventLinks].map((link) => [link.id ?? `${link.a}-${link.b}`, link])).values(),
      );
      const graph = solveGraph(options.driverId, options.handedness, links);
      if (graph.conflict) {
        phase = { start: eventTravel, base: nextBase, coeff: {}, links };
        phases.push(phase);
        return conflictPreview(options, eventTravel, phases, graph.conflict);
      }
      phase = { start: eventTravel, base: nextBase, coeff: graph.coeff!, links };
      phases.push(phase);
      continue;
    }

    break;
  }

  return {
    kind: "swing",
    driverId: options.driverId,
    dir: options.dir,
    handedness: options.handedness,
    targetTravel: target,
    blockTravel: target,
    reachableTravel: target,
    blockAngle: driver.baseAngle + options.handedness * target,
    completed: true,
    affectedIds: Object.keys(phase.coeff),
    contacts: [],
    poses: posesAt(target, phases, options.bodies, target),
    arc: {
      pivot: driver.pivot,
      radius: driver.radius,
      fromAngle: driver.baseAngle,
      toAngle: driver.baseAngle + options.handedness * target,
    },
  };
}
