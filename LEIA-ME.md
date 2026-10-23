# NutricIA v13 — Nova identidade e animação de abertura

## Publicar no GitHub Pages

1. Você já fez backup nas versões anteriores; guarde-o.
2. Extraia o ZIP **NutricIA_v13_SITE.zip**.
3. No GitHub `fariasvk/nutricia`, clique em **Add file > Upload files** e envie os **13 arquivos da pasta extraída**, diretamente na raiz do repositório (mesmo local de `index.html`).
4. Confirme em **Commit changes**. Todos os arquivos anteriores precisam ser substituídos.
5. Abra https://fariasvk.github.io/nutricia/ e atualize com Ctrl+Shift+R. Se o app estiver instalado no celular, feche e reabra, ou remova e reinstale apenas se os ícones continuarem antigos.

**Importante:** esta atualização não exige mudar nada no Cloudflare. Não toque no Worker nem na chave da IA.

## O que muda

- A imagem original enviada por você foi transformada nos ícones de 192 px, 512 px, 180 px (iOS), favicon e versão maskable para instalação Android.
- Logo atualizado na entrada, login e cabeçalho.
- Entrada moderna e minimalista: círculo verde sobe da parte inferior, expande, o símbolo surge e sobe suavemente, o slogan e o botão Começar aparecem.
- Slogan: **Escaneie. Compare. Escolha melhor.**
- Ao tocar em **Começar**, a tela desliza suavemente para a direita e abre:
  - **Início** se já houver sessão Firebase ativa ou modo visitante salvo.
  - **Login** se não houver sessão ativa.
- A nova abertura aparece sempre ao abrir o aplicativo, e não impede a restauração da sessão.
- Compatível com o ajuste de sistema **Reduzir movimento** para acessibilidade.
- Demais funcionalidades da v12 foram preservadas: scanner, catálogo, comparação, perfis, Firebase e IA.

## Testar

1. Abra o site no celular: o círculo deve aparecer e expandir; logo, slogan e botão Começar devem surgir.
2. Clique Começar; com sessão salva, vá ao início. Sem sessão, vá ao login.
3. Teste também em computador e na versão instalada.
4. Em celular, o ícone antigo pode continuar no atalho por cache do sistema; atualizar o PWA ou reinstalar resolve normalmente.

Não foi necessário editar o Cloudflare. A resposta real do Gemini continua dependente das configurações e disponibilidade do serviço externo.
