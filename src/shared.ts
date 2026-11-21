import OBR from "@owlbear-rodeo/sdk";

export const ID = "com.cutscenes-player";
export const LIBRARY_KEY = `${ID}/library`;
export const CURRENT_KEY = `${ID}/current`;
export const MODAL_ID = `${ID}/modal`;

/** Tempo entre o GM clicar e o vídeo começar, para todos carregarem. */
export const LEAD_MS = 2500;

/** cover = preenche a tela (corta bordas); contain = mostra o vídeo inteiro (pode ter faixas pretas) */
export type Fit = "cover" | "contain";

export interface Cutscene {
  id: string;
  title: string;
  url: string;
  fit?: Fit;
}

/** O que está tocando agora. Fica no metadata da sala (sincronizado para todos). */
export interface CurrentPlayback {
  playId: string;
  title: string;
  url: string;
  fit: Fit;
  /** Timestamp (ms) em que o vídeo deve começar. */
  startAt: number;
}

export type Source =
  | { kind: "youtube"; videoId: string; start: number }
  | { kind: "file"; url: string };

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Converte "90", "1m30s", "1h2m3s" em segundos. */
function parseTime(t: string | null): number {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function parseSource(raw: string): Source | null {
  const text = raw.trim();
  if (!text) return null;

  // Caminho relativo (ex.: /cutscenes/intro.mp4) = arquivo hospedado junto da extensão
  if (text.startsWith("/")) return { kind: "file", url: text };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  const start = parseTime(url.searchParams.get("t") ?? url.searchParams.get("start"));

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? { kind: "youtube", videoId: id, start } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v) return { kind: "youtube", videoId: v, start };
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    if (m) return { kind: "youtube", videoId: m[1], start };
    return null;
  }

  return { kind: "file", url: url.toString() };
}

export async function getLibrary(): Promise<Cutscene[]> {
  const meta = await OBR.room.getMetadata();
  return (meta[LIBRARY_KEY] as Cutscene[] | undefined) ?? [];
}

export async function setLibrary(list: Cutscene[]) {
  await OBR.room.setMetadata({ [LIBRARY_KEY]: list });
}

export function readCurrent(meta: Record<string, unknown>): CurrentPlayback | null {
  const cur = meta[CURRENT_KEY] as CurrentPlayback | null | undefined;
  return cur && cur.playId ? cur : null;
}

export async function playCutscene(c: Cutscene) {
  const current: CurrentPlayback = {
    playId: uid(),
    title: c.title,
    url: c.url,
    fit: c.fit ?? "cover",
    startAt: Date.now() + LEAD_MS,
  };
  await OBR.room.setMetadata({ [CURRENT_KEY]: current });
}

export async function stopCutscene() {
  await OBR.room.setMetadata({ [CURRENT_KEY]: null });
}