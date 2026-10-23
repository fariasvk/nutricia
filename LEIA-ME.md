# NutricIA v14 — Correção da tela desformatada

## O que causou o problema
A captura mostrava a nova tela HTML, mas sem o CSS da abertura e com a imagem antiga.
Isso é compatível com arquivo visual.css ausente/desatualizado ou cache antigo do PWA.
Não foi possível verificar diretamente os arquivos publicados no seu GitHub Pages.

## O que foi corrigido
- O CSS completo está também embutido no index.html: a abertura fica centralizada mesmo se visual.css não carregar.
- A logo da abertura também está embutida no HTML (não depende de arquivos de imagem ou cache).
- Logo do login, cabeçalho, favicon e ícones instaláveis usam novos nomes v14.
- app.js e visual.css usam versão na URL para não reutilizar cache antigo.
- sw.js atualizado: prioridade para arquivos publicados em vez do cache antigo; limpa os caches da versão anterior.
- Todas as funções de catálogo, scanner, comparação, perfis e IA foram mantidas da v13. Não altere o Cloudflare.

## PUBLICAÇÃO NO GITHUB (PASSO A PASSO)
1. Extraia o NutricIA_v14_SITE_CORRIGIDO.zip. Não envie o ZIP nem a pasta: envie os arquivos de dentro dela.
2. No repositório fariasvk/nutricia, aba Code > Add file > Upload files, selecione TODOS os arquivos extraídos (incluindo os novos ícones v14).
3. Faça Commit changes; não apague outros arquivos do repositório.
4. Abra https://fariasvk.github.io/nutricia/?versao=14 em uma aba anônima (para testar sem cache antigo).
5. Se a versão instalada no celular continuar antiga, feche o app, limpe os dados de site somente se você já tiver seus produtos salvos na nuvem/backup, ou atualize o atalho. Não limpe armazenamento sem backup dos produtos locais.

## VERIFICAR SE SUBIU
- Abra https://fariasvk.github.io/nutricia/visual.css?v=14 — deve exibir texto CSS (e não erro 404).
- Abra https://fariasvk.github.io/nutricia/nutricia-brand-v14.png — deve exibir o carrinho branco em fundo verde.
- A abertura deve ter logo centralizada, título grande e botão verde-escuro; nenhum texto deve aparecer solto no canto superior esquerdo.

## Limites do teste
Verificado em navegador simulado com CSS externo bloqueado e com imagens antigas em cache. Não é possível confirmar a publicação real sem acesso à página no seu dispositivo.
