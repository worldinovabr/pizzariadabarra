// Navigation buttons logic
const btnPedidos = document.getElementById('btn-pedidos');
const btnRelatorio = document.getElementById('btn-relatorio');

// Create a section for sales report if not present
let reportSection = document.getElementById('sales-report');
if (!reportSection) {
  reportSection = document.createElement('section');
  reportSection.id = 'sales-report';
  reportSection.style.display = 'none';
  reportSection.innerHTML = `
    <h2>Relatório de Vendas</h2>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:18px">
      <label>De: <input type="date" id="report-date-start"></label>
      <label>Até: <input type="date" id="report-date-end"></label>
      <button id="btn-filtrar-relatorio" class="dashboard-btn">Filtrar</button>
    </div>
    <div id="report-content">Selecione para visualizar o relatório.</div>
  `;
  document.querySelector('main').appendChild(reportSection);
}

btnPedidos.addEventListener('click', () => {
  document.getElementById('orders').style.display = '';
  document.querySelector('.controls').style.display = '';
  reportSection.style.display = 'none';
  btnPedidos.classList.add('active');
  btnRelatorio.classList.remove('active');
});

btnRelatorio.addEventListener('click', () => {
  document.getElementById('orders').style.display = 'none';
  document.querySelector('.controls').style.display = 'none';
  reportSection.style.display = '';
  loadSalesReport();
  btnRelatorio.classList.add('active');
  btnPedidos.classList.remove('active');
});

async function loadSalesReport() {
  const qref = query(collection(db,'pedidos'), orderBy('criadoEm','desc'));
  const snap = await getDocs(qref);
  let total = 0;
  let count = 0;
  let mesas = new Set();
  let pedidosFinalizados = [];
  let pizzaResumo = {};
  // Get date filter values
  const startDateEl = document.getElementById('report-date-start');
  const endDateEl = document.getElementById('report-date-end');
  let startDate = startDateEl && startDateEl.value ? new Date(startDateEl.value) : null;
  let endDate = endDateEl && endDateEl.value ? new Date(endDateEl.value) : null;
  if (endDate) endDate.setHours(23,59,59,999);
  snap.docs.forEach(d => {
    const data = d.data();
    if(data.status === 'entregue') {
      const created = data.criadoEm && data.criadoEm.toDate ? data.criadoEm.toDate() : null;
      if (created && startDate && created < startDate) return;
      if (created && endDate && created > endDate) return;
      count++;
      mesas.add(data.mesa);
      (data.itens||[]).forEach(i => {
        total += (i.preco * i.qtd);
        // Resumo por tipo de pizza
        if (!pizzaResumo[i.nome]) pizzaResumo[i.nome] = { qtd: 0, valor: 0 };
        pizzaResumo[i.nome].qtd += i.qtd;
        pizzaResumo[i.nome].valor += i.preco * i.qtd;
      });
      pedidosFinalizados.push({
        mesa: data.mesa,
        criadoEm: created ? created.toLocaleString() : '-',
        itens: data.itens || [],
        total: (data.itens||[]).reduce((acc,i)=>acc+i.preco*i.qtd,0)
      });
    }
  });
  let pizzaTable = '';
  if (Object.keys(pizzaResumo).length) {
    pizzaTable = `<table style="width:100%;margin:18px 0;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(216,67,21,0.06)">
      <thead><tr><th style="text-align:left;padding:8px 12px;color:#d84315">Tipo de Pizza</th><th>Qtd</th><th>Valor</th></tr></thead>
      <tbody>
        ${Object.entries(pizzaResumo).map(([nome,info])=>`<tr><td style="padding:8px 12px">${nome}</td><td style="text-align:center">${info.qtd}</td><td style="text-align:right">R$ ${formatBRL(info.valor)}</td></tr>`).join('')}
      </tbody>
    </table>`;
  }
  let pedidosHtml = '';
  if (pedidosFinalizados.length) {
    pedidosHtml = `<h4 style="margin-top:24px">Pedidos Finalizados</h4>` + pedidosFinalizados.map(p => `
      <div style="background:#fff6f0;padding:12px 18px;margin-bottom:12px;border-radius:12px;box-shadow:0 2px 8px rgba(216,67,21,0.06)">
        <b>Mesa ${p.mesa}</b> <span style="color:#888">${p.criadoEm}</span><br>
        <ul style="margin:8px 0 0 0;padding:0 0 0 18px;">
          ${p.itens.map(i=>`<li>${i.qtd}× ${i.nome} — R$ ${formatBRL(i.preco)}</li>`).join('')}
        </ul>
        <div style="margin-top:8px;font-weight:700;color:#d84315">Total: R$ ${formatBRL(p.total)}</div>
      </div>
    `).join('');
  }
  const html = `<div style="padding:18px 0">
    <h3>Resumo de Vendas</h3>
    <p><b>Pedidos entregues:</b> ${count}</p>
    <p><b>Mesas atendidas:</b> ${mesas.size}</p>
    ${pizzaTable}
    <p style="font-size:1.2rem;font-weight:700;color:#d84315;margin-top:18px">Valor total vendido: R$ ${formatBRL(total)}</p>
    ${pedidosHtml}
  </div>`;
  document.getElementById('report-content').innerHTML = html;
}

// Add filter button event
setTimeout(() => {
  const btnFiltrar = document.getElementById('btn-filtrar-relatorio');
  if (btnFiltrar) {
    btnFiltrar.onclick = () => loadSalesReport();
  }
}, 500);
// dashboard-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, getDocs, updateDoc, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
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
        <button data-action="finalizar" class="primary" style="background:linear-gradient(90deg,#4caf50,#388e3c);color:#fff;margin-left:8px;">Finalizar</button>
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
    el.querySelector('[data-action="finalizar"]').addEventListener('click', ()=> finalizeOrder(id));
  });

async function finalizeOrder(id){
  const ref = doc(db, 'pedidos', id);
  await updateDoc(ref, { status: 'entregue' });
}
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
refreshBtn.addEventListener('click', ()=> loadOnce());
autoCheckbox.addEventListener('change', ()=> {
  if(autoCheckbox.checked) listenRealtime();
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

// login modal

const modal = q('#modal');
q('#btn-login').addEventListener('click', ()=> {
  modal.setAttribute('aria-hidden','false');
  q('#email').focus();
});
q('#close-modal').addEventListener('click', ()=> {
  modal.setAttribute('aria-hidden','true');
  q('#email').value = '';
  q('#password').value = '';
});
q('#do-login').addEventListener('click', async ()=>{
  const email = q('#email').value.trim();
  const password = q('#password').value.trim();
  if(!email || !password){
    alert('Preencha email e senha.');
    return;
  }
  try{
    await signInWithEmailAndPassword(auth, email, password);
    modal.setAttribute('aria-hidden','true');
    q('#email').value = '';
    q('#password').value = '';
  }catch(e){
    if(e.code === 'auth/user-not-found'){
      alert('Usuário não encontrado. Solicite cadastro ao administrador.');
    }else if(e.code === 'auth/wrong-password'){
      alert('Senha incorreta.');
    }else{
      alert('Erro login: '+e.message);
    }
  }
});
q('#btn-logout').addEventListener('click', ()=> {
  signOut(auth);
  modal.setAttribute('aria-hidden','true');
  q('#email').value = '';
  q('#password').value = '';
});

onAuthStateChanged(auth, user=>{
  if(user){
  q('#btn-login').classList.add('hidden');
  q('#btn-logout').classList.remove('hidden');
    q('#modal').setAttribute('aria-hidden','true');
    document.querySelector('.controls').style.display = '';
    document.querySelector('#orders').style.display = '';
    listenRealtime();
  }else{
  q('#btn-login').classList.remove('hidden');
  q('#btn-logout').classList.add('hidden');
    q('#modal').setAttribute('aria-hidden','false');
    document.querySelector('.controls').style.display = 'none';
    document.querySelector('#orders').style.display = 'none';
    // Limpa campos do modal
    q('#email').value = '';
    q('#password').value = '';
  }
});

// start
loadOnce();
btnPedidos.classList.add('active');


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
