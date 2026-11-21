import OBR, { Metadata } from "@owlbear-rodeo/sdk";
import { MODAL_ID, readCurrent } from "./shared";

/** Cutscenes mais velhas que isso são ignoradas por quem entra atrasado. */
const MAX_AGE_MS = 30 * 60 * 1000;

OBR.onReady(async () => {
  let openPlayId: string | null = null;

  const handle = async (meta: Metadata) => {
    const cur = readCurrent(meta);

    if (cur && cur.playId !== openPlayId) {
      if (Date.now() - cur.startAt > MAX_AGE_MS) return;
      openPlayId = cur.playId;
      await OBR.modal.close(MODAL_ID).catch(() => {});
      await OBR.modal.open({
        id: MODAL_ID,
        url: `/player.html?play=${encodeURIComponent(cur.playId)}`,
        fullScreen: true,
        hideBackdrop: true,
        hidePaper: true,
      });
    } else if (!cur && openPlayId) {
      openPlayId = null;
      await OBR.modal.close(MODAL_ID).catch(() => {});
    }
  };

  await handle(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(handle);
});
