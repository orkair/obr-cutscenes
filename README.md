# Cutscenes — extensão para Owlbear Rodeo

O GM dispara um vídeo (YouTube ou mp4) e ele abre em tela cheia, com som, para todos da sala ao mesmo tempo.

## Como funciona

- **Popover (`index.html`)**: o GM monta a lista de cutscenes e clica ▶ para disparar. Os jogadores só veem o que está tocando.
- **Background (`background.html`)**: roda escondido em todos os jogadores. Quando o GM dispara, abre um modal em tela cheia.
- **Player (`player.html`)**: toca o vídeo. Todos começam no mesmo instante (2,5 s após o clique), e quem entra atrasado pula para o ponto certo. Fecha sozinho no fim.
- **Sincronização**: a cutscene atual e a lista ficam no metadata da sala (`OBR.room`).
- **Som**: tenta tocar com som. Se o navegador bloquear (comum no iPhone), toca mudo e mostra "Toque para ativar o som".

## Rodar localmente

```bash
npm install
npm run dev
```

No Owlbear: Perfil → **Add Extension** → `http://localhost:5173/manifest.json`. Depois crie uma sala com a extensão ativada.

## Deploy na Vercel

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório. O preset **Vite** é detectado sozinho (build `npm run build`, saída `dist`).
3. Depois do deploy, instale no Owlbear com `https://SEU-PROJETO.vercel.app/manifest.json`.

O `vercel.json` já libera CORS, que o Owlbear precisa para ler o manifest.

Alternativa pelo terminal: `npx vercel` (prévia) e `npx vercel --prod` (produção).

## Usando vídeos próprios (mp4)

- **Junto da extensão**: coloque os arquivos em `public/cutscenes/` e use o caminho `/cutscenes/abertura.mp4` na lista.
  Prefira mp4 H.264 + AAC, que toca em todos os aparelhos. Vídeos muito grandes podem bater limites da Vercel. Nesse caso, hospede fora (ex.: Cloudflare R2) e cole a URL completa.
- **URL externa**: qualquer link direto para `.mp4`/`.webm` funciona.

## Links do YouTube aceitos

`youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…`, `/embed/…`, `/live/…`. O parâmetro `t=` (ex.: `t=1m30s`) define o início.
O vídeo precisa permitir incorporação. O YouTube ainda pode mostrar o título por um instante ou anúncios, e isso não dá para esconder.
