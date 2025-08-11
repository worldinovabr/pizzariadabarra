// client-app.js - Pizzaria da Barra (cliente)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// firebase config placeholder - substitua
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const menu = [
  {id:1,name:"Margherita",desc:"Molho, mussarela e manjericão",price:29.9,category:"Tradicionais",img:"/assets/pizza1.png"},
  {id:2,name:"Calabresa",desc:"Calabresa, cebola, azeitonas",price:34.9,category:"Tradicionais",img:"/assets/pizza2.png"},
  {id:3,name:"Quatro Queijos",desc:"Mussarela, provolone, gorgonzola, parmesão",price:39.9,category:"Especiais",img:"/assets/pizza3.png"},
  {id:4,name:"Pepperoni",desc:"Pepperoni picante",price:41.9,category:"Picantes",img:"/assets/pizza4.png"}
];

const state = { table:null, cart:[], menu };

function q(s){return document.querySelector(s)}
function formatBRL(v){return v.toFixed(2).replace('.',',')}

function init(){
  renderCategories();
  renderMenu(menu);
  setupHandlers();
  loadState();
  const urlTable = (new URLSearchParams(location.search)).get('table');
  if(urlTable) setTable(urlTable);
  else if(!state.table) askTable();
  updateCartUI();
  // try to send queued orders when online
  window.addEventListener('online', sendQueued);
}

function renderCategories(){
  const sel = q('#category-filter');
  const cats = ['all', ...new Set(menu.map(m=>m.category))];
  sel.innerHTML = cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  sel.addEventListener('change', ()=> filterAndRender());
  q('#search').addEventListener('input', ()=> filterAndRender());
}

function filterAndRender(){
  const sel = q('#category-filter').value;
  const search = q('#search').value.trim().toLowerCase();
  const list = menu.filter(m=> (sel==='all'||m.category===sel) && (m.name.toLowerCase().includes(search)||m.desc.toLowerCase().includes(search)));
  renderMenu(list);
}

function renderMenu(items){
  const container = q('#menu');
  container.innerHTML = items.map(item=>`
    <article class="card" data-id="${item.id}">
      <img src="${item.img}" alt="${item.name}" loading="lazy"/>
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <div class="price">R$ ${formatBRL(item.price)}</div>
      <div class="actions">
        <button class="button" data-action="details">Ver</button>
        <button class="primary" data-action="add">Adicionar</button>
      </div>
    </article>
  `).join('');
  container.querySelectorAll('.card').forEach(card=>{
    card.querySelector('[data-action="add"]').addEventListener('click', ()=> {
      addToCart(Number(card.dataset.id));
    });
    card.querySelector('[data-action="details"]').addEventListener('click', ()=> {
      const it = menu.find(m=>m.id===Number(card.dataset.id));
      alert(it.name + "\n\n" + it.desc + "\n\nR$ " + formatBRL(it.price));
    });
  });
}

function addToCart(id){
  const it = menu.find(m=>m.id===id);
  const exists = state.cart.find(c=>c.id===id);
  if(exists) exists.qty++;
  else state.cart.push({...it, qty:1});
  saveState();
  updateCartUI();
  showToast('Item adicionado');
}

function updateCartUI(){
  q('#cart-count').textContent = state.cart.reduce((s,i)=>s+i.qty,0);
  const list = q('#cart-items');
  if(!list) return;
  list.innerHTML = state.cart.map(it=>`
    <div class="cart-item" data-id="${it.id}">
      <img src="${it.img}" alt="${it.name}"/>
      <div style="flex:1">
        <div><strong>${it.name}</strong></div>
        <div style="font-size:13px;color:#666">R$ ${formatBRL(it.price)} × ${it.qty}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <div>
          <button data-action="dec">−</button>
          <button data-action="inc">+</button>
          <button data-action="remove">Remover</button>
        </div>
        <div style="font-weight:700">R$ ${formatBRL(it.price*it.qty)}</div>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.cart-item').forEach(el=>{
    const id = Number(el.dataset.id);
    el.querySelector('[data-action="inc"]').addEventListener('click', ()=> { changeQty(id,1); });
    el.querySelector('[data-action="dec"]').addEventListener('click', ()=> { changeQty(id,-1); });
    el.querySelector('[data-action="remove"]').addEventListener('click', ()=> { removeItem(id); });
  });
  const total = state.cart.reduce((s,i)=>s+i.qty*i.price,0);
  q('#total-price').textContent = formatBRL(total);
  q('#confirm-order').disabled = state.cart.length===0 || !state.table;
  q('#send-now').disabled = state.cart.length===0 || !state.table;
}

function changeQty(id,delta){
  const it = state.cart.find(c=>c.id===id);
  if(!it) return;
  it.qty += delta;
  if(it.qty<=0) state.cart = state.cart.filter(c=>c.id!==id);
  saveState();
  updateCartUI();
}

function removeItem(id){
  state.cart = state.cart.filter(c=>c.id!==id);
  saveState();
  updateCartUI();
}

function setupHandlers(){
  q('#open-cart').addEventListener('click', ()=> q('#cart').setAttribute('aria-hidden','false'));
  q('#close-cart').addEventListener('click', ()=> q('#cart').setAttribute('aria-hidden','true'));
  q('#change-table').addEventListener('click', askTable);
  q('#confirm-order').addEventListener('click', confirmAndSend);
  q('#print-order').addEventListener('click', ()=> window.print());
  q('#send-now').addEventListener('click', sendNow);
}

function askTable(){
  const t = prompt('Informe o número da mesa (ex: 5):', state.table || '');
  if(t && t.trim()){
    setTable(t.trim());
    saveState();
    showToast('Mesa definida: ' + state.table);
  }
}

function setTable(t){
  state.table = t;
  q('#table-number').textContent = t;
  const url = new URL(location.href);
  url.searchParams.set('table', t);
  history.replaceState({},'',url);
  saveState();
  updateCartUI();
}

function confirmAndSend(){
  q('#cart').setAttribute('aria-hidden','false');
  showToast('Revise o pedido e clique em Enviar agora');
}

async function sendNow(){
  if(!state.table || state.cart.length===0) return;
  const pedido = {
    mesa: state.table,
    itens: state.cart.map(i=>({nome:i.name,qtd:i.qty,preco:i.price})),
    total: state.cart.reduce((s,i)=>s+i.qty*i.price,0),
    status: 'pendente',
    criadoEm: serverTimestamp()
  };
  try{
    if(navigator.onLine){
      await addDoc(collection(db,'pedidos'), pedido);
      state.cart = [];
      saveState();
      updateCartUI();
      showToast('Pedido enviado — obrigado!');
    }else{
      queueOrder(pedido);
      state.cart = [];
      saveState();
      updateCartUI();
      showToast('Sem conexão — pedido enfileirado e será enviado ao voltar online');
    }
  }catch(err){
    console.error(err);
    queueOrder(pedido);
    state.cart = [];
    saveState();
    updateCartUI();
    showToast('Ocorreu um erro. Pedido enfileirado.');
  }
}

function saveState(){ localStorage.setItem('pdb_state', JSON.stringify({table:state.table,cart:state.cart})); }
function loadState(){ try{ const raw = localStorage.getItem('pdb_state'); if(!raw) return; const obj = JSON.parse(raw); state.table = obj.table||state.table; state.cart = obj.cart||state.cart; if(state.table) q('#table-number').textContent=state.table;}catch(e){} }

function showToast(txt, time=2500){ const t=q('#toast'); t.textContent=txt; t.style.opacity='1'; t.style.pointerEvents='auto'; setTimeout(()=>{ t.style.opacity='0'; t.style.pointerEvents='none'; }, time); }

// queue for offline orders
function queueOrder(pedido){
  const key = 'pdb_queue';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push({...pedido, _queuedAt: Date.now()});
  localStorage.setItem(key, JSON.stringify(arr));
}

async function sendQueued(){
  const key = 'pdb_queue';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  if(!arr.length) return;
  try{
    for(const p of arr){
      // replace serverTimestamp with Date.now() fallback
      await addDoc(collection(db,'pedidos'), { ...p, criadoEm: serverTimestamp() });
    }
    localStorage.removeItem(key);
    showToast('Pedidos enfileirados enviados');
  }catch(e){
    console.error('Erro ao enviar enfileirados', e);
  }
}

init();
