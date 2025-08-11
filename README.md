Pizzaria da Barra — Cliente (PWA) + Dashboard (Recepção)
=========================================================

Estrutura:
- /client -> PWA para os clientes (acesso via QR com ?table=5)
- /dashboard -> Painel da recepção para ver e atualizar pedidos
- /assets -> imagens e ícones
- Ambos usam Firebase (Firestore e Auth). Coloque suas credenciais em firebaseConfig.js

Passos para testar localmente:
1. Extraia o ZIP e abra a pasta no VS Code.
2. Recomendo usar `npx serve` ou a extensão Live Server para testar (ex: `npx serve .`).
3. No Firebase Console:
   - Crie um projeto.
   - Habilite Firestore (modo de teste ou com regras apropriadas).
   - (Opcional) Habilite Authentication > Email/Senha para proteger o dashboard.
4. Substitua os placeholders em:
   - /client/firebaseConfig.js
   - /dashboard/firebaseConfig.js
5. Abra:
   - Cliente: http://localhost:5000/client/?table=5
   - Dashboard: http://localhost:5000/dashboard/
6. Para QR: gere URL apontando para `/client/?table=NUM`.

Observações:
- Envio automático: quando online o cliente salva diretamente em Firestore. Se offline os pedidos ficam enfileirados em localStorage e enviados quando voltar online.
- Dashboard: tem opção "Atualização em tempo real" (usará onSnapshot). Você pode proteger o dashboard com Firebase Auth (ex.: criar usuário admin via Firebase Console).
- Se quiser integração com impressora de cozinha ou notificações (FCM), eu adiciono a Cloud Function / webhook necessária.


Cloud Functions (Notificações FCM)
---------------------------------
Incluí uma Cloud Function de exemplo em `/functions` que envia notificações via FCM sempre que um novo pedido é criado.

- Função: `notifyKitchenOnNewOrder`
- Trigger: Firestore `onCreate` em `pedidos/{orderId}`
- Envia para:
  - tópico `kitchen`
  - tokens listados em `kitchenTokens` (coleção no Firestore)

Siga as instruções em `/functions/README.md` para implantar.



Registro automático de token FCM no Dashboard
---------------------------------------------
O Dashboard agora registra automaticamente o token FCM do navegador (se permitido) e o salva na coleção `kitchenTokens`.

Como configurar:
1. No Firebase Console, vá em **Configurações do Projeto > Cloud Messaging** e gere uma chave VAPID pública.
2. No arquivo `/dashboard/dashboard-app.js`, substitua `"SUA_VAPID_KEY"` pela chave VAPID.
3. Ao abrir o Dashboard, o navegador pedirá permissão para notificações.
4. Ao permitir, o token será salvo no Firestore e usado pela Cloud Function para enviar notificações.

