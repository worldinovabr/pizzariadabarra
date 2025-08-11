import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, collection, onSnapshot, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const pedidosDiv = document.getElementById('pedidos');

onSnapshot(collection(db, "pedidos"), snapshot => {
  pedidosDiv.innerHTML = '';
  snapshot.forEach(docSnap => {
    const pedido = docSnap.data();
    const pedidoEl = document.createElement('div');
    pedidoEl.classList.add('card');
    pedidoEl.innerHTML = `
      <h3>Mesa ${pedido.mesa}</h3>
      <ul>${pedido.itens.map(i => `<li>${i.nome} - R$ ${i.preco.toFixed(2)}</li>`).join('')}</ul>
      <p>Status: ${pedido.status}</p>
      <button data-id="${docSnap.id}">Avançar Status</button>
    `;
    pedidoEl.querySelector('button').addEventListener('click', async () => {
      let novoStatus = 'em preparo';
      if (pedido.status === 'em preparo') novoStatus = 'pronto';
      else if (pedido.status === 'pronto') novoStatus = 'entregue';
      await updateDoc(doc(db, "pedidos", docSnap.id), { status: novoStatus });
    });
    pedidosDiv.appendChild(pedidoEl);
  });
});
