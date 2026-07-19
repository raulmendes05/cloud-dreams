/* ===== CloudDreams · lógica ===== */
const LS_KEY = 'clouddreams_extra_vapes';
const LS_PHOTOS = 'clouddreams_photos';
const LS_OVERRIDES = 'clouddreams_overrides'; // alterações a vapes existentes (ex: data de fim)

// vapes adicionados pelo utilizador (guardados no navegador)
function loadExtra(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(e){ return []; } }
function saveExtra(list){ localStorage.setItem(LS_KEY, JSON.stringify(list)); }

// overrides: permitem terminar/editar qualquer vape (mesmo os da base) sem tocar no Excel
function loadOverrides(){ try { return JSON.parse(localStorage.getItem(LS_OVERRIDES)) || {}; } catch(e){ return {}; } }
function saveOverrides(map){ localStorage.setItem(LS_OVERRIDES, JSON.stringify(map)); }

/* ---------- fotos (guardadas no navegador, encolhidas) ---------- */
function loadPhotos(){ try { return JSON.parse(localStorage.getItem(LS_PHOTOS)) || {}; } catch(e){ return {}; } }
function savePhotos(map){
  try { localStorage.setItem(LS_PHOTOS, JSON.stringify(map)); return true; }
  catch(e){ alert('Sem espaço para guardar mais fotos no navegador 😬 (tenta remover algumas).'); return false; }
}
function getPhoto(vape){ const p = loadPhotos(); return p[vape.id] || vape.foto || null; }
function setPhoto(id, dataUrl){ const p = loadPhotos(); p[id] = dataUrl; if(savePhotos(p)) refresh(); }
function removePhoto(id){ const p = loadPhotos(); delete p[id]; savePhotos(p); refresh(); }

// encolhe a imagem para no máx. 600px e comprime em JPEG (poupa muito espaço)
function resizeImage(file, maxDim=600, quality=0.72){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        let {width:w, height:h} = img;
        if(w>h && w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; }
        else if(h>=w && h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; }
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

function allVapes(){
  const base = (window.VAPES_BASE || []).slice();
  const extra = loadExtra();
  const ov = loadOverrides();
  return base.concat(extra).map(v => ov[v.id] ? {...v, ...ov[v.id]} : v);
}

/* ---------- helpers ---------- */
const fmtEur = n => (n||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const fmtNum = n => (n||0).toLocaleString('pt-PT');
function daysBetween(a,b){ if(!a||!b) return null; return Math.round((new Date(b)-new Date(a))/864e5); }
function ptDate(iso){ if(!iso) return '—'; const d=new Date(iso); return d.toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'2-digit'}); }
function mode(arr){ const m={}; let best=null,bc=0; arr.forEach(x=>{ if(!x) return; m[x]=(m[x]||0)+1; if(m[x]>bc){bc=m[x];best=x;} }); return {value:best,count:bc}; }

/* ---------- pausas entre vapes (quanto tempo sem vape) ---------- */
// devolve um mapa { id: dias de pausa antes deste vape }.
// pausa = dias entre o FIM do vape anterior e o INÍCIO deste.
// >0 = aguentou sem vape; <0 = sobrepôs-se (comprou antes de acabar o anterior)
function computeGaps(){
  const v = allVapes().filter(x=>x.comeco).sort((a,b)=>a.comeco.localeCompare(b.comeco));
  const map = {};
  for(let i=1;i<v.length;i++){
    const prev = v[i-1], cur = v[i];
    map[cur.id] = prev.fim ? daysBetween(prev.fim, cur.comeco) : null;
  }
  return map;
}

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

  // pausas: recorde e total sem vape
  const gaps = computeGaps();
  const vById = {}; allVapes().forEach(v=>vById[v.id]=v);
  let recorde = 0, recordeVape = null, totalSemVape = 0;
  Object.entries(gaps).forEach(([id,g])=>{
    if(g!=null && g>0){ totalSemVape += g; if(g>recorde){ recorde=g; recordeVape=vById[id]; } }
  });

  const cards = [
    {ic:'💸', lbl:'Total gasto', val:fmtEur(s.totalGasto), sub:`≈ ${cafes} cafés ☕`, accent:true, wide:true},
    {ic:'💨', lbl:'Vapes comprados', val:fmtNum(s.count), sub:`em ${Math.round(s.meses)} meses`},
    {ic:'🏅', lbl:'Recorde sem vape', val:recorde+' dias', sub:recordeVape?`antes do ${recordeVape.marca}`:'—', accent:true, wide:true},
    {ic:'🌬️', lbl:'Puffs totais', val:fmtNum(s.totalPuffs), sub:'baforadas registadas'},
    {ic:'🏆', lbl:'Durou mais', val:(s.longest?s.longest.dias+' dias':'—'), sub:s.longest?`${s.longest.marca} · ${s.longest.sabor}`:''},
    {ic:'⏳', lbl:'Duração média', val:Math.round(s.avgDias)+' dias', sub:'por vape'},
    {ic:'🏷️', lbl:'Marca favorita', val:s.marca.value||'—', sub:`${s.marca.count}× comprada`},
  ];
  document.getElementById('stats').innerHTML = cards.map(c=>`
    <div class="stat ${c.accent?'accent':''} ${c.wide?'wide':''}">
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
  const gaps = computeGaps();
  let v = allVapes().map((x,i)=>({...x, _n:i+1}));

  if(q) v = v.filter(x=>[x.marca,x.sabor,x.nota].filter(Boolean).join(' ').toLowerCase().includes(q));
  if(bf) v = v.filter(x=>x.marca===bf);

  const sorters = {
    comeco:(a,b)=>(b.comeco||'').localeCompare(a.comeco||''),
    comecoAsc:(a,b)=>(a.comeco||'').localeCompare(b.comeco||''),
    dias:(a,b)=>(b.dias||0)-(a.dias||0),
    diasAsc:(a,b)=>(a.dias||0)-(b.dias||0),
    gap:(a,b)=>((gaps[b.id]??-Infinity)-(gaps[a.id]??-Infinity)),
    preco:(a,b)=>(b.preco||0)-(a.preco||0),
    puffs:(a,b)=>(b.puffs||0)-(a.puffs||0),
  };
  v.sort(sorters[sort]||sorters.comeco);

  document.getElementById('count').textContent = `(${v.length})`;
  document.getElementById('tbody').innerHTML = v.map(x=>{
    const active = !x.fim;
    const preco = x.preco>0 ? fmtEur(x.preco) : '<span class="free">grátis</span>';
    const puffs = typeof x.puffs==='number' ? fmtNum(x.puffs) : '<span class="tag">recarregável</span>';
    const ov = loadOverrides();
    const finishedByUser = ov[x.id] && ov[x.id].fim;
    const durou = active
      ? `<button class="finishbtn" onclick="openFinish('${x.id}')">🏁 terminar</button>`
      : (x.dias!=null?x.dias+' dias':'—') + (finishedByUser?`<button class="reopen" onclick="reopenVape('${x.id}')" title="voltar a por em uso">↺</button>`:'');
    const photo = getPhoto(x);
    const cap = `${x.marca} · ${x.sabor}`.replace(/'/g,"\\'");
    const photoCell = photo
      ? `<img class="thumb" src="${photo}" onclick="openLightbox('${x.id}','${cap}')" alt="foto" />`
      : `<button class="addphoto" onclick="pickRowPhoto('${x.id}')">＋ foto</button>`;
    const g = gaps[x.id];
    let semVape;
    if(g==null) semVape = '<span class="tag">—</span>';
    else if(g>0) semVape = `<span class="gap-pos">${g}d sem vape</span>`;
    else if(g===0) semVape = '<span class="gap-zero">logo a seguir</span>';
    else semVape = `<span class="gap-neg">sobrepôs ${-g}d</span>`;
    return `<tr>
      <td class="tag">#${x._n}</td>
      <td>${photoCell}</td>
      <td><span class="pill">${x.marca}</span></td>
      <td><span class="flavor">${x.sabor}</span></td>
      <td>${puffs}</td>
      <td>${ptDate(x.comeco)}</td>
      <td>${ptDate(x.fim)}</td>
      <td>${durou}</td>
      <td>${semVape}</td>
      <td>${preco}</td>
      <td class="tag">${x.nota||'—'}</td>
    </tr>`;
  }).join('');
}

/* ---------- fotos: upload por linha da tabela ---------- */
function pickRowPhoto(id){
  const input = document.getElementById('rowPhotoInput');
  input.value = '';
  input.onchange = async ()=>{
    if(!input.files[0]) return;
    try { const data = await resizeImage(input.files[0]); setPhoto(id, data); }
    catch(e){ alert('Não consegui ler essa imagem 😕'); }
  };
  input.click();
}

/* ---------- lightbox ---------- */
let lightboxId = null;
function openLightbox(id, cap){
  const vape = allVapes().find(v=>String(v.id)===String(id));
  const photo = vape ? getPhoto(vape) : null;
  if(!photo) return;
  lightboxId = id;
  document.getElementById('lightboxImg').src = photo;
  document.getElementById('lightboxCap').textContent = cap || '';
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox(){ document.getElementById('lightbox').classList.remove('show'); lightboxId=null; }
function removePhotoFromLightbox(){ if(lightboxId!=null){ removePhoto(lightboxId); closeLightbox(); } }

/* ---------- terminar vape (definir data de fim mais tarde) ---------- */
let finishId = null;
function openFinish(id){
  const v = allVapes().find(x=>String(x.id)===String(id));
  if(!v) return;
  finishId = id;
  document.getElementById('finishName').textContent = `${v.marca} · ${v.sabor}`;
  const d = document.getElementById('finishDate');
  d.value = new Date().toISOString().slice(0,10);
  d.min = v.comeco || '';
  d.oninput = updateFinishInfo;
  updateFinishInfo();
  document.getElementById('finishOverlay').classList.add('show');
}
function updateFinishInfo(){
  const v = allVapes().find(x=>String(x.id)===String(finishId));
  const fim = document.getElementById('finishDate').value;
  const info = document.getElementById('finishInfo');
  if(v && fim){
    const dias = daysBetween(v.comeco, fim);
    info.textContent = dias!=null ? (dias<0 ? '⚠️ essa data é anterior ao início.' : `Vai contar como ${dias} dia${dias===1?'':'s'} de duração.`) : '';
  } else info.textContent = '';
}
function closeFinish(){ document.getElementById('finishOverlay').classList.remove('show'); finishId=null; }
function confirmFinish(){
  const v = allVapes().find(x=>String(x.id)===String(finishId));
  const fim = document.getElementById('finishDate').value;
  if(!v || !fim){ alert('Escolhe uma data 😉'); return; }
  const dias = daysBetween(v.comeco, fim);
  if(dias!=null && dias<0){ alert('A data de fim não pode ser antes do início 🤔'); return; }
  const ov = loadOverrides();
  ov[finishId] = { ...(ov[finishId]||{}), fim, dias };
  saveOverrides(ov);
  closeFinish();
  refresh();
}
function reopenVape(id){
  const ov = loadOverrides();
  if(ov[id]){ delete ov[id].fim; delete ov[id].dias; if(Object.keys(ov[id]).length===0) delete ov[id]; saveOverrides(ov); refresh(); }
}

/* ---------- add modal ---------- */
let pendingPhoto = null; // foto escolhida no formulário, ainda por guardar
function openAdd(){
  document.getElementById('f_comeco').value = new Date().toISOString().slice(0,10);
  document.getElementById('addOverlay').classList.add('show');
}
function closeAdd(){ document.getElementById('addOverlay').classList.remove('show'); }

async function onFormPhoto(input){
  if(!input.files[0]) return;
  try {
    pendingPhoto = await resizeImage(input.files[0]);
    document.getElementById('f_photo_drop').innerHTML = `<img src="${pendingPhoto}" alt="pré-visualização" />`;
  } catch(e){ alert('Não consegui ler essa imagem 😕'); }
}

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

  const newId = 'x'+Date.now();
  const extra = loadExtra();
  extra.push({ id:newId, marca, sabor, puffs, preco, comeco, fim, dias, entre:null, nota, user:true });
  saveExtra(extra);

  // guardar foto (se escolhida)
  if(pendingPhoto){ const p = loadPhotos(); p[newId] = pendingPhoto; savePhotos(p); }

  // limpar form
  ['f_marca','f_sabor','f_puffs','f_preco','f_fim','f_nota'].forEach(id=>document.getElementById(id).value='');
  pendingPhoto = null;
  document.getElementById('f_photo').value = '';
  document.getElementById('f_photo_drop').innerHTML = '<span id="f_photo_hint">📸 clica para escolher uma foto</span>';
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
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); closeLightbox(); } });
refresh();
