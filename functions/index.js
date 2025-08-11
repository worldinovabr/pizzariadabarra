const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// When a new order is created in Firestore /pedidos collection, send FCM notification
exports.notifyKitchenOnNewOrder = functions.firestore
  .document('pedidos/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();
    const orderId = context.params.orderId;

    const title = `Novo pedido — Mesa ${order.mesa}`;
    const body = `Total: R$ ${order.total ? Number(order.total).toFixed(2) : '0.00'}`;

    const message = {
      notification: {
        title,
        body
      },
      data: {
        orderId: orderId,
        mesa: String(order.mesa)
      },
      // send to a topic 'kitchen' (subscribe kitchen devices to this topic)
      topic: 'kitchen'
    };

    // Additionally, you may keep tokens in collection 'kitchenTokens' and send to them
    try {
      const tokensSnap = await admin.firestore().collection('kitchenTokens').get();
      const tokens = [];
      tokensSnap.forEach(doc => {
        const d = doc.data();
        if(d && d.token) tokens.push(d.token);
      });

      if(tokens.length){
        // send multicast to tokens
        await admin.messaging().sendMulticast({
          tokens,
          notification: { title, body },
          data: { orderId, mesa: String(order.mesa) }
        });
      }

      // send topic message (also sends to tokens subscribed to 'kitchen')
      await admin.messaging().send(message);

      console.log('Notificação enviada para cozinha — pedido', orderId);
      return null;
    } catch (err) {
      console.error('Erro ao enviar notificação', err);
      return null;
    }
  });
