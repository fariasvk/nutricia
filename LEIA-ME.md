# NutricIA — catálogo de 299 produtos + ajustes de velocidade

## Publicação
1. Antes de substituir arquivos, faça backup do repositório atual (GitHub → Code → Download ZIP).
2. Extraia o ZIP desta entrega e envie TODOS os arquivos da pasta extraída para a raiz do repositório no GitHub. **Não envie o ZIP fechado.**
3. O novo arquivo obrigatório é `catalogo_299.json`; também são obrigatórios `visual.css` e `nutricia-hero-glass.webp` da versão anterior.
4. Faça commit dos arquivos. Abra o GitHub Pages; após a atualização do `sw.js`, feche/reabra o aplicativo instalado ou recarregue duas vezes caso ainda apareça a versão anterior.
5. Os dados pessoais do navegador e os registros de Firestore não são apagados pela atualização.

## Funcionalidade
- 299 referências de nome, marca, EAN-13, categoria, embalagem, tipo de grão/farinha, variação, perfil indicativo, classificação declarada no arquivo, fonte e observação.
- Busca pela mesma caixa "Buscar produto, marca ou EAN" da tela Banco de alimentos.
- O catálogo abre somente quando a aba Banco de alimentos é acessada, mostra 16 resultados por vez e permite carregar mais sob demanda.
- O botão **Detalhes** apresenta as informações diretamente do CSV original, incluindo a fonte e ressalvas.
- **Buscar nutrientes** faz uma consulta única ao Open Food Facts para aquele EAN, com timeout de 9 segundos. Caso a consulta encontre nutrientes, salva o registro em Meus produtos; caso contrário, conserva os dados cadastrais do catálogo.
- O catálogo NÃO é enviado automaticamente ao Firebase e NÃO fica misturado com os produtos nutricionais, IAC ou prompts da IA.
- Como o CSV não contém composição nutricional nem alérgenos confirmados, não se inventam esses dados e não há classificação de segurança para pessoas com alergias.

## Melhorias de desempenho
- Biblioteca de leitura de código de barras carregada **somente ao entrar no scanner** (antes bloqueava o carregamento da página).
- O catálogo é consultado localmente, sem fazer 299 buscas na internet.
- Resultados do catálogo são paginados; tabela de produtos pessoais é limitada a 80 linhas mostradas para evitar renderizações excessivas.
- Reduz a pausa artificial da tela inicial de 900 ms para 350 ms.
- Limites de 9 s na API Open Food Facts e 18 s nas solicitações à IA, com mensagens de erro em caso de demora.
- Service Worker v9 serve os arquivos estáticos em cache nas visitas posteriores. Para receber novas versões futuramente, incremente CACHE_NAME e os recursos no SW.

## Testes importantes
- Procurar `7897765601350` em Banco de alimentos e abrir detalhes de Azeitona verde sachê (Diza).
- Digitar `azeitona` e depois `arroz`, conferindo que a lista muda imediatamente e mostra a contagem.
- Abrir um registro do catálogo e clicar Buscar nutrientes; quando a API não responder, o catálogo deve continuar funcionando.
- Reiniciar o app e conferir perfis selecionados.
- Fazer comparação com perfis de alergia. Um produto sem informação de alergênicos não é seguro por padrão.
- Verificar login Firebase e câmera em um celular real; estes serviços externos não foram testados ao vivo nesta entrega.

## Limites
- A planilha tem **299 itens e nenhum valor nutricional por 100 g**; a categorização "saudável ou junk food" é "não avaliado" ou preliminar. Exibimos esses dados como referência cadastral, não como recomendações clínicas.
- A consulta a Open Food Facts pode falhar ou retornar dados parciais; a embalagem sempre prevalece.
- Tempos reais de acesso dependerão da rede, Firebase e Cloudflare/Gemini; os timeouts evitam esperas indefinidas, mas não garantem resposta da IA.
