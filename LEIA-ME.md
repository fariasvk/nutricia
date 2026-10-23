# NutricIA v15 — Ajustes no catálogo, ícones, dock e chat

## Mudanças
- Catálogo de 299 referências: **não mostra uma lista enorme até pesquisar**; após a pesquisa, exibe no máximo 8 resultados por vez, com carregamento incremental.
- Exibe nome, marca, embalagem, EAN e **nutrientes apenas quando tiverem sido consultados/corrigidos**. Registro só cadastral não equivale a uma tabela nutricional. Os 299 itens não trazem valores nutricionais verificados, então não podem ser inventados.
- Botões Buscar nutrientes (Open Food Facts, consulta sob demanda), Corrigir dados e Detalhes continuam disponíveis.
- Ícone baseado na imagem enviada, sem moldura branca externa. Ícones PWA, favicon, login, cabeçalho e abertura atualizados.
- Barra inferior fixa no viewport em todas as telas, independente de rolagem.
- Pergunte à IA: mostra **Cancelar** durante uma solicitação. Ao cancelar, aborta a requisição no navegador e libera a interface; isso pode não interromper o processamento já iniciado no servidor e não reverte o uso de tokens na API.
- `app.js?v=15`, `visual.css?v=15`, `manifest.json?v=15`, ícones v15 e novo `sw.js` para reduzir misturas de cache.

## PUBLICAR SITE (GITHUB)
1. Faça backup do repositório e evite apagar dados locais do navegador sem exportá-los.
2. Extraia NutricIA_v15_SITE.zip.
3. GitHub > fariasvk/nutricia > Add file > Upload files > envie todos os arquivos da pasta (não o ZIP ou a pasta), sobrescrevendo os anteriores. Faça Commit.
4. Após GitHub Pages publicar, teste em aba anônima com https://fariasvk.github.io/nutricia/?versao=15.

## CORRIGIR GEMINI (CLOUDFLARE): NECESSÁRIO
1. Extraia NutricIA_v15_CLOUDFLARE.zip.
2. Cloudflare Worker > Edit code: substitua tudo pelo novo worker-cloudflare.js e Deploy.
3. Settings > Variables and Secrets: mude GEMINI_MODEL para `gemini-3.5-flash-lite` ou remova essa variável antiga; confira a existência de GEMINI_API_KEY sem expor a chave.
4. Abra https://nutriciadivine-night-0498.victor-farias.workers.dev/health e confirme `"version":"15"`.
5. Faça uma pergunta simples na IA. A disponibilidade real depende da sua chave e do serviço Gemini.

## Verificações/limites
- O ZIP do site não altera o Worker no Cloudflare.
- Sem acesso à chave do usuário, o teste do Gemini é simulado, não prova requisições reais.
- A busca no catálogo não substitui verificação do rótulo: dados da Open Food Facts são colaborativos e podem estar incompletos.
