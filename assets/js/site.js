import { basePath, qs, qsa } from "./util.js";
import { initWM } from "./wm.js";
import { initHome } from "./home.js";
import { initPubs } from "./pubs.js";
import { initBlogIndex, initBlogPost } from "./blog.js";
import { initMisc } from "./misc.js";
import { initProjects } from "./projects.js";

const BASE = basePath();
window.__BASE__ = BASE;

function stripTrailing(p){
  return (p || "/").replace(/\/+$/,"");
}
function isActive(path){
  const cur = stripTrailing(location.pathname);
  // Normalize path
  const normalizedPath = path === "" ? "/" : "/" + path.replace(/^\/+|\/+$/g, "");
  const target = stripTrailing(normalizedPath);
  
  if(path === "") {
    return cur === "/" || cur === "";
  }
  
  // Compare current path with target path
  return cur === target || cur.startsWith(target + "/");
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}
function initTheme(){
  const saved = localStorage.getItem("theme");
  if(saved) applyTheme(saved);
  else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

const FXES = ["clean","crt"];
function applyFx(fx){
  const val = FXES.includes(fx) ? fx : "clean";
  document.documentElement.setAttribute("data-fx", val);
  localStorage.setItem("fx", val);
}
function initFx(){
  const saved = localStorage.getItem("fx");
  applyFx(saved || "clean");
}

function fmt2(n){ return String(n).padStart(2,"0"); }
function formatClock(d){
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}
function startClock(){
  const el = qs("#dockClock");
  if(!el) return;
  const tick = ()=>{
    el.textContent = formatClock(new Date());
  };
  tick();
  setInterval(tick, 20_000);
}

function cycleFx(){
  const cur = document.documentElement.getAttribute("data-fx") || "clean";
  const idx = FXES.indexOf(cur);
  const next = FXES[(idx + 1) % FXES.length];
  applyFx(next);
}

function buildDock(wm){
  const dock = qs("#dock");
  if(!dock) return;

  const items = [
    {href:"", label:"HOME"},
    {href:"pubs/", label:"PUBS"},
    {href:"blog/", label:"BLOG"},
    {href:"projects/", label:"PROJECTS"},
    {href:"misc/", label:"MISC"},
  ];

  dock.innerHTML = `
    <div class="dockRow dockLeft">
      <button id="dockBackBtn" class="dockBtn" data-tip="Back">←</button>
    </div>

    <div class="dockRow dockApps" aria-label="Navigation">
      ${items.map(it => {
        // For user site (BASE === "/"), href should be "/path/"
        // Ensure href always starts with /
        const cleanHref = it.href.startsWith("/") ? it.href : "/" + it.href;
        return `
        <a data-tip="${it.label}" href="${cleanHref}" class="dockApp ${isActive(it.href) ? "is-active" : ""}">
          ${it.label}
        </a>
      `;
      }).join("")}
    </div>

    <div class="dockRow dockRight" aria-label="System">
      <button id="dockFxBtn" class="dockBtn" data-tip="Visual effects (clean/crt)">FX</button>
      <button id="dockThemeBtn" class="dockBtn" data-tip="Theme">THEME</button>
      <button id="dockWinBtn" class="dockBtn" data-tip="Windows">WIN</button>
      <button id="dockResetBtn" class="dockBtn" data-tip="Reset layout">RST</button>
      <span id="dockClock" class="dockClock" aria-label="Clock"></span>
    </div>
  `;

  // Back
  const backBtn = qs("#dockBackBtn");
  backBtn.addEventListener("click", ()=>{
    // If there is no meaningful history, go Home
    if(history.length > 1) history.back();
    else location.href = BASE === "/" ? "/" : BASE;
  });

  // FX
  const fxBtn = qs("#dockFxBtn");
  fxBtn.addEventListener("click", cycleFx);

  // Theme
  const themeBtn = qs("#dockThemeBtn");
  themeBtn.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  // Popover
  let pop = qs("#dockPop");
  if(!pop){
    pop = document.createElement("div");
    pop.id = "dockPop";
    pop.className = "dockPop";
    document.body.appendChild(pop);
  }

  const winBtn = qs("#dockWinBtn");
  if(wm){
    renderWinList(pop, wm);
    winBtn.addEventListener("click", (e)=>{
      e.stopPropagation();
      pop.classList.toggle("is-open");
    });

    // close on outside click
    document.addEventListener("click", (e)=>{
      if(e.target.closest("#dockPop")) return;
      if(e.target.closest("#dockWinBtn")) return;
      pop.classList.remove("is-open");
    });
  }else{
    winBtn.style.display = "none";
  }

  // Reset
  const resetBtn = qs("#dockResetBtn");
  resetBtn.addEventListener("click", ()=>{
    if(wm) wm.reset();
    else location.reload();
  });

  startClock();
}

function renderWinList(pop, wm){
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

  qsa('input[type="checkbox"]', pop).forEach(cb=>{
    cb.addEventListener("change", ()=>{
      wm.show(cb.dataset.win, cb.checked);
    });
  });
}

function initTypewriter(){
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce) return;

  const els = qsa("[data-typing]");
  els.forEach((el, idx)=>{
    const full = (el.textContent || "").trim();
    if(!full) return;
    // Slower typing speed: 25-35ms per character (was 12-18ms)
    const speed = 25 + Math.floor(Math.random()*10);
    const delay = idx * 120; // Slightly longer delay between elements
    el.textContent = "";
    el.classList.add("is-typing");
    setTimeout(()=>{
      let i = 0;
      const timer = setInterval(()=>{
        el.textContent = full.slice(0, i+1);
        i++;
        if(i >= full.length){
          clearInterval(timer);
          el.classList.remove("is-typing");
        }
      }, speed);
    }, delay);
  });
}

async function init(){
  initTheme();
  initFx();

  const wm = initWM();
  buildDock(wm);
  initTypewriter();

  const page = document.body.dataset.page;

  try{
    if(page==="home") await initHome(BASE);
    if(page==="pubs") await initPubs(BASE);
    if(page==="blog") await initBlogIndex(BASE);
    if(page==="post") await initBlogPost(BASE);
    if(page==="projects") await initProjects(BASE);
    if(page==="misc") await initMisc(BASE);
  }catch(err){
    console.error("Page initialization error:", err);
    console.error("BASE path:", BASE);
    console.error("Current URL:", location.href);
    const fallback = qs("#fatal");
    if(fallback){
      fallback.textContent = `Failed to load data. Error: ${err.message || err}. BASE: ${BASE}`;
      fallback.style.color = "var(--muted)";
      fallback.style.fontSize = "11px";
    }
  }
}

init();
