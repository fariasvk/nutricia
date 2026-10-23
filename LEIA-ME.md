# NutricIA v12 — IA e pesquisa para comparar alimentos

## Instalar no GitHub Pages

1. Faça uma cópia de segurança do repositório. Guarde também dados que existam apenas no navegador, se importante.
2. Extraia o ZIP **NutricIA_v12_SITE.zip**.
3. Envie **os 11 arquivos de dentro dele** para a raiz do repositório `fariasvk/nutricia` usando **Add file > Upload files**.
4. Faça o **Commit changes**, mantendo `index.html`, `app.js`, `visual.css`, `sw.js` e `catalogo_299.json` juntos na raiz.
5. Abra `https://fariasvk.github.io/nutricia/` e atualize com Ctrl+Shift+R. Em celular com PWA instalada, pode ser preciso fechar e reabrir o app para o novo service worker assumir.

## Atualizar o Cloudflare

1. Extraia **NutricIA_v12_CLOUDFLARE.zip** separadamente.
2. No painel Cloudflare > Workers & Pages > seu Worker > Edit code, substitua o código anterior pelo conteúdo de `worker-cloudflare.js` e clique em **Deploy**.
3. Em **Settings > Variables and Secrets**, mantenha `GEMINI_API_KEY` como **Secret**. **Nunca coloque a chave no GitHub.**
4. Se já existir a variável `GEMINI_MODEL` com `gemini-2.5-flash-lite`, mude-a para **`gemini-3.5-flash-lite`** e publique a configuração. A versão nova do Worker também tenta identificar e usar modelos alternativos quando o indicado não estiver liberado para o seu projeto.
5. Se ainda houver erro por cota, chave inválida ou serviço indisponível, a aplicação explica o erro. Não é possível garantir o acesso à API sem uma chave válida e um modelo liberado na conta.

## O que mudou

- Comparador recebe campo de pesquisa para cada produto, com **até 8 sugestões** por vez. Busca por nome, marca, categoria, embalagem e código.
- Permite selecionar produtos tanto de **Meus produtos** como do **catálogo de 299 itens**. A lista não mostra centenas de opções de uma vez.
- Produtos somente cadastrais são comparáveis quanto a seus dados de identificação, mas os valores nutricionais são **Não disponíveis** até que rótulos reais sejam consultados ou inseridos. Sem cálculo de IAC com dados ausentes e sem conclusões de segurança para alergias.
- **Buscar nutrientes** no comparador consulta Open Food Facts sob demanda. Falhas externas não apagam o catálogo.
- A comparação com IA generativa só é solicitada para dois produtos com dados reais; quando algum for somente cadastral, mostra um resumo local honesto sem inventar nutrientes.
- Worker passa a usar um modelo atual por padrão, tratar 404 da família 2.5 com fallback, consultar os modelos habilitados quando necessário e tratar cota e erros temporários.
- Todas as correções de interface e scanner da v11 são mantidas.

## Como testar

1. Em **Comparar**, pesquise `azeitona` no Produto 1 e outro termo no Produto 2; escolha um resultado de cada lado.
2. Confira o aviso **sem rótulo nutricional** ao selecionar um item que tenha só metadados.
3. Pesquise um produto pessoal que tenha nutrientes cadastrados; o comparador usa esses dados.
4. Em **Pergunte à IA**, faça `O que é sódio?` e em **Comparar** use **Explicar com IA** para dois produtos pessoais. Se o Gemini falhar, verá o resumo local.

**Notas:** o IAC é uma simulação educativa. O catálogo de referência contém dados cadastrais, não laudos nutricionais completos. Valores de referência e edições de usuários exigem conferência do rótulo. Testes automatizados com respostas simuladas não garantem o funcionamento da chave Gemini real, do Cloudflare publicado ou da rede do celular.
