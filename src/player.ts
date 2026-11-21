import OBR from "@owlbear-rodeo/sdk";
import "./player.css";
import {
  CURRENT_KEY,
  CurrentPlayback,
  Fit,
  MODAL_ID,
  Source,
  parseSource,
  readCurrent,
  stopCutscene,
} from "./shared";

/* ---------- Interface comum para YouTube e arquivo ---------- */

interface Engine {
  /** Tenta tocar com som a partir de `from` segundos. Retorna true se tocou com som, false se teve de tocar mudo. */
  play(from: number): Promise<boolean>;
  unmute(): void;
  seek(seconds: number): void;
  currentTime(): number;
  duration(): number;
  onEnded(cb: () => void): void;
}

const stage = document.getElementById("stage")!;
const shield = document.getElementById("shield")!;
const unmuteBtn = document.getElementById("unmute") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;
const msg = document.getElementById("msg")!;

const wait = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

function showMessage(text: string) {
  msg.textContent = text;
  msg.hidden = false;
}

/* ---------- Arquivo (mp4/webm) ---------- */

async function createFileEngine(url: string, fit: Fit): Promise<Engine> {
  const video = document.createElement("video");
  video.playsInline = true;
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.controls = false;
  video.disablePictureInPicture = true;
  video.src = url;
  video.style.objectFit = fit;
  stage.appendChild(video);
  shield.hidden = true; // o <video> não tem UI própria

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Não foi possível carregar o vídeo.")), {
      once: true,
    });
  });

  return {
    async play(from) {
      video.currentTime = from;
      video.muted = false;
      try {
        await video.play();
        return true;
      } catch (e) {
        if ((e as DOMException).name !== "NotAllowedError") throw e;
        video.muted = true;
        await video.play();
        return false;
      }
    },
    unmute() {
      video.muted = false;
      video.play().catch(() => {});
    },
    seek: (s) => (video.currentTime = s),
    currentTime: () => video.currentTime,
    duration: () => video.duration || Infinity,
    onEnded: (cb) => video.addEventListener("ended", cb),
  };
}

/* ---------- YouTube (IFrame Player API) ---------- */

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
}

/**
 * O iframe do YouTube não tem object-fit. Para "preencher", aumentamos o iframe
 * até cobrir a tela mantendo 16:9 e centralizamos (o excesso fica fora da tela).
 */
function layoutYouTube(frame: HTMLElement, fit: Fit) {
  const ratio = 16 / 9;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let fw = w;
  let fh = h;
  if (fit === "cover") {
    if (w / h > ratio) fh = w / ratio;
    else fw = h * ratio;
  }
  Object.assign(frame.style, {
    inset: "auto",
    width: `${fw}px`,
    height: `${fh}px`,
    left: `${(w - fw) / 2}px`,
    top: `${(h - fh) / 2}px`,
  });
}

async function createYouTubeEngine(videoId: string, offset: number, fit: Fit): Promise<Engine> {
  const YT = await loadYouTubeApi();
  const host = document.createElement("div");
  stage.appendChild(host);

  let endedCb: (() => void) | null = null;
  let blocked = false;

  const player: any = await new Promise((resolve, reject) => {
    const p = new YT.Player(host, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: location.origin,
      },
      events: {
        onReady: () => resolve(p),
        onError: (e: any) => reject(new Error(`Erro do YouTube (${e.data}). O vídeo pode não permitir incorporação.`)),
        onAutoplayBlocked: () => (blocked = true),
        onStateChange: (e: any) => {
          if (e.data === YT.PlayerState.ENDED) endedCb?.();
        },
      },
    });
  });

  // Garante que o iframe do YouTube pode tocar com som (delegação de autoplay)
  const iframe = player.getIframe() as HTMLIFrameElement;
  iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
  iframe.classList.add("yt");
  const relayout = () => layoutYouTube(iframe, fit);
  relayout();
  window.addEventListener("resize", relayout);

  const isPlaying = () => player.getPlayerState() === YT.PlayerState.PLAYING;

  return {
    async play(from) {
      blocked = false;
      player.unMute();
      player.seekTo(from + offset, true);
      player.playVideo();
      // espera até ~2.5s o vídeo começar com som
      for (let i = 0; i < 25 && !isPlaying() && !blocked; i++) await wait(100);
      if (isPlaying() && !player.isMuted()) return true;
      // bloqueado: toca mudo
      player.mute();
      player.playVideo();
      return false;
    },
    unmute() {
      player.unMute();
      player.playVideo();
    },
    seek: (s) => player.seekTo(s + offset, true),
    currentTime: () => player.getCurrentTime() - offset,
    duration: () => (player.getDuration() || Infinity) - offset,
    onEnded: (cb) => (endedCb = cb),
  };
}

/* ---------- Fluxo principal ---------- */

async function close() {
  await OBR.modal.close(MODAL_ID);
}

async function run() {
  const playId = new URLSearchParams(location.search).get("play");
  const meta = await OBR.room.getMetadata();
  const cur = readCurrent(meta);
  if (!cur || cur.playId !== playId) return close();

  const isGM = (await OBR.player.getRole()) === "GM";
  if (isGM) {
    stopBtn.hidden = false;
    stopBtn.onclick = () => stopCutscene();
  }

  const fit: Fit = cur.fit ?? "cover";
  const source: Source | null = parseSource(cur.url);
  if (!source) {
    showMessage("Link de vídeo inválido.");
    await wait(3000);
    return close();
  }

  let engine: Engine;
  try {
    engine =
      source.kind === "youtube"
        ? await createYouTubeEngine(source.videoId, source.start, fit)
        : await createFileEngine(source.url, fit);
  } catch (e) {
    showMessage((e as Error).message);
    await wait(4000);
    return close();
  }

  const expected = () => (Date.now() - cur.startAt) / 1000;

  // Quem entrou atrasado e a cutscene já acabou: fecha direto
  if (expected() >= engine.duration()) return close();

  // Espera o horário combinado para todos começarem juntos
  await wait(cur.startAt - Date.now());
  const audible = await engine.play(Math.max(0, expected()));
  if (!audible) {
    unmuteBtn.hidden = false;
    unmuteBtn.onclick = () => {
      engine.unmute();
      unmuteBtn.hidden = true;
    };
  }

  // Corrige atraso de carregamento (ex.: internet lenta)
  setTimeout(() => {
    if (Math.abs(engine.currentTime() - expected()) > 1) engine.seek(expected());
  }, 2000);

  engine.onEnded(async () => {
    if (isGM) {
      // Limpa o estado da sala para a próxima cutscene (se ainda for esta)
      setTimeout(async () => {
        const m = await OBR.room.getMetadata();
        if (readCurrent(m)?.playId === cur.playId) await stopCutscene();
      }, 1500);
    }
    close();
  });

  // Se o GM encerrar, o background fecha o modal; isto é só uma garantia extra
  OBR.room.onMetadataChange((m) => {
    const now = m[CURRENT_KEY] as CurrentPlayback | null;
    if (!now || now.playId !== cur.playId) close();
  });
}

OBR.onReady(run);