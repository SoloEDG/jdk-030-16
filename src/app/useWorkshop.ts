import { ref } from "vue";
import { useAtlas } from "@/features/atlas";
import { useGadget } from "@/features/gadget";
import { useHauler } from "@/features/hauler";
import { useLedger } from "@/features/ledger";
import { loadInitial, useVoyage } from "@/features/voyage";
import type { Notice } from "@/shared/commands";
import type { Dir } from "@/shared/types";

export function useWorkshop() {
  const document = ref(loadInitial());
  const notice = ref<Notice>({
    tone: "info",
    message: "把对得上的箱子压上踏板，门和地板会跟着变。",
  });
  const atlas = useAtlas(document);
  const hauler = useHauler(document);
  const gadget = useGadget(document);
  const ledger = useLedger(document);
  const voyage = useVoyage(document);

  function notify(next: Notice): void {
    notice.value = next;
  }

  function move(dir: Dir): void {
    const result = hauler.tryMove(dir);
    if (!result.moved) {
      if (result.reason === "cleared") {
        notify({ tone: "warn", message: "本关已通关。重置或另选关卡后再推。" });
      } else if (result.reason === "pin") {
        notify({ tone: "warn", message: "力落在固定插销或其力线通过插销，长箱没有转动。" });
      } else if (result.reason === "transmission") {
        notify({ tone: "warn", message: "同一角度的两组传动不能同时成立，已在接触处停止，未计步。" });
      } else if (result.preview && !result.preview.completed) {
        const degree = Math.round((result.preview.blockTravel * 180) / Math.PI);
        const edge = result.preview.contacts[0]?.edgeId;
        notify({
          tone: "warn",
          message: `扫掠在行程 ${degree}° 处先碰到${edge ? `边 ${edge}` : "障碍"}；未走满四分之一圈，因此不计步。`,
        });
      }
      return;
    }
    gadget.refresh();
    const tick = ledger.afterMove(result);
    if (tick.cleared) {
      voyage.commitClear();
      notify({
        tone: "success",
        message: `通关，用了 ${document.value.attempt.steps} 步。最佳记录已写入目录。`,
      });
    }
  }

  function reset(): void {
    hauler.resetPreview();
    voyage.resetLevel();
    notify({ tone: "info", message: "已重置本关，插销与长箱的相对位置已还原。最佳记录仍在。" });
  }

  function selectLevel(id: string): void {
    hauler.resetPreview();
    voyage.openLevel(id);
    notify({
      tone: "info",
      message: `进入「${document.value.level.title}」。${document.value.level.blurb}`,
    });
  }

  return { document, notice, atlas, hauler, gadget, ledger, voyage, move, reset, selectLevel };
}
