import { basePath, qs, qsa } from "./util.js";
import { initWM } from "./wm.js";
import { initHome } from "./home.js";
import { initPubs } from "./pubs.js";
import { initBlogIndex, initBlogPost } from "./blog.js";
import { initMisc } from "./misc.js";
import { initProjects } from "./projects.js";
import { createFireworks } from "./fireworks.js";

const BASE = basePath();
window.__BASE__ = BASE;

let fireworks = null;

function getFireworksEnabled() {
  const raw = localStorage.getItem("fireworks-enabled");
  if (raw == null) return document.body.dataset.page === "home";
  return raw === "1";
}
function setFireworksEnabled(v) {
  localStorage.setItem("fireworks-enabled", v ? "1" : "0");
  if (fireworks) fireworks.setEnabled(v);
}

function stripTrailing(p) {
  return (p || "/").replace(/\/+$/, "");
}
function isActive(path) {
  const cur = stripTrailing(location.pathname);
  const normalizedPath = path === "" ? "/" : "/" + path.replace(/^\/+|\/+$/g, "");
  const target = stripTrailing(normalizedPath);
  if (path === "") return cur === "/" || cur === "";
  return cur === target || cur.startsWith(target + "/");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  if (fireworks) fireworks.updateConfig({});
}
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) applyTheme(saved);
  else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

const FXES = ["clean", "crt"];
function applyFx(fx) {
  const val = FXES.includes(fx) ? fx : "clean";
  document.documentElement.setAttribute("data-fx", val);
  localStorage.setItem("fx", val);
  if (fireworks) fireworks.updateConfig({});
}
function initFx() {
  const saved = localStorage.getItem("fx");
  applyFx(saved || "clean");
}

function fmt2(n) { return String(n).padStart(2, "0"); }
function formatClock(d) {
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}
function startClock() {
  const el = qs("#dockClock");
  if (!el) return;
  const tick = () => { el.textContent = formatClock(new Date()); };
  tick();
  setInterval(tick, 20000);
}

function buildDock(wm) {
  const dock = qs("#dock");
  if (!dock) return;

  const items = [
    { href: "", label: "HOME" },
    { href: "pubs/", label: "PUBS" },
    { href: "blog/", label: "BLOG" },
    { href: "projects/", label: "PROJECTS" },
    { href: "misc/", label: "MISC" },
  ];

  dock.innerHTML = `
    <div class="dockRow dockLeft">
      <button id="dockBackBtn" class="dockBtn" data-tip="Back">\u2190</button>
    </div>
    <div class="dockRow dockApps" aria-label="Navigation">
      ${items.map(it => {
        const cleanHref = it.href.startsWith("/") ? it.href : "/" + it.href;
        return `<a data-tip="${it.label}" href="${cleanHref}" class="dockApp ${isActive(it.href) ? "is-active" : ""}">${it.label}</a>`;
      }).join("")}
    </div>
    <div class="dockRow dockRight" aria-label="System">
      <button id="dockDisplayBtn" class="dockBtn" data-tip="Display settings">Display</button>
      <button id="dockWinBtn" class="dockBtn" data-tip="Toggle windows">WIN</button>
      <button id="dockResetBtn" class="dockBtn" data-tip="Reset layout">RST</button>
      <span id="dockClock" class="dockClock" aria-label="Clock"></span>
    </div>
  `;

  const backBtn = qs("#dockBackBtn");
  backBtn.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = BASE === "/" ? "/" : BASE;
  });

  let displayPop = qs("#dockDisplayPop");
  if (!displayPop) {
    displayPop = document.createElement("div");
    displayPop.id = "dockDisplayPop";
    displayPop.className = "dockPop";
    document.body.appendChild(displayPop);
  }

  function renderDisplayPop() {
    const theme = document.documentElement.getAttribute("data-theme") || "light";
    const fx = document.documentElement.getAttribute("data-fx") || "clean";
    displayPop.innerHTML = `
      <h3>Display</h3>
      <div class="settingGroup">
        <div class="settingLabel">Theme</div>
        <div class="segmented">
          <button class="segBtn ${theme === "light" ? "is-active" : ""}" data-theme-set="light">Light</button>
          <button class="segBtn ${theme === "dark" ? "is-active" : ""}" data-theme-set="dark">Dark</button>
        </div>
      </div>
      <div class="settingGroup">
        <div class="settingLabel">Visual style</div>
        <div class="segmented">
          ${FXES.map(name => `<button class="segBtn ${fx === name ? "is-active" : ""}" data-fx-set="${name}">${name}</button>`).join("")}
        </div>
      </div>
      <div class="settingGroup">
        <div class="settingLabel">Background</div>
        <label class="switchRow">
          <input type="checkbox" id="fireworksToggle" ${getFireworksEnabled() ? "checked" : ""}>
          <span>Fireworks</span>
        </label>
      </div>
    `;
    qsa("[data-theme-set]", displayPop).forEach(btn => btn.addEventListener("click", () => { applyTheme(btn.dataset.themeSet); renderDisplayPop(); }));
    qsa("[data-fx-set]", displayPop).forEach(btn => btn.addEventListener("click", () => { applyFx(btn.dataset.fxSet); renderDisplayPop(); }));
    qs("#fireworksToggle", displayPop)?.addEventListener("change", (e) => setFireworksEnabled(e.target.checked));
  }

  qs("#dockDisplayBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    renderDisplayPop();
    displayPop.classList.toggle("is-open");
    if (pop) pop.classList.remove("is-open");
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#dockDisplayPop") || e.target.closest("#dockDisplayBtn")) return;
    displayPop.classList.remove("is-open");
  });

  let pop = qs("#dockPop");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "dockPop";
    pop.className = "dockPop";
    document.body.appendChild(pop);
  }

  const winBtn = qs("#dockWinBtn");
  if (wm) {
    renderWinList(pop, wm);
    winBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      pop.classList.toggle("is-open");
      displayPop.classList.remove("is-open");
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("#dockPop")) return;
      if (e.target.closest("#dockWinBtn")) return;
      if (e.target.closest("#dockDisplayPop")) return;
      if (e.target.closest("#dockDisplayBtn")) return;
      pop.classList.remove("is-open");
      displayPop.classList.remove("is-open");
    });
  } else {
    winBtn.style.display = "none";
  }

  const resetBtn = qs("#dockResetBtn");
  resetBtn.addEventListener("click", () => {
    if (wm) wm.reset();
    else location.reload();
  });

  startClock();
}

function renderWinList(pop, wm) {
  const wins = wm.listWindows();
  pop.innerHTML = `
    <h3>Windows</h3>
    <div class="winList">
      ${wins.map(w => `
        <label class="winToggle">
          <input type="checkbox" ${w.closed ? "" : "checked"} data-win="${w.id}">
          <span class="wname">${w.label}</span>
        </label>
      `).join("")}
    </div>
  `;
  qsa("input[data-win]", pop).forEach(cb => {
    cb.addEventListener("change", () => { wm.show(cb.dataset.win, cb.checked); });
  });
}

function initTypewriter() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const els = qsa("[data-typing]");
  els.forEach((el, idx) => {
    const full = (el.textContent || "").trim();
    if (!full) return;
    const speed = 25 + Math.floor(Math.random() * 10);
    const delay = idx * 120;
    el.textContent = "";
    el.classList.add("is-typing");
    setTimeout(() => {
      let i = 0;
      const timer = setInterval(() => {
        el.textContent = full.slice(0, i + 1);
        i++;
        if (i >= full.length) {
          clearInterval(timer);
          el.classList.remove("is-typing");
        }
      }, speed);
    }, delay);
  });
}

function initFireworksForPage() {
  const page = document.body.dataset.page;
  const cfg = page === "home"
    ? { target: document.body, density: 0.26, speed: 0.85, px: 3 }
    : { target: document.body, density: 0.14, speed: 0.75, px: 2 };
  fireworks = createFireworks({ ...cfg, enabled: getFireworksEnabled() });
}

async function init() {
  initTheme();
  initFx();

  const useWM = document.body.dataset.wm === "1";
  const wm = useWM ? initWM() : null;
  buildDock(wm);
  initTypewriter();

  const page = document.body.dataset.page;

  try {
    if (page === "home") await initHome(BASE);
    if (page === "pubs") await initPubs(BASE);
    if (page === "blog") await initBlogIndex(BASE);
    if (page === "post") await initBlogPost(BASE);
    if (page === "projects") await initProjects(BASE);
    if (page === "misc") await initMisc(BASE);
  } catch (err) {
    console.error("BASE path:", BASE);
    console.error("Current URL:", location.href);
    const fallback = qs("#fatal");
    if (fallback) {
      fallback.textContent = `Failed to load data. Error: ${err.message || err}. BASE: ${BASE}`;
      fallback.style.color = "var(--muted)";
      fallback.style.fontSize = "11px";
    }
  }

  initFireworksForPage();
  requestAnimationFrame(() => document.body.classList.add("is-ready"));
}

init();