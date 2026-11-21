import OBR, { Metadata, Theme } from "@owlbear-rodeo/sdk";
import "./popover.css";
import {
  Cutscene,
  LIBRARY_KEY,
  getLibrary,
  parseSource,
  playCutscene,
  readCurrent,
  setLibrary,
  stopCutscene,
  uid,
} from "./shared";

const app = document.getElementById("app")!;
let role: "GM" | "PLAYER" = "PLAYER";
let meta: Metadata = {};
let formError = "";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function applyTheme(t: Theme) {
  const r = document.documentElement.style;
  r.setProperty("--text", t.text.primary);
  r.setProperty("--muted", t.text.secondary);
  r.setProperty("--primary", t.primary.main);
  r.setProperty("--primary-contrast", t.primary.contrastText);
}

function render() {
  // preserva o que o GM está digitando quando a sala muda
  const prevTitle = app.querySelector<HTMLInputElement>("input[name=title]")?.value ?? "";
  const prevUrl = app.querySelector<HTMLInputElement>("input[name=url]")?.value ?? "";
  const current = readCurrent(meta);
  const library = (meta[LIBRARY_KEY] as Cutscene[] | undefined) ?? [];

  const nowHtml = current
    ? `<div class="now">▶ <span class="title">${esc(current.title)}</span>
         ${role === "GM" ? `<button class="danger" data-stop>Encerrar</button>` : ""}</div>`
    : "";

  if (role !== "GM") {
    app.innerHTML = `
      <h1>Cutscenes</h1>
      ${nowHtml}
      <p>As cutscenes são disparadas pelo mestre e aparecem automaticamente na sua tela.</p>`;
    bind();
    return;
  }

  const items = library.length
    ? library
        .map((c) => {
          const kind = parseSource(c.url)?.kind === "youtube" ? "YouTube" : "Arquivo";
          return `<li>
            <div class="info">
              <span class="title">${esc(c.title)}<span class="tag">${kind}</span></span>
              <span class="url">${esc(c.url)}</span>
            </div>
            <button class="ghost" data-fit="${c.id}" title="${(c.fit ?? "cover") === "cover" ? "Preenchendo a tela (clique para mostrar inteiro)" : "Mostrando inteiro (clique para preencher a tela)"}">${(c.fit ?? "cover") === "cover" ? "⛶" : "▭"}</button>
            <button class="icon" data-play="${c.id}" title="Disparar para todos">▶</button>
            <button class="ghost" data-del="${c.id}" title="Remover">✕</button>
          </li>`;
        })
        .join("")
    : `<p class="empty">Nenhuma cutscene ainda. Adicione abaixo.</p>`;

  app.innerHTML = `
    <h1>Cutscenes</h1>
    ${nowHtml}
    <ul>${items}</ul>
    <form>
      <input name="title" placeholder="Nome (ex.: Abertura)" maxlength="60" value="${esc(prevTitle)}" />
      <input name="url" placeholder="Link do YouTube ou do .mp4" inputmode="url" autocomplete="off" value="${esc(prevUrl)}" />
      ${formError ? `<span class="error">${esc(formError)}</span>` : ""}
      <button type="submit">Adicionar</button>
    </form>`;
  bind();
}

function bind() {
  app.querySelector<HTMLButtonElement>("[data-stop]")?.addEventListener("click", () => stopCutscene());

  app.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) =>
    b.addEventListener("click", async () => {
      const c = (await getLibrary()).find((x) => x.id === b.dataset.play);
      if (c) await playCutscene(c);
    }),
  );

  app.querySelectorAll<HTMLButtonElement>("[data-fit]").forEach((b) =>
    b.addEventListener("click", async () => {
      const list = await getLibrary();
      await setLibrary(
        list.map((x) =>
          x.id === b.dataset.fit
            ? { ...x, fit: (x.fit ?? "cover") === "cover" ? ("contain" as const) : ("cover" as const) }
            : x,
        ),
      );
    }),
  );

  app.querySelectorAll<HTMLButtonElement>("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const list = await getLibrary();
      await setLibrary(list.filter((x) => x.id !== b.dataset.del));
    }),
  );

  app.querySelector("form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const url = String(data.get("url") ?? "").trim();
    const title = String(data.get("title") ?? "").trim() || "Cutscene";
    if (!parseSource(url)) {
      formError = "Link inválido. Use um link do YouTube, uma URL de .mp4 ou um caminho como /cutscenes/intro.mp4.";
      render();
      return;
    }
    formError = "";
    (e.target as HTMLFormElement).reset();
    const list = await getLibrary();
    await setLibrary([...list, { id: uid(), title, url }]);
  });
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);

  role = await OBR.player.getRole();
  OBR.player.onChange((p) => {
    if (p.role !== role) {
      role = p.role;
      render();
    }
  });

  meta = await OBR.room.getMetadata();
  OBR.room.onMetadataChange((m) => {
    meta = m;
    render();
  });
  render();
});