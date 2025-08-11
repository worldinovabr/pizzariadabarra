Deploy das Cloud Functions (resumo)

Pré-requisitos:
1. Node.js 18+
2. Firebase CLI instalado: `npm install -g firebase-tools`
3. Autenticar: `firebase login`
4. No diretório do projeto (contendo a pasta functions), inicialize / selecione o projeto:
   `firebase init functions` -> escolha o mesmo projeto do Firebase
   - Se asked to overwrite index.js, você pode manter o existente. Nós fornecemos um `functions/index.js` pronto.

Como implantar:
1. No terminal, vá para a raiz do projeto (onde está a pasta functions).
2. Rode: `firebase deploy --only functions`
3. Isso fará o deploy da função `notifyKitchenOnNewOrder`.

Como a notificação funciona:
- A função escuta a criação de documentos em `pedidos/{orderId}`.
- Ao criar um pedido, ela envia:
  - Uma mensagem para o tópico `kitchen` (dispositivos que se inscreverem nesse tópico receberão).
  - Multicast para tokens salvos em `kitchenTokens` (coleção com documentos { token: "<fcm_token>", name: "iPad cozinha" }).

Configurar dispositivos da cozinha:
- Para usar o tópico `kitchen`, os apps (ou Web Push) devem se inscrever no tópico via SDK.
- Alternativamente, colecione tokens FCM em `kitchenTokens` e atualize-os quando o dispositivo estiver pronto.

Observação:
- Para envio de notificações web (Web Push), será necessário integrar FCM token no front-end da dashboard ou em um app da cozinha e salvar o token em `kitchenTokens`.
- Se preferir eu posso preparar a lógica no Dashboard para registrar tokens FCM de um navegador (Web Push) e salvar automaticamente em `kitchenTokens`. Pergunte se deseja.
