/* ===== CloudDreams · lógica ===== */
const LS_KEY = 'clouddreams_extra_vapes';

// vapes adicionados pelo utilizador (guardados no navegador)
function loadExtra(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(e){ return []; } }
function saveExtra(list){ localStorage.setItem(LS_KEY, JSON.stringify(list)); }

function allVapes(){
  const base = (window.VAPES_BASE || []).slice();
  const extra = loadExtra();
  return base.concat(extra);
}

/* ---------- helpers ---------- */
const fmtEur = n => (n||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const fmtNum = n => (n||0).toLocaleString('pt-PT');
function daysBetween(a,b){ if(!a||!b) return null; return Math.round((new Date(b)-new Date(a))/864e5); }
function ptDate(iso){ if(!iso) return '—'; const d=new Date(iso); return d.toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'2-digit'}); }
function mode(arr){ const m={}; let best=null,bc=0; arr.forEach(x=>{ if(!x) return; m[x]=(m[x]||0)+1; if(m[x]>bc){bc=m[x];best=x;} }); return {value:best,count:bc}; }

/* ---------- stats ---------- */
function computeStats(){
  const v = allVapes();
  const totalGasto = v.reduce((s,x)=>s+(x.preco||0),0);
  const totalPuffs = v.reduce((s,x)=>s+(typeof x.puffs==='number'?x.puffs:0),0);
  const durados = v.filter(x=>x.dias!=null && x.dias>0);
  const avgDias = durados.length ? durados.reduce((s,x)=>s+x.dias,0)/durados.length : 0;
  const longest = durados.slice().sort((a,b)=>b.dias-a.dias)[0];
  const marca = mode(v.map(x=>x.marca));
  const sabor = mode(v.map(x=>x.sabor));
  // dias entre o 1º e o último início
  const dates = v.map(x=>x.comeco).filter(Boolean).sort();
  const span = dates.length>1 ? daysBetween(dates[0], dates[dates.length-1]) : 0;
  const meses = span/30.44;
  return { count:v.length, totalGasto, totalPuffs, avgDias, longest, marca, sabor, span, meses };
}

function renderStats(){
  const s = computeStats();
  const cafes = Math.round(s.totalGasto/1.2); // €1.20 por café
  const cards = [
    {ic:'💨', lbl:'Vapes comprados', val:fmtNum(s.count), sub:`em ${Math.round(s.meses)} meses`},
    {ic:'💸', lbl:'Total gasto', val:fmtEur(s.totalGasto), sub:`≈ ${cafes} cafés ☕`, accent:true},
    {ic:'🌬️', lbl:'Puffs totais', val:fmtNum(s.totalPuffs), sub:'baforadas registadas'},
    {ic:'⏳', lbl:'Duração média', val:Math.round(s.avgDias)+' dias', sub:'por vape'},
    {ic:'🏆', lbl:'Durou mais', val:(s.longest?s.longest.dias+' dias':'—'), sub:s.longest?`${s.longest.marca} · ${s.longest.sabor}`:''},
    {ic:'🏷️', lbl:'Marca favorita', val:s.marca.value||'—', sub:`${s.marca.count}× comprada`},
  ];
  document.getElementById('stats').innerHTML = cards.map(c=>`
    <div class="stat ${c.accent?'accent':''}">
      <div class="ic">${c.ic}</div>
      <div class="lbl">${c.lbl}</div>
      <div class="val">${c.val}</div>
      <div class="sub">${c.sub||''}</div>
    </div>`).join('');
}

/* ---------- charts ---------- */
let charts = {};
const GRID = 'rgba(120,140,200,.10)', TICK = '#8b95c4';
Chart.defaults.color = TICK;
Chart.defaults.font.family = "-apple-system,Inter,sans-serif";

function makeGradient(ctx, c1, c2){
  const g = ctx.createLinearGradient(0,0,0,280);
  g.addColorStop(0,c1); g.addColorStop(1,c2); return g;
}

function renderCharts(){
  Object.values(charts).forEach(c=>c.destroy());
  const v = allVapes().filter(x=>x.comeco).sort((a,b)=>a.comeco.localeCompare(b.comeco));

  // 1) gasto acumulado
  let acc=0;
  const spendData = v.map(x=>{ acc+=(x.preco||0); return {x:x.comeco, y:acc}; });
  const ctx1 = document.getElementById('spendChart').getContext('2d');
  charts.spend = new Chart(ctx1,{
    type:'line',
    data:{ datasets:[{ data:spendData, borderColor:'#7c5cff', borderWidth:3,
      backgroundColor:makeGradient(ctx1,'rgba(124,92,255,.35)','rgba(124,92,255,0)'),
      fill:true, tension:.3, pointRadius:3, pointBackgroundColor:'#22d3ee', pointHoverRadius:6 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{
        title:i=>ptDate(i[0].raw.x), label:i=>'Acumulado: '+fmtEur(i.raw.y)}}},
      scales:{
        x:{type:'time',time:{unit:'month'},grid:{color:GRID},ticks:{maxRotation:0}},
        y:{grid:{color:GRID},ticks:{callback:v=>'€'+v}}
      } }
  });

  // 2) por marca
  const bm = {};
  allVapes().forEach(x=>{ bm[x.marca]=(bm[x.marca]||0)+1; });
  const brands = Object.entries(bm).sort((a,b)=>b[1]-a[1]);
  const palette = ['#7c5cff','#22d3ee','#ff5c9d','#ffd166','#4ade80','#ff6b6b','#a78bfa','#38bdf8','#fb923c','#f472b6'];
  const ctx2 = document.getElementById('brandChart').getContext('2d');
  charts.brand = new Chart(ctx2,{
    type:'doughnut',
    data:{ labels:brands.map(b=>b[0]), datasets:[{ data:brands.map(b=>b[1]),
      backgroundColor:brands.map((_,i)=>palette[i%palette.length]), borderColor:'#0d1020', borderWidth:2 }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%',
      plugins:{legend:{position:'right',labels:{boxWidth:12,padding:9,font:{size:11}}}} }
  });

  // 3) duração
  const dv = v.filter(x=>x.dias!=null);
  const ctx3 = document.getElementById('daysChart').getContext('2d');
  charts.days = new Chart(ctx3,{
    type:'bar',
    data:{ labels:dv.map(x=>ptDate(x.comeco)), datasets:[{ data:dv.map(x=>x.dias),
      backgroundColor:dv.map(x=>makeGradient(ctx3,'#22d3ee','rgba(124,92,255,.5)')),
      borderRadius:5 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{
        title:i=>{const x=dv[i[0].dataIndex]; return x.marca+' · '+x.sabor;},
        label:i=>i.raw+' dias'}}},
      scales:{ x:{grid:{display:false},ticks:{maxRotation:60,minRotation:60,font:{size:9}}},
        y:{grid:{color:GRID},ticks:{callback:v=>v+'d'}} } }
  });
}

/* ---------- table ---------- */
function fillBrandFilter(){
  const sel = document.getElementById('brandFilter');
  const brands = [...new Set(allVapes().map(x=>x.marca))].sort();
  sel.innerHTML = '<option value="">Todas as marcas</option>' + brands.map(b=>`<option>${b}</option>`).join('');
}

function render(){
  const q = document.getElementById('search').value.toLowerCase().trim();
  const bf = document.getElementById('brandFilter').value;
  const sort = document.getElementById('sortSel').value;
  let v = allVapes().map((x,i)=>({...x, _n:i+1}));

  if(q) v = v.filter(x=>[x.marca,x.sabor,x.nota].filter(Boolean).join(' ').toLowerCase().includes(q));
  if(bf) v = v.filter(x=>x.marca===bf);

  const sorters = {
    comeco:(a,b)=>(b.comeco||'').localeCompare(a.comeco||''),
    comecoAsc:(a,b)=>(a.comeco||'').localeCompare(b.comeco||''),
    dias:(a,b)=>(b.dias||0)-(a.dias||0),
    diasAsc:(a,b)=>(a.dias||0)-(b.dias||0),
    preco:(a,b)=>(b.preco||0)-(a.preco||0),
    puffs:(a,b)=>(b.puffs||0)-(a.puffs||0),
  };
  v.sort(sorters[sort]||sorters.comeco);

  document.getElementById('count').textContent = `(${v.length})`;
  document.getElementById('tbody').innerHTML = v.map(x=>{
    const active = !x.fim;
    const preco = x.preco>0 ? fmtEur(x.preco) : '<span class="free">grátis</span>';
    const puffs = typeof x.puffs==='number' ? fmtNum(x.puffs) : '<span class="tag">recarregável</span>';
    const durou = active ? '<span class="active-badge">em uso</span>' : (x.dias!=null?x.dias+' dias':'—');
    return `<tr>
      <td class="tag">#${x._n}</td>
      <td><span class="pill">${x.marca}</span></td>
      <td><span class="flavor">${x.sabor}</span></td>
      <td>${puffs}</td>
      <td>${ptDate(x.comeco)}</td>
      <td>${ptDate(x.fim)}</td>
      <td>${durou}</td>
      <td>${preco}</td>
      <td class="tag">${x.nota||'—'}</td>
    </tr>`;
  }).join('');
}

/* ---------- add modal ---------- */
function openAdd(){
  document.getElementById('f_comeco').value = new Date().toISOString().slice(0,10);
  document.getElementById('addOverlay').classList.add('show');
}
function closeAdd(){ document.getElementById('addOverlay').classList.remove('show'); }

function saveVape(){
  const marca = document.getElementById('f_marca').value.trim();
  const sabor = document.getElementById('f_sabor').value.trim();
  if(!marca || !sabor){ alert('Mete pelo menos marca e sabor 😉'); return; }
  const puffs = parseInt(document.getElementById('f_puffs').value)||null;
  const preco = parseFloat(document.getElementById('f_preco').value)||0;
  const comeco = document.getElementById('f_comeco').value||null;
  const fim = document.getElementById('f_fim').value||null;
  const nota = document.getElementById('f_nota').value.trim()||null;
  const dias = daysBetween(comeco,fim);

  const extra = loadExtra();
  extra.push({ id:'x'+Date.now(), marca, sabor, puffs, preco, comeco, fim, dias, entre:null, nota, user:true });
  saveExtra(extra);

  // limpar form
  ['f_marca','f_sabor','f_puffs','f_preco','f_fim','f_nota'].forEach(id=>document.getElementById(id).value='');
  closeAdd();
  refresh();
  puffAnimation();
  showFunny();
}

/* ---------- FUNNY POPUP ---------- */
const FUNNY = [
  {e:'🚭', t:'Outra vez?!', m:'Raul, o teu pulmão ligou. Deixou mensagem de voz: só ouvia-se tosse. 📞'},
  {e:'💸', t:'Aí vai mais um', m:'A esta velocidade, a Vapsolo devia pôr o teu nome numa loja. "Raul — Sócio Fundador". 🏪'},
  {e:'☁️', t:'Basta de nuvens', m:'Já produziste mais fumo que os incêndios do verão. Os bombeiros agradecem que pares. 🚒'},
  {e:'🫁', t:'Notícia de última hora', m:'Os teus pulmões pediram transferência para outro corpo. Dizem que este tem "condições de trabalho impossíveis". 📰'},
  {e:'🤑', t:'Contabilidade em choque', m:'Com o que já gastaste dava para férias. Em vez disso compraste ar com sabor a morango. Palmas. 👏'},
  {e:'⏰', t:'Recorde pessoal', m:'Novo vape adicionado. O anterior ainda estava quente. Isto é um vício ou uma coleção? 🏅'},
  {e:'🐉', t:'Sr. Dragão', m:'Cospes mais fumo que um dragão de fantasia medieval. Só que o dragão pelo menos não pagava por isso. 🐲'},
  {e:'🛑', t:'PARA. Literalmente.', m:'Este pop-up foi patrocinado pelo teu futuro eu, que está a bater à porta a gritar "PORQUÊÊÊ". 🚪'},
  {e:'🎈', t:'Fôlego edição limitada', m:'Lembras-te de subir escadas sem parar? Pois. Era bom, não era? 🪜'},
  {e:'🧾', t:'Fatura emocional', m:'Cada vape novo é um pequeno abraço à indústria do tabaco. Eles mandam beijinhos. 💋'},
];

function showFunny(){
  const s = computeStats();
  const pick = FUNNY[Math.floor(Math.random()*FUNNY.length)];
  document.getElementById('funnyEmoji').textContent = pick.e;
  document.getElementById('funnyTitle').textContent = pick.t;
  document.getElementById('funnyMsg').textContent = pick.m;
  const cafes = Math.round(s.totalGasto/1.2);
  document.getElementById('funnySmall').innerHTML =
    `📊 Já vais em <b>${s.count} vapes</b> e <b>${fmtEur(s.totalGasto)}</b> — dava para <b>${cafes} cafés</b>. ` +
    `Considera isto um abraço preocupado. 🫂`;
  document.getElementById('funnyOverlay').classList.add('show');
}
function closeFunny(){ document.getElementById('funnyOverlay').classList.remove('show'); }

/* pequena animação de nuvenzinha */
function puffAnimation(){
  for(let i=0;i<6;i++){
    const el = document.createElement('div');
    el.className='puff-cloud'; el.textContent='💨';
    el.style.left = (40+Math.random()*20)+'%';
    el.style.top = '60%';
    document.body.appendChild(el);
    const dx=(Math.random()-.5)*300, dy=-200-Math.random()*200;
    el.animate([
      {transform:'translate(0,0) scale(.5)',opacity:0},
      {opacity:.9,offset:.2},
      {transform:`translate(${dx}px,${dy}px) scale(1.6)`,opacity:0}
    ],{duration:1400+Math.random()*600,easing:'ease-out'}).onfinish=()=>el.remove();
  }
}

/* ---------- boot ---------- */
function refresh(){ renderStats(); fillBrandFilter(); renderCharts(); render(); }
// fechar modais ao clicar fora
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('show'); }));
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); });
refresh();
