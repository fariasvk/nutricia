# Configurar IA real e login

## A. Assistente IA generativa

O GitHub Pages hospeda arquivos estáticos. A chave Gemini não pode ser colocada no `app.js`, porque qualquer visitante poderia copiá-la. `worker.js` é um backend separado que mantém a chave como segredo.

1. Crie/acessse um projeto no Google AI Studio e obtenha uma chave para a Gemini API. Se necessário, peça a um responsável ou professor para acompanhar a configuração da conta.
2. Abra o painel Cloudflare e crie um Worker novo (Dashboard > Workers & Pages > Create > Worker).
3. Cole o conteúdo de `worker.js` no editor do Worker e publique.
4. Em Settings > Variables and Secrets, adicione uma variável do tipo **Secret** chamada `GEMINI_API_KEY` com a chave gerada. Opcionalmente, adicione uma variável de texto `GEMINI_MODEL` com `gemini-3.5-flash-lite`. Publique as alterações.
5. O endereço do Worker será parecido com `https://nome-do-worker.seu-subdominio.workers.dev`. Teste que a URL termina com `/ask`.
6. Abra `app.js` no GitHub e substitua a linha:
   `const NUTRICIA_AI_ENDPOINT = '';`
   por:
   `const NUTRICIA_AI_ENDPOINT = 'https://SEU-WORKER.seu-subdominio.workers.dev/ask';`
7. Faça commit de `app.js` e espere o GitHub Pages atualizar.

O Worker só aceita requests de `https://fariasvk.github.io`. Se você mudar para um domínio próprio, ajuste `ALLOWED_ORIGINS` no Worker. O limite por IP implementado no código é best-effort; para uso público de maior escala, configure também rate limiting no painel Cloudflare.

A assistente recebe uma seleção limitada de registros do banco do navegador. Dados não presentes nos registros são omitidos ou representados como `null`; a instrução do modelo manda declarar falta de dados, mas nenhum modelo generativo oferece garantia matemática de nunca errar. Revise respostas antes de uso escolar e não use para diagnóstico ou decisão médica.

## B. Login com Firebase

O layout e o modo visitante funcionam sem Firebase. Para habilitar login/cadastro real:

1. No Firebase Console, crie um projeto e adicione um aplicativo Web.
2. Em Authentication > Sign-in method, habilite Email/Password.
3. Em Authentication > Settings > Authorized domains, adicione `fariasvk.github.io`.
4. Copie a configuração pública do aplicativo Web (apiKey, authDomain, projectId e appId).
5. Abra `app.js` e substitua os valores de `FIREBASE_CONFIG` (`COLE_AQUI_...`) pelos do Firebase. Essa configuração Web identifica o projeto; mantenha regras de segurança corretas no Firebase. Não coloque uma chave Gemini aqui.
6. Faça commit do `app.js`.

Visitante continua disponível. A autenticação não sincroniza os produtos: o banco de alimentos continua guardado no localStorage do dispositivo em que foi preenchido. Para sincronização entre aparelhos seria necessário adicionar um banco como Firestore e regras apropriadas.

## C. Conteúdo que não deve ser publicado

Nunca cole chaves Gemini, senhas ou tokens secretos no GitHub. Apenas o Cloudflare Worker recebe `GEMINI_API_KEY` como Secret. O endpoint do Worker é público por definição, por isso mantenha limites de uso.
