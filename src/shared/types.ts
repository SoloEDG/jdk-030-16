export type Dir = "n" | "e" | "s" | "w";
export type TileKind = "wall" | "floor" | "goal" | "gap";
export type BoxKind = "timber" | "iron" | "glass" | "rack";
export type FloorMorph = "bridge" | "seal";
export type AttemptStatus = "playing" | "cleared";

export interface Vec {
  x: number;
  y: number;
}

export interface Pin {
  id: string;
  x: number;
  y: number;
  fixed?: boolean;
}

export interface GearLink {
  id?: string;
  a: string;
  b: string;
  /** Signed Δangle(b)/Δangle(a). External gears normally negative. */
  ratio?: number;
  teethA?: number;
  teethB?: number;
  /** Driver travel at which this contact engages, in radians. Zero means meshed now. */
  engageTravel?: number;
  /** External tooth contact reverses direction (default true). */
  external?: boolean;
}

export interface Box {
  id: string;
  kind: BoxKind;
  x: number;
  y: number;
  shape?: "crate" | "beam";
  pinId?: string;
  /** Optional cell-coordinate pivot when no explicit pin record is supplied. */
  pivot?: Vec;
  angle?: number;
  length?: number;
  width?: number;
  teeth?: number;
  gearRadius?: number;
}

export interface Plate {
  id: string;
  x: number;
  y: number;
  accept: BoxKind;
  doorIds: string[];
  floorIds: string[];
  powered: boolean;
}

export interface Door {
  id: string;
  x: number;
  y: number;
  open: boolean;
}

export interface FloorPatch {
  id: string;
  x: number;
  y: number;
  morph: FloorMorph;
  active: boolean;
}

export interface RuntimeLevel {
  id: string;
  title: string;
  blurb: string;
  width: number;
  height: number;
  tiles: TileKind[][];
  player: Vec;
  boxes: Box[];
  plates: Plate[];
  doors: Door[];
  floors: FloorPatch[];
  pins?: Pin[];
  links?: GearLink[];
}

export interface Attempt {
  steps: number;
  status: AttemptStatus;
}

export interface LevelRecord {
  bestSteps: number;
  clearedAt: number;
}

export interface GameDocument {
  version: 1;
  currentLevelId: string;
  level: RuntimeLevel;
  attempt: Attempt;
  records: Record<string, LevelRecord>;
  preview?: SwingPreview | null;
}

export interface CollisionHit {
  id: string;
  travel: number;
  point: Vec;
  edge?: { a: Vec; b: Vec };
  edgeId?: string;
  edgeIndex?: number;
  actorEdgeId?: string;
  actorEdgeIndex?: number;
  obstacleEdgeId?: string;
  obstacleEdgeIndex?: number;
  actorId?: string;
  obstacleId?: string;
  obstacleKind?: "wall" | "door" | "crate" | "beam" | "pin" | "boundary" | "transmission" | "gap" | "floor";
  message?: string;
}

export interface SwingPose {
  id: string;
  angle: number;
  polygon: Vec[];
}

export interface SwingPreview {
  kind: "swing";
  driverId: string;
  dir?: Dir;
  /** +1 is visually clockwise in screen coordinates, -1 counter-clockwise. */
  handedness: 1 | -1;
  targetTravel: number;
  /** First blocking travel; equals targetTravel when the full sweep is clear. */
  blockTravel: number;
  /** Greatest known clear travel immediately before blockTravel. */
  reachableTravel?: number;
  /** Driver's absolute angle at blockTravel. */
  blockAngle: number;
  completed: boolean;
  committed?: boolean;
  affectedIds: string[];
  contacts: CollisionHit[];
  poses: SwingPose[];
  arc?: { pivot: Vec; radius: number; fromAngle: number; toAngle: number };
  reason?: "blocked" | "pin-force" | "transmission-conflict" | "cleared";
}

export interface MoveResult {
  moved: boolean;
  pushed: boolean;
  boxId?: string;
  reason?: "blocked" | "cleared" | "idle" | "pin" | "transmission";
  preview?: SwingPreview | null;
}

export const BOX_LABEL: Record<BoxKind, string> = {
  timber: "木箱",
  iron: "铁箱",
  glass: "玻璃箱",
  rack: "齿圈长箱",
};

export const DIR_VEC: Record<Dir, Vec> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};
