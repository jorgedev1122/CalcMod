const exprEl = document.getElementById('expr');
const resultEl = document.getElementById('result');
const historyList = document.getElementById('historyList');

let currentExpr = '';
let history = JSON.parse(localStorage.getItem('calc_history')||'[]');
let activeModules = JSON.parse(localStorage.getItem('calc_modules')||'{}');
let nitroActive = JSON.parse(localStorage.getItem('calc_nitro')||'false');
let theme = localStorage.getItem('calc_theme')||'minimal';
 
function updateDisplay(){
  exprEl.textContent = currentExpr || '0';
  try{
    const val = computeExpression(currentExpr);
    resultEl.textContent = val;
  }catch(e){ resultEl.textContent = 'Erro'; }
}
 
function computeExpression(input){
  if(!input) return '0'; 
  const sanitized = input.replace(/×/g,'*').replace(/÷/g,'/').replace(/–/g,'-').replace(/−/g,'-');
  const replaced = sanitized.replace(/%/g, '*0.01');
  if(!/^[0-9+\-*/(). %]+$/.test(replaced)) throw new Error('invalid'); 
  if(/\.\./.test(replaced)) throw new Error('invalid');
  const fn = new Function('return ' + replaced);
  const res = fn();
  if(typeof res === 'number' && !isFinite(res)) throw new Error('infinite');
  return roundNice(res);
}

function roundNice(n){
  if(n === undefined || n === null) return '0';
  if(Math.abs(n) < 1e-8) return '0';
  if(Number.isInteger(n)) return String(n);
  return String(Number(Math.round(n * 100000)/100000));
}

document.querySelectorAll('[data-key]').forEach(btn=>{
  btn.addEventListener('click', ()=> handleKey(btn.dataset.key));
});

document.getElementById('clearBtn').addEventListener('click', ()=>{ currentExpr=''; updateDisplay(); });
document.getElementById('backBtn').addEventListener('click', ()=>{ currentExpr = currentExpr.slice(0,-1); updateDisplay(); });
document.getElementById('pmBtn').addEventListener('click', ()=>{ togglePlusMinus(); });
document.getElementById('percentBtn').addEventListener('click', ()=>{ currentExpr += '%'; updateDisplay(); });

function handleKey(k){
  if(k === '='){ evaluateExpression(); return; }
  currentExpr += k;
  updateDisplay();
  quickNitroDetect();
}

function evaluateExpression(){
  try{
    const value = computeExpression(currentExpr);
    addHistory(currentExpr, value);
    currentExpr = String(value);
    updateDisplay();
  }catch(e){ resultEl.textContent = 'Erro'; }
}

function togglePlusMinus(){
  // toggle sign of last number
  const m = currentExpr.match(/(-?\d+\.?\d*)$/);
  if(m){
    const num = m[1];
    const toggled = num.startsWith('-')? num.slice(1): '-' + num;
    currentExpr = currentExpr.slice(0, -num.length) + toggled;
  } else {
    currentExpr = '-' + currentExpr;
  }
  updateDisplay();
}

document.addEventListener('keydown', (e)=>{
  const isTypingInInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

  if (isTypingInInput) return; 

  const key = e.key;
  if(key === 'Enter'){ e.preventDefault(); handleKey('='); }
  else if(key === 'Backspace'){ e.preventDefault(); currentExpr = currentExpr.slice(0,-1); updateDisplay(); }
  else if(key === 'Escape'){ e.preventDefault(); currentExpr=''; updateDisplay(); }
  else if(/^[0-9+\-*/().%]$/.test(key)){
    e.preventDefault(); handleKey(key);
  }
});

function addHistory(expr, value){
  history.unshift({expr, value, t: Date.now()});
  if(history.length>20) history.pop();
  localStorage.setItem('calc_history', JSON.stringify(history));
  renderHistory();
}
function renderHistory(){
  historyList.innerHTML = '';
  history.forEach(h=>{
    const div = document.createElement('div'); div.className='history-item'; div.role='listitem';
    div.innerHTML = `<div>${h.expr} = ${h.value}</div><div><button class='theme-btn' data-restore='${encodeURIComponent(h.expr)}'>Usar</button></div>`;
    historyList.appendChild(div);
  });
  document.querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click', ()=>{
    const e = decodeURIComponent(b.dataset.restore);
    currentExpr = e; updateDisplay();
  }));
}
document.getElementById('historyToggle').addEventListener('click', ()=>{
  const p = document.getElementById('historyPanel'); p.style.display = p.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('clearHistory').addEventListener('click', ()=>{ history = []; localStorage.removeItem('calc_history'); renderHistory(); });
document.getElementById('restoreSession').addEventListener('click', ()=>{ loadSession(); });


document.querySelectorAll('.module').forEach(m=>{
  const key = m.dataset.module;
  if(activeModules[key]) m.classList.add('active');
  m.addEventListener('click', ()=> toggleModule(key, m));
  m.addEventListener('keyup', (e)=>{ if(e.key === 'Enter') toggleModule(key,m); });
});

function toggleModule(key, el){
  activeModules[key] = !activeModules[key];
  if(activeModules[key]) el.classList.add('active'); else el.classList.remove('active');
  localStorage.setItem('calc_modules', JSON.stringify(activeModules));
  renderModules();
}

function renderModules(){
  document.getElementById('financePanel').style.display = activeModules.finance ? 'block' : 'none';
  document.getElementById('unitPanel').style.display = activeModules.units ? 'block' : 'none';
  document.getElementById('sciPanel').style.display = activeModules.scientific ? 'block' : 'none';
  document.getElementById('workPanel').style.display = activeModules.workout ? 'block' : 'none';
}


document.getElementById('simpleBtn').addEventListener('click', ()=>{
  const A = Number(document.getElementById('finAmount').value)||0;
  const r = Number(document.getElementById('finRate').value)||0;
  const t = Number(document.getElementById('finTime').value)||0;
  const res = A * (1 + (r/100) * t);
  document.getElementById('financeResult').textContent = `Juros simples: ${roundNice(res)}`;
});

document.getElementById('compoundBtn').addEventListener('click', ()=>{
  const A = Number(document.getElementById('finAmount').value)||0;
  const r = Number(document.getElementById('finRate').value)||0;
  const t = Number(document.getElementById('finTime').value)||0;
  const res = A * Math.pow((1 + r/100), t);
  document.getElementById('financeResult').textContent = `Juros compostos: ${roundNice(res)}`;
});

document.getElementById('installBtn').addEventListener('click', ()=>{
  const A = Number(document.getElementById('finAmount').value)||0;
  const r = Number(document.getElementById('finRate').value)||0;
  const t = Number(document.getElementById('finTime').value)||1;
  const total = A * Math.pow((1 + r/100), t);
  const per = total / t;
  document.getElementById('financeResult').textContent = `Total: ${roundNice(total)} — ${t}x de ${roundNice(per)}`;
});

document.getElementById('convertUnit').addEventListener('click', ()=>{
  const type = document.getElementById('unitType').value;
  const v = Number(document.getElementById('unitValue').value)||0;
  let out='0';
  if(type==='length'){ out = `${v} m = ${v/1000} km | ${v} km = ${v*1000} m`; }
  else if(type==='weight'){ out = `${v} kg = ${v*1000} g | ${v} g = ${v/1000} kg`; }
  else if(type==='temp'){ out = `${v}°C = ${(v*9/5)+32}°F | ${v}°F = ${((v-32)*5/9).toFixed(2)}°C`; }
  document.getElementById('unitResult').textContent = out;
}); 

document.querySelectorAll('.sci').forEach(b=> b.addEventListener('click', ()=>{
  const fn = b.dataset.fn;
  const value = Number(computeExpression(currentExpr));
  let out = 'Erro';
  if(isNaN(value)) out = 'Sem valor';
  else{
    if(fn==='sqrt') out = Math.sqrt(value);
    if(fn==='pow'){ const p = prompt('Potência (ex: 2)'); out = Math.pow(value, Number(p)||2); }
    if(fn==='sin') out = Math.sin(value);
    if(fn==='cos') out = Math.cos(value);
  }
  addHistory(`${fn}(${currentExpr})`, out);
  currentExpr = String(roundNice(out)); updateDisplay();
}));

document.getElementById('calcCalories').addEventListener('click', ()=>{
  const weight = Number(document.getElementById('weightKg').value)||70;
  const act = document.getElementById('activitySelect').value;
  const minutes = Number(document.getElementById('timeMin').value)||30;
  const mets = { running:9.8, cycling:7.5, boxing:12, generic:6 };
  const met = mets[act]||6;
  const hours = minutes/60;
  const cal = met * weight * hours;
  document.getElementById('workoutResult').textContent = `Estimado: ${roundNice(cal)} kcal`;
});

const nitroBtn = document.getElementById('nitroBtn');
nitroBtn.addEventListener('click', ()=>{ nitroActive = !nitroActive; localStorage.setItem('calc_nitro', JSON.stringify(nitroActive)); nitroBtn.setAttribute('aria-pressed', nitroActive); nitroBtn.textContent = nitroActive ? 'Nitro Ativado' : 'Aplicar Nitro'; });

function quickNitroDetect(){
  if(!nitroActive) return;
  const m = currentExpr.match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)$/);
  if(m){
    const amount = Number(m[1]); const parts = Number(m[2])||1;
    const per = roundNice(amount/parts);
    resultEl.textContent = `Parcelas: ${parts}x de ${per}`;
  }
}

function applyTheme(t){
  document.body.classList.remove('theme-dark','theme-cyber');
  if(t==='dark') document.body.classList.add('theme-dark');
  if(t==='cyber') document.body.classList.add('theme-cyber');
  theme = t; localStorage.setItem('calc_theme', t);
}
document.querySelectorAll('.theme-btn[data-theme]').forEach(b=>{
  b.addEventListener('click', ()=> applyTheme(b.dataset.theme));
});
applyTheme(theme);

document.getElementById('saveSessionBtn').addEventListener('click', ()=>{
  const session = { history, activeModules, theme, nitroActive, expr: currentExpr };
  localStorage.setItem('calc_full_session', JSON.stringify(session));
  alert('Sessão salva no localStorage');
});
function loadSession(){
  const s = JSON.parse(localStorage.getItem('calc_full_session')||'null');
  if(!s) return alert('Nenhuma sessão encontrada');
  history = s.history||[]; activeModules = s.activeModules||{}; nitroActive = s.nitroActive; currentExpr = s.expr||''; applyTheme(s.theme||'minimal'); renderModules(); renderHistory(); updateDisplay();
  alert('Sessão carregada');
}
document.getElementById('loadSessionBtn').addEventListener('click', loadSession);
document.getElementById('resetSessionBtn').addEventListener('click', ()=>{ if(confirm('Resetar todas as configurações salvas?')){ localStorage.clear(); location.reload(); } });

const overlay = document.getElementById('overlay');
document.querySelectorAll('.mode').forEach(m=> m.addEventListener('click', ()=>{
  document.querySelectorAll('.mode').forEach(x=>x.style.border='1px dashed rgba(0,0,0,0.06)'); m.style.border='2px solid var(--accent)';
  const mode = m.dataset.mode;
  if(mode==='basic') activeModules = {};
  if(mode==='finance') activeModules = { finance: true };
  if(mode==='units') activeModules = { units: true };
}));
document.getElementById('closeOverlay').addEventListener('click', ()=>{ overlay.style.display='none'; localStorage.setItem('calc_modules', JSON.stringify(activeModules)); renderModules(); renderHistory(); updateDisplay(); });
renderModules(); renderHistory(); updateDisplay();


if(Object.keys(activeModules).length===0)

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const overlay = document.querySelector(".overlay");

  if (startBtn && overlay) {
    startBtn.addEventListener("click", () => {
      overlay.style.display = "none"; 
    });
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.querySelector(".overlay");
  const startBtn = document.getElementById("startBtn");
  const modeButtons = document.querySelectorAll(".mode");

  let selectedMode = null;

  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      modeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedMode = btn.innerText; 
    });
  });

  startBtn.addEventListener("click", () => {
    if (!selectedMode) {
      alert("Selecione um modo antes de começar!");
      return;
    }

    localStorage.setItem("calcMode", selectedMode);
 
    overlay.style.display = "none";
  });
});
document.addEventListener("keydown", function(event) {
  if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
    return;
  }


});

