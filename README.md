# NutricIA — pacote de atualização v2

Este pacote substitui os arquivos estáticos atuais com uma interface de início/onboarding, login opcional, navegação mobile simplificada, busca de perfis e assistente baseado em registros.

## Arquivos

- `index.html`: splash, onboarding, tela de autenticação, menu principal, seleção de perfil por busca, assistente e interface responsiva.
- `app.js`: comportamento de telas, banco local, scanner Open Food Facts, comparador, perfis, login Firebase opcional e assistente.
- `manifest.json`: metadados e ícones PWA.
- `sw.js`: cache com versão nova.
- `worker.js`: código separado de backend para IA. Não é usado no GitHub Pages diretamente.
- `AI_SETUP.md`: configuração de IA e login real.

## Atualização no GitHub

1. Baixe e extraia o ZIP.
2. No repositório `fariasvk/nutricia`, substitua `index.html`, `app.js`, `manifest.json` e `sw.js` pelos arquivos deste pacote.
3. Mantenha os arquivos `nutricia-icon-192.png`, `nutricia-icon-512.png` e `apple-touch-icon.png` na raiz do repositório se já os enviou. Caso contrário, carregue esses três arquivos de ícone também.
4. Faça commit das alterações e espere o GitHub Pages concluir a publicação.
5. No celular, abra o site no navegador e faça recarga completa. Se instalado anteriormente, remova o atalho antigo e adicione novamente após confirmar que o site atual está publicado.

## Importante

- A assistente usa somente registros do banco local enviados pelo navegador. Registros de demonstração são fictícios e excluídos do contexto da assistente.
- Sem `NUTRICIA_AI_ENDPOINT`, existe apenas um modo local limitado que procura valores dentro dos registros. Ele NÃO é a IA generativa.
- A IA em linguagem natural só fica ativa quando o backend Cloudflare Worker estiver publicado e a URL configurada em `app.js`.
- Login com conta real requer configuração Firebase em `FIREBASE_CONFIG`. Até lá, “Continuar como visitante” funciona localmente.
- O login Firebase não sincroniza produtos entre aparelhos; o banco ainda é local no navegador.
- O assistente é educativo e não substitui profissional de saúde. Dados Open Food Facts são colaborativos e não necessariamente verificados.
- O `worker.js` não contém segredo. A variável `GEMINI_API_KEY` deve ser cadastrada como Secret no painel do Cloudflare, nunca neste repositório.
