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
let lastSavedReportData = null;
let lastSavedOrderIds = [];

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
// Filtros de relatório
const reportFiltersEl = q('#report-filters');
const pizzaTypeFilterEl = q('#pizza-type-filter');
const dateFilterEl = q('#date-filter');
const applyReportFilterBtn = q('#apply-report-filter');

// Preenche tipos de pizza no filtro
function fillPizzaTypeFilter(pizzaStats) {
  const pizzas = Object.keys(pizzaStats);
  pizzaTypeFilterEl.innerHTML = '<option value="">Todas as pizzas</option>' + pizzas.map(p => `<option value="${p}">${p}</option>`).join('');
}

let lastReportData = null;

applyReportFilterBtn.addEventListener('click', () => {
  if (!lastReportData) return;
  const pizzaType = pizzaTypeFilterEl.value;
  const date = dateFilterEl.value;
  renderFilteredReport(lastReportData, pizzaType, date);
});

function renderFilteredReport(reportData, pizzaType, date) {
  let html = `<div class="report-card">
    <h2 style="margin-bottom:16px;color:#d84315">Relatório Filtrado</h2>
    <div style="display:flex;gap:32px;flex-wrap:wrap">`;
  // Pizza
  html += `<div style="background:#fff7f2;padding:18px 24px;border-radius:14px;box-shadow:0 2px 12px rgba(216,67,21,0.08);min-width:260px;">
    <h3 style="color:#d84315;margin-top:0">Por tipo de pizza</h3>
    <table style="width:100%;border-collapse:collapse;font-size:15px;">
      <thead><tr><th style="text-align:left">Pizza</th><th>Qtd</th><th>Total</th></tr></thead>
      <tbody>`;
  Object.entries(reportData.pizzas).forEach(([nome,stat]) => {
    if (pizzaType && nome !== pizzaType) return;
    html += `<tr><td>${nome}</td><td>${stat.qtd}</td><td>R$ ${formatBRL(stat.total)}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  // Dia
  html += `<div style="background:#fff7f2;padding:18px 24px;border-radius:14px;box-shadow:0 2px 12px rgba(216,67,21,0.08);min-width:260px;">
    <h3 style="color:#d84315;margin-top:0">Resumo diário</h3>
    <table style="width:100%;border-collapse:collapse;font-size:15px;">
      <thead><tr><th style="text-align:left">Dia</th><th>Qtd</th><th>Total</th></tr></thead>
      <tbody>`;
  Object.entries(reportData.dias).forEach(([dia,stat]) => {
    if (date && dia !== date) return;
    html += `<tr><td>${dia}</td><td>${stat.qtd}</td><td>R$ ${formatBRL(stat.total)}</td></tr>`;
  });
  html += `</tbody></table></div></div></div>`;
  reportsEl.innerHTML = html;
}
const reportsEl = document.getElementById('reports');
const btnReport = q('#btn-report');
const btnSavedReports = document.createElement('button');
btnSavedReports.textContent = 'Relatórios Salvos';
btnSavedReports.style.marginRight = '12px';
btnSavedReports.style.display = 'none';
q('.user-area').insertBefore(btnSavedReports, btnReport);

btnSavedReports.addEventListener('click', showSavedReports);

async function showSavedReports() {
  // Busca relatórios salvos
  const qref = query(collection(db, 'relatorios'), orderBy('criadoEm', 'desc'));
  const snap = await getDocs(qref);
  let html = `<div class="report-card">
    <h2 style="margin-bottom:16px;color:#d84315">Relatórios Salvos</h2>
    <div style="display:flex;gap:32px;flex-wrap:wrap">`;
  snap.forEach(doc => {
    const data = doc.data();
    html += `<div style="background:#fff7f2;padding:18px 24px;border-radius:14px;box-shadow:0 2px 12px rgba(216,67,21,0.08);min-width:260px;margin-bottom:18px;">
      <h3 style="color:#d84315;margin-top:0">${data.criadoEm && data.criadoEm.toDate ? data.criadoEm.toDate().toLocaleString() : '-'}</h3>
      <strong>Por tipo de pizza:</strong>
      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        <thead><tr><th style="text-align:left">Pizza</th><th>Qtd</th><th>Total</th></tr></thead>
        <tbody>
          ${data.pizzas ? Object.entries(data.pizzas).map(([nome,stat]) => `<tr><td>${nome}</td><td>${stat.qtd}</td><td>R$ ${formatBRL(stat.total)}</td></tr>`).join('') : ''}
        </tbody>
      </table>
      <strong>Resumo diário:</strong>
      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        <thead><tr><th style="text-align:left">Dia</th><th>Qtd</th><th>Total</th></tr></thead>
        <tbody>
          ${data.dias ? Object.entries(data.dias).map(([dia,stat]) => `<tr><td>${dia}</td><td>${stat.qtd}</td><td>R$ ${formatBRL(stat.total)}</td></tr>`).join('') : ''}
        </tbody>
      </table>
    </div>`;
  });
  html += '</div></div>';
  reportsEl.innerHTML = html;
  reportsEl.style.display = '';
  ordersEl.style.display = 'none';
  btnReport.textContent = 'Relatório';
}

// Mostra/oculta relatório
btnReport.addEventListener('click', ()=> {
  btnSavedReports.style.display = '';
  showSavedReports();
});

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
  // Coleta IDs dos pedidos atuais
  const currentOrderIds = docs.filter(d => d.data().status !== 'cancelado').map(d => d.id);
  // Só salva se houver pedidos novos
  const isNewOrder = currentOrderIds.some(id => !lastSavedOrderIds.includes(id));
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
  // Salva relatório resumido no Firestore apenas se houver pedido novo e dados diferentes do último salvo
  const currentReportData = JSON.stringify({pizzas: pizzaStats, dias: dailyStats});
  if(isNewOrder && currentOrderIds.length > 0 && currentReportData !== lastSavedReportData) {
    saveReportToFirestore({
      criadoEm: new Date(),
      pizzas: pizzaStats,
      dias: dailyStats
    });
    lastSavedOrderIds = currentOrderIds;
    lastSavedReportData = currentReportData;
  }
  // Preenche filtro de pizza
  fillPizzaTypeFilter(pizzaStats);
  // Salva dados para filtro
  lastReportData = { pizzas: pizzaStats, dias: dailyStats };
  // Mostra filtros
  reportFiltersEl.style.display = '';
  // Monta HTML padrão
  let html = `<div class="report-card">
    <h2 style="margin-bottom:16px;color:#d84315">Relatório de Vendas</h2>
    <div style="display:flex;gap:32px;flex-wrap:wrap">
      <div style="background:#fff7f2;padding:18px 24px;border-radius:14px;box-shadow:0 2px 12px rgba(216,67,21,0.08);min-width:260px;">
        <h3 style="color:#d84315;margin-top:0">Por tipo de pizza</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <thead><tr><th style="text-align:left">Pizza</th><th>Qtd</th><th>Total</th></tr></thead>
          <tbody>
            ${Object.entries(pizzaStats).map(([nome,stat]) => `<tr><td>${nome}</td><td>${stat.qtd}</td><td>R$ ${formatBRL(stat.total)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="background:#fff7f2;padding:18px 24px;border-radius:14px;box-shadow:0 2px 12px rgba(216,67,21,0.08);min-width:260px;">
        <h3 style="color:#d84315;margin-top:0">Resumo diário</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <thead><tr><th style="text-align:left">Dia</th><th>Qtd</th><th>Total</th></tr></thead>
          <tbody>
            ${Object.entries(dailyStats).map(([dia,stat]) => `<tr><td>${dia}</td><td>${stat.qtd}</td><td>R$ ${formatBRL(stat.total)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  reportsEl.innerHTML = html;
}

// Função para salvar relatório resumido no Firestore
import { addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
async function saveReportToFirestore(report) {
  try {
    await addDoc(collection(db, "relatorios"), {
      ...report,
      criadoEm: serverTimestamp()
    });
  } catch (e) {
    console.warn("Erro ao salvar relatório:", e);
  }
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
    // Usuário autenticado: mostra dashboard
    q('#modal').setAttribute('aria-hidden','true');
    q('#btn-login').style.display='none';
    q('#btn-logout').style.display='inline-block';
    btnReport.style.display = 'inline-block';
    btnSavedReports.style.display = 'inline-block';
    q('#orders').style.display = '';
    q('#controls').style.display = '';
    reportsEl.style.display = 'none';
    listenRealtime();
  }else{
    // Usuário não autenticado: mostra apenas modal de login
    q('#modal').setAttribute('aria-hidden','false');
    q('#btn-login').style.display='inline-block';
    q('#btn-logout').style.display='none';
    btnReport.style.display = 'none';
    btnSavedReports.style.display = 'none';
    q('#orders').style.display = 'none';
    q('#controls').style.display = 'none';
    reportsEl.style.display = 'none';
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
