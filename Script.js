const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const exprEl = $("#expr");
const resultEl = $("#result");
const historyList = $("#historyList");
const charCounter = $("#charCounter");
const toastStack = $("#toastStack");

let currentExpr = "";
let history = readStorage("calc_history", []);
let activeModules = readStorage("calc_modules", {});
let nitroActive = readStorage("calc_nitro", false);
let theme = localStorage.getItem("calc_theme") || "minimal";
let soundEnabled = readStorage("calc_sound", false);
let selectedMode = "basic";
let commandIndex = 0;

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function computeExpression(input) {
  if (!input) return "0";
  const sanitized = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/–/g, "-");
  const replaced = sanitized.replace(/%/g, "*0.01");

  if (!/^[0-9+\-*/(). %]+$/.test(replaced)) throw new Error("invalid");
  if (/\.\./.test(replaced)) throw new Error("invalid");

  const fn = new Function(`return ${replaced}`);
  const res = fn();
  if (typeof res === "number" && !Number.isFinite(res))
    throw new Error("infinite");
  return roundNice(res);
}

function roundNice(n) {
  if (n === undefined || n === null || n === "") return "0";
  const numeric = Number(n);
  if (Number.isNaN(numeric)) return String(n);
  if (Math.abs(numeric) < 1e-8) return "0";
  if (Number.isInteger(numeric)) return String(numeric);
  return String(Number(Math.round(numeric * 100000) / 100000));
}

function updateDisplay(animate = true) {
  if (animate) {
    exprEl.classList.add("is-changing");
    resultEl.classList.add("is-changing");
    window.setTimeout(() => {
      exprEl.classList.remove("is-changing");
      resultEl.classList.remove("is-changing");
    }, 170);
  }

  exprEl.textContent = currentExpr || "0";
  charCounter.textContent = `${currentExpr.length} ${currentExpr.length === 1 ? "caractere" : "caracteres"}`;

  try {
    resultEl.textContent = computeExpression(currentExpr);
  } catch {
    resultEl.textContent = currentExpr ? "" : "0";
  }
}

function handleKey(k) {
  playTone(520, 0.025);
  if (k === "=") {
    evaluateExpression();
    return;
  }
  currentExpr += k;
  updateDisplay();
  quickNitroDetect();
}

function evaluateExpression() {
  try {
    const value = computeExpression(currentExpr);
    if (currentExpr) addHistory(currentExpr, value);
    currentExpr = String(value);
    updateDisplay();
    showToast("Resultado calculado", `${currentExpr}`);
  } catch {
    resultEl.textContent = "Erro";
    showToast("Expressão inválida", "Revise a operação e tente novamente.");
  }
}

function togglePlusMinus() {
  const match = currentExpr.match(/(-?\d+\.?\d*)$/);
  if (match) {
    const num = match[1];
    const toggled = num.startsWith("-") ? num.slice(1) : `-${num}`;
    currentExpr = currentExpr.slice(0, -num.length) + toggled;
  } else if (currentExpr) {
    currentExpr = `-${currentExpr}`;
  }
  updateDisplay();
}

function addHistory(expr, value) {
  history.unshift({ expr, value, t: Date.now() });
  if (history.length > 20) history.pop();
  saveStorage("calc_history", history);
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhum cálculo salvo ainda.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.role = "listitem";

    const expression = document.createElement("div");
    expression.textContent = `${item.expr} = ${item.value}`;

    const button = document.createElement("button");
    button.className = "control-btn";
    button.type = "button";
    button.textContent = "Usar";
    button.addEventListener("click", () => {
      currentExpr = item.expr;
      updateDisplay();
      showToast("Histórico restaurado", item.expr);
    });

    row.append(expression, button);
    historyList.appendChild(row);
  });
}

function renderModules() {
  const panelMap = {
    finance: $("#financePanel"),
    units: $("#unitPanel"),
    scientific: $("#sciPanel"),
    workout: $("#workPanel"),
  };

  $$(".module").forEach((module) => {
    const key = module.dataset.module;
    const isActive = Boolean(activeModules[key]);
    module.classList.toggle("active", isActive);
    module.setAttribute("aria-pressed", String(isActive));
  });

  Object.entries(panelMap).forEach(([key, panel]) => {
    panel.hidden = !activeModules[key];
  });
}

function toggleModule(key, element, silent = false) {
  activeModules[key] = !activeModules[key];
  saveStorage("calc_modules", activeModules);
  renderModules();
  playTone(activeModules[key] ? 720 : 380, 0.035);

  if (!silent) {
    const label = element?.querySelector("strong")?.textContent || key;
    showToast(
      activeModules[key] ? "Módulo ativado" : "Módulo desativado",
      label,
    );
  }
}

function quickNitroDetect() {
  if (!nitroActive) return;
  const match = currentExpr.match(/^(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)$/);
  if (match) {
    const amount = Number(match[1]);
    const parts = Number(match[2]) || 1;
    const per = roundNice(amount / parts);
    resultEl.textContent = `${parts}x de ${per}`;
  }
}

function syncNitroButton() {
  const nitroBtn = $("#nitroBtn");
  const nitroStatus = $("#nitroStatus");
  nitroBtn.setAttribute("aria-pressed", String(nitroActive));
  nitroBtn.querySelector("span").textContent = nitroActive
    ? "Nitro Ativado"
    : "Aplicar Nitro";
  nitroStatus.classList.toggle("is-on", nitroActive);
  nitroStatus.querySelector("strong").textContent = nitroActive
    ? "Nitro on"
    : "Nitro off";
}

function applyTheme(nextTheme) {
  document.body.classList.remove("theme-dark", "theme-cyber");
  if (nextTheme === "dark") document.body.classList.add("theme-dark");
  if (nextTheme === "cyber") document.body.classList.add("theme-cyber");

  theme = nextTheme;
  localStorage.setItem("calc_theme", nextTheme);
  $$(".theme-btn[data-theme]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === nextTheme);
  });
}

function showToast(title, detail = "") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <i data-lucide="sparkle"></i>
    <div>
      <strong>${title}</strong>
      ${detail ? `<small>${detail}</small>` : ""}
    </div>
  `;
  toastStack.appendChild(toast);
  refreshIcons();
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px) scale(.98)";
    window.setTimeout(() => toast.remove(), 220);
  }, 2600);
}

function playTone(frequency = 520, duration = 0.03) {
  if (!soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.025, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function createRipple(event) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  target.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

function calculateFinance(type) {
  const amount = Number($("#finAmount").value) || 0;
  const rate = Number($("#finRate").value) || 0;
  const time = Number($("#finTime").value) || 0;
  let text = "";

  if (type === "simple") {
    text = `Juros simples: ${roundNice(amount * (1 + (rate / 100) * time))}`;
  }

  if (type === "compound") {
    text = `Juros compostos: ${roundNice(amount * Math.pow(1 + rate / 100, time))}`;
  }

  if (type === "installments") {
    const periods = time || 1;
    const total = amount * Math.pow(1 + rate / 100, periods);
    text = `Total: ${roundNice(total)} | ${periods}x de ${roundNice(total / periods)}`;
  }

  $("#financeResult").textContent = text;
  showToast("Financeiro atualizado", text);
}

function convertUnit() {
  const type = $("#unitType").value;
  const value = Number($("#unitValue").value) || 0;
  let output = "0";

  if (type === "length")
    output = `${value} m = ${value / 1000} km | ${value} km = ${value * 1000} m`;
  if (type === "weight")
    output = `${value} kg = ${value * 1000} g | ${value} g = ${value / 1000} kg`;
  if (type === "temp")
    output = `${value}°C = ${(value * 9) / 5 + 32}°F | ${value}°F = ${(((value - 32) * 5) / 9).toFixed(2)}°C`;

  $("#unitResult").textContent = output;
  showToast("Conversão concluída", output);
}

function runScientific(fn) {
  const value = Number(computeExpression(currentExpr));
  let output = "Erro";

  if (Number.isNaN(value)) {
    output = "Sem valor";
  } else {
    if (fn === "sqrt") output = Math.sqrt(value);
    if (fn === "pow") {
      const power = prompt("Potência (ex: 2)") || "2";
      output = Math.pow(value, Number(power) || 2);
    }
    if (fn === "sin") output = Math.sin(value);
    if (fn === "cos") output = Math.cos(value);
  }

  addHistory(`${fn}(${currentExpr})`, roundNice(output));
  currentExpr = String(roundNice(output));
  updateDisplay();
}

function calcCalories() {
  const weight = Number($("#weightKg").value) || 70;
  const activity = $("#activitySelect").value;
  const minutes = Number($("#timeMin").value) || 30;
  const mets = { running: 9.8, cycling: 7.5, boxing: 12, generic: 6 };
  const calories = (mets[activity] || 6) * weight * (minutes / 60);
  const text = `Estimado: ${roundNice(calories)} kcal`;
  $("#workoutResult").textContent = text;
  showToast("Workout calculado", text);
}

function saveSession() {
  const session = {
    history,
    activeModules,
    theme,
    nitroActive,
    expr: currentExpr,
    soundEnabled,
  };
  saveStorage("calc_full_session", session);
  showToast("Sessão salva", "Tudo ficou guardado no navegador.");
}

function loadSession() {
  const session = readStorage("calc_full_session", null);
  if (!session) {
    showToast(
      "Nenhuma sessão encontrada",
      "Salve uma sessão antes de carregar.",
    );
    return;
  }

  history = session.history || [];
  activeModules = session.activeModules || {};
  nitroActive = Boolean(session.nitroActive);
  soundEnabled = Boolean(session.soundEnabled);
  currentExpr = session.expr || "";
  $("#soundToggle").checked = soundEnabled;
  applyTheme(session.theme || "minimal");
  syncNitroButton();
  renderModules();
  renderHistory();
  updateDisplay(false);
  showToast("Sessão carregada", "Workspace restaurado.");
}

function resetSession() {
  if (!confirm("Resetar todas as configurações salvas?")) return;
  localStorage.clear();
  showToast("Sessão resetada", "Recarregando interface.");
  window.setTimeout(() => location.reload(), 600);
}

const commandActions = [
  {
    label: "Limpar calculadora",
    hint: "Esc",
    run: () => {
      currentExpr = "";
      updateDisplay();
    },
  },
  {
    label: "Mostrar histórico",
    hint: "Timeline",
    run: () => toggleHistory(true),
  },
  {
    label: "Alternar Nitro",
    hint: "Smart parcelas",
    run: () => $("#nitroBtn").click(),
  },
  {
    label: "Ativar Financeiro",
    hint: "Módulo",
    run: () => setModule("finance", true),
  },
  {
    label: "Ativar Conversor",
    hint: "Módulo",
    run: () => setModule("units", true),
  },
  {
    label: "Ativar Científica",
    hint: "Módulo",
    run: () => setModule("scientific", true),
  },
  {
    label: "Ativar Workout",
    hint: "Módulo",
    run: () => setModule("workout", true),
  },
  { label: "Salvar sessão", hint: "Local", run: saveSession },
  { label: "Carregar sessão", hint: "Local", run: loadSession },
];

function setModule(key, value) {
  activeModules[key] = value;
  saveStorage("calc_modules", activeModules);
  renderModules();
  showToast(value ? "Módulo ativado" : "Módulo desativado", key);
}

function openCommandPalette() {
  $("#commandBackdrop").hidden = false;
  $("#commandSearch").value = "";
  commandIndex = 0;
  renderCommands();
  window.setTimeout(() => $("#commandSearch").focus(), 30);
}

function closeCommandPalette() {
  $("#commandBackdrop").hidden = true;
}

function renderCommands() {
  const query = $("#commandSearch").value.trim().toLowerCase();
  const list = $("#commandList");
  const filtered = commandActions.filter((action) =>
    action.label.toLowerCase().includes(query),
  );
  list.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhuma ação encontrada.";
    list.appendChild(empty);
    return;
  }

  commandIndex = Math.min(commandIndex, filtered.length - 1);

  filtered.forEach((action, index) => {
    const button = document.createElement("button");
    button.className = `command-item ${index === commandIndex ? "is-selected" : ""}`;
    button.type = "button";
    button.innerHTML = `<strong>${action.label}</strong><span>${action.hint}</span>`;
    button.addEventListener("click", () => {
      action.run();
      closeCommandPalette();
    });
    list.appendChild(button);
  });
}

function runSelectedCommand() {
  const query = $("#commandSearch").value.trim().toLowerCase();
  const filtered = commandActions.filter((action) =>
    action.label.toLowerCase().includes(query),
  );
  const action = filtered[commandIndex];
  if (!action) return;
  action.run();
  closeCommandPalette();
}

function toggleHistory(forceOpen = false) {
  const panel = $("#historyPanel");
  panel.hidden = forceOpen ? false : !panel.hidden;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function bindEvents() {
  $$("[data-key]").forEach((btn) =>
    btn.addEventListener("click", () => handleKey(btn.dataset.key)),
  );

  $("#clearBtn").addEventListener("click", () => {
    currentExpr = "";
    updateDisplay();
    showToast("Display limpo");
  });
  $("#backBtn").addEventListener("click", () => {
    currentExpr = currentExpr.slice(0, -1);
    updateDisplay();
  });
  $("#pmBtn").addEventListener("click", togglePlusMinus);
  $("#percentBtn").addEventListener("click", () => {
    currentExpr += "%";
    updateDisplay();
  });
  $("#historyToggle").addEventListener("click", () => toggleHistory());
  $("#clearHistory").addEventListener("click", () => {
    history = [];
    localStorage.removeItem("calc_history");
    renderHistory();
    showToast("Histórico limpo");
  });
  $("#restoreSession").addEventListener("click", loadSession);

  $$(".module").forEach((module) => {
    const key = module.dataset.module;
    module.addEventListener("click", () => toggleModule(key, module));
    module.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleModule(key, module);
      }
    });
  });

  $("#simpleBtn").addEventListener("click", () => calculateFinance("simple"));
  $("#compoundBtn").addEventListener("click", () =>
    calculateFinance("compound"),
  );
  $("#installBtn").addEventListener("click", () =>
    calculateFinance("installments"),
  );
  $("#convertUnit").addEventListener("click", convertUnit);
  $$(".sci").forEach((btn) =>
    btn.addEventListener("click", () => runScientific(btn.dataset.fn)),
  );
  $("#calcCalories").addEventListener("click", calcCalories);

  $("#nitroBtn").addEventListener("click", () => {
    nitroActive = !nitroActive;
    saveStorage("calc_nitro", nitroActive);
    syncNitroButton();
    quickNitroDetect();
    showToast(nitroActive ? "Nitro ativado" : "Nitro desativado");
  });

  $$(".theme-btn[data-theme]").forEach((btn) =>
    btn.addEventListener("click", () => applyTheme(btn.dataset.theme)),
  );
  $("#saveSessionBtn").addEventListener("click", saveSession);
  $("#loadSessionBtn").addEventListener("click", loadSession);
  $("#resetSessionBtn").addEventListener("click", resetSession);
  $("#settingsToggle").addEventListener("click", () => {
    $("#settingsPanel").hidden = !$("#settingsPanel").hidden;
  });

  $("#soundToggle").checked = soundEnabled;
  $("#soundToggle").addEventListener("change", (event) => {
    soundEnabled = event.target.checked;
    saveStorage("calc_sound", soundEnabled);
    playTone(660, 0.045);
    showToast(soundEnabled ? "Som ativado" : "Som desativado");
  });

  $$(".mode").forEach((mode) => {
    mode.addEventListener("click", () => {
      $$(".mode").forEach((item) => item.classList.remove("active"));
      mode.classList.add("active");
      selectedMode = mode.dataset.mode;
      playTone(620, 0.03);
    });
  });

  $("#closeOverlay").addEventListener("click", () => {
    if (selectedMode === "basic") activeModules = {};
    if (selectedMode === "finance") activeModules = { finance: true };
    if (selectedMode === "units") activeModules = { units: true };
    saveStorage("calc_modules", activeModules);
    localStorage.setItem("calc_seen_intro", "true");
    $("#overlay").style.display = "none";
    renderModules();
    showToast("Workspace pronto", "Interface carregada.");
  });

  $("#commandOpen").addEventListener("click", openCommandPalette);
  $("#commandBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "commandBackdrop") closeCommandPalette();
  });
  $("#commandSearch").addEventListener("input", renderCommands);

  document.addEventListener("keydown", (event) => {
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(
      event.target.tagName,
    );

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (!$("#commandBackdrop").hidden) {
      if (event.key === "Escape") closeCommandPalette();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        commandIndex += 1;
        renderCommands();
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        commandIndex = Math.max(0, commandIndex - 1);
        renderCommands();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runSelectedCommand();
      }
      return;
    }

    if (isTyping) return;

    const key = event.key;
    if (key === "Enter") {
      event.preventDefault();
      handleKey("=");
    } else if (key === "Backspace") {
      event.preventDefault();
      currentExpr = currentExpr.slice(0, -1);
      updateDisplay();
    } else if (key === "Escape") {
      event.preventDefault();
      currentExpr = "";
      updateDisplay();
    } else if (/^[0-9+\-*/().%]$/.test(key)) {
      event.preventDefault();
      handleKey(key);
    }
  });

  $$("button, .module").forEach((item) =>
    item.addEventListener("pointerdown", createRipple),
  );

  document.addEventListener("pointermove", (event) => {
    const panel = event.target.closest?.(".glass-panel");
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 4;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -4;
    panel.style.transform = `perspective(1200px) rotateX(${y}deg) rotateY(${x}deg)`;
  });

  document.addEventListener("pointerout", (event) => {
    const panel = event.target.closest?.(".glass-panel");
    if (panel) panel.style.transform = "";
  });
}

function init() {
  bindEvents();
  applyTheme(theme);
  syncNitroButton();
  renderModules();
  renderHistory();
  updateDisplay(false);
  refreshIcons();

  if (localStorage.getItem("calc_seen_intro") === "true") {
    $("#overlay").style.display = "none";
  } else {
    $('.mode[data-mode="basic"]').classList.add("active");
  }

  window.setTimeout(() => $("#splash").classList.add("is-hidden"), 750);
}

init();
