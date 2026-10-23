# NutricIA — correção emergencial da IA (v16)

**NÃO precisa mudar nada no GitHub.** A conversa e a comparação já usam o mesmo endpoint `/ask`.

## Passo A — instalar o novo Worker
1. Entre em https://dash.cloudflare.com/ → Workers & Pages.
2. Abra o Worker que atende `nutriciadivine-night-0498.victor-farias.workers.dev`.
3. Clique Edit code; abra `worker-cloudflare.js` no Bloco de Notas, copie tudo e substitua o código antigo.
4. Clique Deploy.

## Passo B — obrigatório: habilitar a IA da Cloudflare
1. No **MESMO** Worker, abra Settings → Bindings → Add binding.
2. Selecione **Workers AI** (às vezes aparece como **AI**).
3. Nome da variável / binding: **AI** (maiúsculo, sem aspas).
4. Salve/adicione e, se solicitado, publique a mudança.

**Atenção:** somente colar o código NÃO conecta a IA da Cloudflare. O binding AI é indispensável.
Você pode manter o segredo antigo `GEMINI_API_KEY`, mas ele é usado APENAS como reserva se a IA da Cloudflare falhar. Não precisa modificar `GEMINI_MODEL` para testar o caminho principal.

## Passo C — verificar
Abra `https://nutriciadivine-night-0498.victor-farias.workers.dev/health`.
Procure `"version":"16"` e `"aiBindingConfigured":true`.
Se `false`, o binding não foi conectado ou a alteração ainda não foi publicada.
Depois abra https://fariasvk.github.io/nutricia/ e pergunte: "O que é sódio?".
A resposta deverá vir com fonte contendo "IA Cloudflare (Llama)".

## Limitações e custos
O Cloudflare Workers AI tem cota própria (franquia diária de 10.000 neurons no plano gratuito em outubro de 2026), com limites sujeitos a alterações. Isso não garante que o serviço nunca ficará fora ou ultrapassará a cota. Acompanhe o consumo no Cloudflare. Não ative um plano pago sem entender o custo.
A resposta gerada por Llama é conteúdo de IA, não um parecer médico. Verifique rótulos e fontes.

## Segurança
Não coloque GEMINI_API_KEY no GitHub, no HTML ou no JavaScript do site. O endpoint restringe as origens ao domínio do NutricIA, mas CORS não constitui autenticação completa; rate limits adicionais podem ser recomendáveis para disponibilização pública.
