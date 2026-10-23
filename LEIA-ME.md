# NutricIA — atualização v11 (23/10/2026)

## O que mudou

- **Assistente e comparação por IA:** o Worker agora trata 502/503 com até 3 tentativas limitadas, pausas, e modelo alternativo (`gemini-2.5-flash-lite` / `gemini-2.5-flash`) para sobrecargas temporárias. Mensagens de erro mais claras sobre indisponibilidade, chave, modelo e cota. Timeout do site ajustado para 48 segundos. Em caso de falha na comparação com IA, o aplicativo mostra um **resumo LOCAL SEM IA** usando apenas valores efetivamente salvos, sem fingir uma resposta do Gemini.
- **Celular:** cabeçalho reorganizado em logo + configurações + perfis, sem sobreposição nas resoluções de 320, 360, 390, 430, 768 e 1280 px em testes de navegador. Busca de alimentos continua na tela inicial e na aba Produtos, não no cabeçalho.
- **Configurações:** agora possuem uma tela própria aberta pelo botão de engrenagem no cabeçalho, com tema, instalação e saída. Saíram de dentro de Perfil.
- **Acessos rápidos:** removido Laboratório de pesos dos atalhos da tela inicial. A tela de laboratório continua disponível a partir do Perfil.
- **Teclado no celular:** não abre automaticamente quando você entra em Pergunte à IA ou toca numa sugestão.
- **Correções de produtos:** novos botões **Corrigir dados** no catálogo e **Corrigir** na lista pessoal; formulário editável com nome, marca, porção, ingredientes e nutrientes por 100 g. Campos em branco significam **Não disponível**, jamais zero. Alterações são pessoais (local/nuvem conforme login), ficam identificadas como correções **não verificadas** e não modificam a Open Food Facts ou o catálogo público. Se modificar ingredientes, alertas de alérgenos anteriores são descartados e não se pressupõe ausência de alérgenos.
- **Animações:** leves e com suporte a `prefers-reduced-motion`.
- **Cache PWA:** versão de cache incrementada para v11.

## Como publicar — 2 ETAPAS

### 1. GitHub Pages (site)

1. Guarde um backup, caso ainda não tenha.
2. Extraia **NutricIA_v11_SITE.zip**.
3. Entre em https://github.com/fariasvk/nutricia > **Add file > Upload files**.
4. Envie os arquivos extraídos **na raiz do repositório, ao lado de index.html**; não envie a pasta nem o ZIP.
5. Confirme **Commit changes**.
6. Abra https://fariasvk.github.io/nutricia/ e atualize. Se ainda vir a versão anterior, feche e reabra o app instalado, ou atualize novamente para ativar o novo Service Worker.

O ZIP do site **não** contém `worker-cloudflare.js`.

### 2. Cloudflare Worker (obrigatório para IA)

1. Extraia **NutricIA_v11_CLOUDFLARE.zip**.
2. Clique no arquivo `worker-cloudflare.js` com botão direito > **Abrir com > Bloco de Notas**.
3. Use Ctrl+A e Ctrl+C para copiar todo o código.
4. No https://dash.cloudflare.com/ vá em **Workers & Pages** > Worker da NutricIA > **Edit code**, substitua o código anterior (Ctrl+A, Ctrl+V) e clique **Deploy**.
5. No Worker, abra **Settings > Variables and Secrets** e verifique que `GEMINI_API_KEY` está presente como segredo. Não divulgue esse valor, não o coloque no GitHub.
6. **Opcional:** a variável `GEMINI_MODEL` pode ser `gemini-2.5-flash-lite`. Se ela não existir, esse é o padrão. O Worker tenta outro modelo 2.5 em falhas temporárias. Isso pode aumentar uso/custo na conta Google conforme o plano e a disponibilidade. **O código não altera nem cria sua chave, modelo configurado ou cotas**.
7. O site usa o endpoint já configurado `https://nutriciadivine-night-0498.victor-farias.workers.dev/ask`. **O nome/endereço do Worker deve permanecer o mesmo**, senão é preciso atualizar a variável `NUTRICIA_AI_ENDPOINT` no `app.js`.

## Como testar

1. PC e celular: abra **Pergunte à IA**; teclado só deve aparecer depois de tocar no campo. Pergunte “O que é sódio?”.
2. Compare dois produtos salvos e clique **Explicar com IA**; se Gemini estiver fora, aparecerá claramente um resumo local (não IA).
3. Acesse **Produtos**, clique em **Corrigir dados**, altere um nome ou valor e salve; reabra pelo botão **Corrigir**.
4. No smartphone: confira se **engrenagem**, **logo** e **perfis** ficam na mesma linha.

## Limitações reais

O Gemini é um serviço externo: **HTTP 503 significa que pode estar temporariamente indisponível/sobrecarregado**. Novas tentativas aumentam a chance de sucesso, mas não podem garantir resposta se a API, a chave, o modelo, a conexão ou a cota estiverem indisponíveis. Um erro 429 envolve limite de uso/cota e não deve ser tratado como lentidão comum. Esta versão foi testada com simulações locais em navegador e Worker, não com a chave real do usuário, câmera física ou Cloudflare publicado. Correções pessoais não têm validação médica, alergênica ou sanitária.
