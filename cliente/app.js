import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const mesa = urlParams.get('table') || 'Sem número';
document.getElementById('mesa-info').innerText = `Mesa: ${mesa}`;

const menuItems = [
  { nome: "Pizza Calabresa", preco: 39.90 },
  { nome: "Pizza Mussarela", preco: 37.50 },
  { nome: "Coca-Cola 2L", preco: 12.00 }
];

const menuEl = document.getElementById('menu');
menuItems.forEach(item => {
  const card = document.createElement('div');
  card.classList.add('card');
  card.innerHTML = `<h3>${item.nome}</h3><p>R$ ${item.preco.toFixed(2)}</p>
    <button>Adicionar</button>`;
  card.querySelector('button').addEventListener('click', () => addToCart(item));
  menuEl.appendChild(card);
});

let cart = [];
function addToCart(item) {
  cart.push(item);
  alert(`${item.nome} adicionado ao pedido.`);
}

document.getElementById('finalizar-pedido').addEventListener('click', async () => {
  if (cart.length === 0) return alert('Carrinho vazio!');
  await addDoc(collection(db, "pedidos"), {
    mesa,
    itens: cart,
    status: "pendente",
    criadoEm: serverTimestamp()
  });
  alert('Pedido enviado com sucesso!');
  cart = [];
});
