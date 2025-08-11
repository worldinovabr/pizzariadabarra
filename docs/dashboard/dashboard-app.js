// dashboard-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import { firebaseConfig } from "./firebaseConfig.js";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ordersEl = document.getElementById('orders');
const filterInput = document.getElementById('filter');
const refreshBtn = document.getElementById('refresh');
const autoCheckbox = document.getElementById('auto');

let unsubscribe = null;

function q(s){return document.querySelector(s)}

function formatBRL(v){return v.toFixed(2).replace('.',',')}

function renderOrders(docs){
  ordersEl.innerHTML = docs.map(d=>{
    const data = d.data();
    return `<article class="order" data-id="${d.id}">
      <h4>Mesa ${data.mesa} — <span class="meta">${data.status}</span></h4>
      <div class="meta">Criado: ${data.criadoEm && data.criadoEm.toDate ? data.criadoEm.toDate().toLocaleString() : '-'}</div>
      <ul class="items">${(data.itens||[]).map(i=>`<li>${i.qtd}× ${i.nome} — R$ ${formatBRL(i.preco)}</li>`).join('')}</ul>
      <div class="btns">
        <button data-action="prev">◀️</button>
        <button data-action="next">▶️</button>
        <button data-action="delete">Excluir</button>
      </div>
    </article>`;
  }).join('');
  attachButtons();
}

function attachButtons(){
  ordersEl.querySelectorAll('.order').forEach(el=>{
    const id = el.dataset.id;
    el.querySelector('[data-action="next"]').addEventListener('click', ()=> changeStatus(id, 'next'));
    el.querySelector('[data-action="prev"]').addEventListener('click', ()=> changeStatus(id, 'prev'));
    el.querySelector('[data-action="delete"]').addEventListener('click', ()=> deleteOrder(id));
  });
}

async function loadOnce(){
  const qref = query(collection(db,'pedidos'), orderBy('criadoEm','desc'));
  const snap = await getDocs(qref);
  renderOrders(snap.docs);
}

function listenRealtime(){
  if(unsubscribe) unsubscribe();
  const qref = query(collection(db,'pedidos'), orderBy('criadoEm','desc'));
  unsubscribe = onSnapshot(qref, snap => {
    renderOrders(snap.docs);
  });
}

async function changeStatus(id, dir){
  const ref = doc(db, 'pedidos', id);
  // get doc to read current status
  const snap = await (await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js")).getDoc(ref);
  if(!snap.exists()) return;
  const data = snap.data();
  const orderStates = ['pendente','em preparo','pronto','entregue'];
  let idx = orderStates.indexOf(data.status || 'pendente');
  if(dir==='next') idx = Math.min(orderStates.length-1, idx+1);
  else idx = Math.max(0, idx-1);
  await updateDoc(ref, { status: orderStates[idx] });
}

async function deleteOrder(id){
  if(!confirm('Excluir pedido?')) return;
  const ref = doc(db,'pedidos',id);
  await updateDoc(ref, { status: 'cancelado' });
}

// handlers
refreshBtn.addEventListener('click', ()=> { loadOnce(); loadReports(); });
autoCheckbox.addEventListener('change', ()=> {
  if(autoCheckbox.checked) { listenRealtime(); loadReportsRealtime(); }
  else if(unsubscribe) unsubscribe();
});

filterInput.addEventListener('input', ()=> {
  const v = filterInput.value.trim().toLowerCase();
  // simple client-side filter
  const items = Array.from(ordersEl.querySelectorAll('.order'));
  items.forEach(it=>{
    const t = it.textContent.toLowerCase();
    it.style.display = t.includes(v) ? '' : 'none';
  });
});

// Relatórios
const reportsEl = document.getElementById('reports');

async function loadReports() {
  const qref = query(collection(db,'pedidos'));
  const snap = await getDocs(qref);
  renderReports(snap.docs);
}

function loadReportsRealtime() {
  const qref = query(collection(db,'pedidos'));
  onSnapshot(qref, snap => {
    renderReports(snap.docs);
  });
}

function renderReports(docs) {
  // Relatório por tipo de pizza
  const pizzaStats = {};
  // Relatório geral por dia
  const dailyStats = {};
  docs.forEach(d => {
    const data = d.data();
    if(data.status === 'cancelado') return;
    const date = data.criadoEm && data.criadoEm.toDate ? data.criadoEm.toDate().toISOString().slice(0,10) : '-';
    (data.itens||[]).forEach(i => {
      // Pizza stats
      if(!pizzaStats[i.nome]) pizzaStats[i.nome] = { qtd:0, total:0 };
      pizzaStats[i.nome].qtd += i.qtd;
      pizzaStats[i.nome].total += i.qtd * i.preco;
      // Daily stats
      if(!dailyStats[date]) dailyStats[date] = { qtd:0, total:0 };
      dailyStats[date].qtd += i.qtd;
      dailyStats[date].total += i.qtd * i.preco;
    });
  });
  // Monta HTML
  let html = '<h3>Relatório de Vendas</h3>';
  html += '<div style="display:flex;gap:32px;flex-wrap:wrap">';
  html += '<div><strong>Por tipo de pizza:</strong><ul>' + Object.entries(pizzaStats).map(([nome,stat]) => `<li>${nome}: ${stat.qtd} vendidas — R$ ${formatBRL(stat.total)}</li>`).join('') + '</ul></div>';
  html += '<div><strong>Resumo diário:</strong><ul>' + Object.entries(dailyStats).map(([dia,stat]) => `<li>${dia}: ${stat.qtd} pizzas — R$ ${formatBRL(stat.total)}</li>`).join('') + '</ul></div>';
  html += '</div>';
  reportsEl.innerHTML = html;
}

// Carrega relatório ao iniciar
loadReports();

// login modal
const modal = q('#modal');
q('#btn-login').addEventListener('click', ()=> { modal.setAttribute('aria-hidden','false'); });
q('#close-modal').addEventListener('click', ()=> modal.setAttribute('aria-hidden','true'));
q('#do-login').addEventListener('click', async ()=>{
  const email = q('#email').value;
  const password = q('#password').value;
  try{
    await signInWithEmailAndPassword(auth, email, password);
    modal.setAttribute('aria-hidden','true');
  }catch(e){
    if(e.code === 'auth/user-not-found'){
      alert('Usuário não encontrado. Clique em Cadastrar para criar.');
    }else{
      alert('Erro login: '+e.message);
    }
  }
});

// Cadastro de novo usuário
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
q('#do-register').addEventListener('click', async ()=>{
  const email = q('#email').value;
  const password = q('#password').value;
  if(!email || !password){ alert('Preencha email e senha.'); return; }
  try{
    await createUserWithEmailAndPassword(auth, email, password);
    alert('Usuário cadastrado com sucesso!');
    modal.setAttribute('aria-hidden','true');
  }catch(e){
    alert('Erro ao cadastrar: '+e.message);
  }
});
q('#btn-logout').addEventListener('click', ()=> signOut(auth));

onAuthStateChanged(auth, user=>{
  if(user){
    q('#btn-login').style.display='none';
    q('#btn-logout').style.display='inline-block';
    q('#orders').style.display = '';
    q('#controls').style.display = '';
    listenRealtime();
  }else{
    q('#btn-login').style.display='inline-block';
    q('#btn-logout').style.display='none';
    q('#orders').style.display = 'none';
    q('#controls').style.display = 'none';
    if(unsubscribe) unsubscribe();
    ordersEl.innerHTML = '';
  }
});

// start
loadOnce();


// ======== FCM Token Registration ========
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging.js";

const messaging = getMessaging(app);

async function registerKitchenToken() {
  try {
    const currentToken = await getToken(messaging, { vapidKey: "AIzaSyAM6eaqF763bjoeXQV5kECkzed9ZqkLiLs" });
    if (currentToken) {
      console.log("FCM Token:", currentToken);
      // Save token to Firestore
      await addDoc(collection(db, "kitchenTokens"), {
        token: currentToken,
        createdAt: serverTimestamp()
      });
    } else {
      console.warn("Nenhum token disponível. Peça permissão ao usuário.");
    }
  } catch (err) {
    console.error("Erro ao registrar token FCM:", err);
  }
}

// Request Notification permission then register
if (Notification.permission === "granted") {
  registerKitchenToken();
} else if (Notification.permission !== "denied") {
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      registerKitchenToken();
    }
  });
}

// Listener para mensagens recebidas enquanto app está aberto
onMessage(messaging, (payload) => {
  console.log("Mensagem recebida em primeiro plano:", payload);
  alert(`Nova notificação: ${payload.notification?.title} - ${payload.notification?.body}`);
});
