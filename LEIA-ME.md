# NutricIA — correção do scanner e da IA (23/10/2026)

## 1. GitHub Pages (site)

Faça backup do repositório. Extraia este ZIP e carregue os **11 arquivos do site** para a **raiz** de `fariasvk/nutricia`, substituindo as versões anteriores. NÃO envie `worker-cloudflare.js` para o GitHub; ele vai somente ao Cloudflare.

No site: `index.html`, `app.js`, `sw.js`, `visual.css`, `manifest.json`, `catalogo_299.json`, `nutricia-hero-glass.webp`, `nutricia-icon-192.png`, `nutricia-icon-512.png`, `apple-touch-icon.png`. Este LEIA-ME é opcional.

Depois do commit, recarregue duas vezes ou feche e reabra o PWA, para o Service Worker atualizar de v9 para v10.

## 2. Cloudflare Worker (IA) — etapa OBRIGATÓRIA para acelerar respostas de IA

O GitHub NÃO atualiza o Worker hospedado no Cloudflare automaticamente. Em `dash.cloudflare.com` > Workers & Pages > Worker da NutricIA > **Edit code**, substitua todo o código pelo conteúdo do arquivo `worker-cloudflare.js` e faça **Deploy**. **Nunca coloque o segredo Gemini no GitHub.**

Em Settings > Variables and Secrets confira `GEMINI_API_KEY` como Secret. Se tiver `GEMINI_MODEL` configurado como modelo antigo/lento, defina para `gemini-2.5-flash-lite` ou remova a variável para usar o padrão da nova versão. Confirme que o endpoint `/ask` continua em `https://nutriciadivine-night-0498.victor-farias.workers.dev/ask`.

O Worker usa raciocínio desativado em modelos 2.5, contexto menor, limite upstream de 26 s e informa erros de cota/configuração mais claramente. O site agora aguarda até 35 s; isso evita interromper respostas que demoram mais de 18 s. Se a chave/modelo/cota estiverem indisponíveis, nenhum ajuste do front-end sozinho consegue fazer a IA responder.

## 3. Scanner

- Leitura de EAN-8/EAN-13, UPC, ITF e Code 128/39; área de reconhecimento ampliada (usa o enquadramento inteiro), câmera traseira, prioridade para BarcodeDetector quando suportado.
- Botão **Reiniciar câmera** e botão **Ler foto do código** para quando a câmera estiver desfocada.
- Assim que lê um código, a câmera para, o número aparece imediatamente e o app tenta identificar no banco pessoal, catálogo local de 299, e Open Food Facts.
- Quando o catálogo local reconhece o EAN, o app mostra identificação mesmo se Open Food Facts estiver fora; valores nutricionais não serão inventados.

## 4. Testes

1. No celular, abra scanner, permita câmera e mostre o EAN impresso com boa luz; veja o feedback `Código X reconhecido!`.
2. Se falhar, selecione **Ler foto do código** ou digite o EAN.
3. Faça uma pergunta simples à IA, como `O que é sódio?`.
4. Se a IA ainda falhar, confira se o Worker foi atualizado e se GEMINI_API_KEY e GEMINI_MODEL estão corretos.

OBS: sintaxe e fluxos foram testados com simulações locais, mas não foi possível testar fisicamente a câmera, chave secreta do Gemini ou o Cloudflare Worker publicado.
