import { qs, qsa, clamp, snap } from "./util.js";

function icon(name){
  const common = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if(name==="x") return `<svg viewBox="0 0 24 24" ${common}><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  if(name==="min") return `<svg viewBox="0 0 24 24" ${common}><path d="M6 12h12"/></svg>`;
  if(name==="max") return `<svg viewBox="0 0 24 24" ${common}><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`;
  return "";
}

function pageKey(){
  return location.pathname.replace(/\/+$/,"") || "/";
}

export function initWM(){
  const isDesktop = window.matchMedia("(pointer:fine) and (min-width: 940px)").matches;

  const wins = qsa(".win");
  const z = { v: 10 };

  function bringToFront(win){
    z.v += 1;
    win.style.zIndex = String(z.v);
  }

  function setPos(win, x, y){
    win.style.setProperty("--x", `${x}px`);
    win.style.setProperty("--y", `${y}px`);
  }

  function getPos(win){
    const x = parseFloat(getComputedStyle(win).getPropertyValue("--x")) || 0;
    const y = parseFloat(getComputedStyle(win).getPropertyValue("--y")) || 0;
    return {x,y};
  }

  function setSize(win, w, h){
    if(typeof w === "number") win.style.setProperty("--w", `${w}px`);
    if(typeof h === "number"){
      win.style.setProperty("--h", `${h}px`);
      win.classList.add("has-h");
    }
  }

  function save(win){
    const id = win.dataset.win || win.id;
    if(!id) return;
    const {x,y} = getPos(win);

    const cs = getComputedStyle(win);
    const w = cs.getPropertyValue("--w");
    const h = cs.getPropertyValue("--h");

    const obj = {
      x, y,
      w,
      h,
      minimized: win.classList.contains("is-minimized"),
      max: win.classList.contains("is-max"),
      closed: win.classList.contains("is-closed"),
    };
    localStorage.setItem(`wm:${pageKey()}:${id}`, JSON.stringify(obj));
  }

  function load(win){
    const id = win.dataset.win || win.id;
    if(!id) return;
    const raw = localStorage.getItem(`wm:${pageKey()}:${id}`);
    if(!raw) return;
    try{
      const obj = JSON.parse(raw);
      if(typeof obj.x === "number" && typeof obj.y === "number"){
        setPos(win, obj.x, obj.y);
      }
      if(obj.w) win.style.setProperty("--w", obj.w);

      const h = (obj.h || "").trim();
      if(h){
        win.style.setProperty("--h", h);
        win.classList.add("has-h");
      }else{
        win.style.removeProperty("--h");
        win.classList.remove("has-h");
      }

      win.classList.toggle("is-minimized", !!obj.minimized);
      win.classList.toggle("is-max", !!obj.max);
      win.classList.toggle("is-closed", !!obj.closed);
    }catch{}
  }

  function reset(){
    // Clear all saved window positions - reload will restore HTML defaults
    wins.forEach(win=>{
      const id = win.dataset.win || win.id;
      if(!id) return;
      localStorage.removeItem(`wm:${pageKey()}:${id}`);
    });
    // Reload to restore initial HTML positions (no overlap)
    location.reload();
  }

  function injectTitleButtons(win){
    const left = qs(".tb-left", win);
    if(!left) return;
    left.innerHTML = `
      <button class="tb-btn" data-action="close" aria-label="Close">${icon("x")}</button>
      <button class="tb-btn" data-action="minimize" aria-label="Minimize">${icon("min")}</button>
      <button class="tb-btn" data-action="maximize" aria-label="Maximize">${icon("max")}</button>
    `;
  }

  function bindActions(win){
    qsa("[data-action]", win).forEach(btn=>{
      btn.addEventListener("click", (e)=>{
        e.stopPropagation();
        const act = btn.dataset.action;
        if(act==="close"){
          win.classList.add("is-closed");
        }else if(act==="minimize"){
          win.classList.toggle("is-minimized");
        }else if(act==="maximize"){
          win.classList.toggle("is-max");
        }
        save(win);
      });
    });
  }

  function applyFX(win, kind, at){
    const k = kind || win.dataset.clickfx || "wobble";
    const kClass = (k === "burst") ? "pop" : k;

    // class-based FX
    const classMap = {
      wobble: "wobble",
      jitter: "fx-jitter",
      pop: "fx-pop",
      pulse: "fx-pulse",
      blink: "fx-blink",
    };
    const cls = classMap[kClass];
    if(cls){
      win.classList.remove(cls);
      // force reflow
      void win.offsetWidth;
      win.classList.add(cls);
      setTimeout(()=>win.classList.remove(cls), 260);
    }

    // pixel burst (optional)
    if(k === "burst" && at){
      const burst = document.createElement("span");
      burst.className = "pix-burst";
      burst.style.left = `${at.x}px`;
      burst.style.top = `${at.y}px`;

      const n = 8;
      for(let i=0;i<n;i++){
        const p = document.createElement("span");
        p.className = "pix";
        const ang = (Math.PI*2) * (i/n);
        const r = 10 + Math.random()*10;
        p.style.setProperty("--dx", `${Math.cos(ang)*r}px`);
        p.style.setProperty("--dy", `${Math.sin(ang)*r}px`);
        p.style.left = `${12 + (Math.random()*4 - 2)}px`;
        p.style.top = `${12 + (Math.random()*4 - 2)}px`;
        burst.appendChild(p);
      }
      win.appendChild(burst);
      setTimeout(()=>burst.remove(), 520);
    }
  }

  function enableClickFX(win){
    let down = null;
    const threshold = 6;

    win.addEventListener("pointerdown", (e)=>{
      if(e.button !== 0) return;
      bringToFront(win);

      // ignore interactions (inputs, buttons, links, resizers, titlebar)
      if(e.target.closest("[data-action]")) return;
      if(e.target.closest("a,button,input,textarea,select,label")) return;
      if(e.target.closest(".rz")) return;
      if(e.target.closest(".titlebar")) return;

      down = { x: e.clientX, y: e.clientY };
    });

    win.addEventListener("pointerup", (e)=>{
      if(!down) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      down = null;

      if(Math.hypot(dx,dy) > threshold) return;
      if(win.classList.contains("is-dragging")) return;
      if(win.classList.contains("is-resizing")) return;

      const rect = win.getBoundingClientRect();
      const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      applyFX(win, win.dataset.clickfx, at);
    });
  }

  function enableDrag(win){
    const bar = qs(".titlebar", win);
    if(!bar) return;
    let drag = null;

    bar.addEventListener("dblclick", ()=>{
      if(!isDesktop) return;
      win.classList.toggle("is-max");
      save(win);
    });

    bar.addEventListener("pointerdown", (e)=>{
      if(!isDesktop) return;
      if(win.classList.contains("is-max")) return;
      if(e.button !== 0) return;
      // ignore clicks on window control buttons
      if(e.target.closest("[data-action]")) return;

      bringToFront(win);
      win.classList.add("is-dragging");
      const start = {x: e.clientX, y: e.clientY};
      const pos = getPos(win);
      drag = { start, pos };
      bar.setPointerCapture(e.pointerId);
    });

    bar.addEventListener("pointermove", (e)=>{
      if(!drag) return;
      const dx = e.clientX - drag.start.x;
      const dy = e.clientY - drag.start.y;

      let nx = drag.pos.x + dx;
      let ny = drag.pos.y + dy;

      // keep it roughly in viewport
      nx = clamp(nx, -40, window.innerWidth - 120);
      ny = clamp(ny, -20, window.innerHeight - 120);

      setPos(win, snap(nx, 2), snap(ny, 2));
    });

    bar.addEventListener("pointerup", ()=>{
      if(!drag) return;
      win.classList.remove("is-dragging");
      drag = null;
      save(win);
    });
  }

  function addResizers(win){
    if(!isDesktop) return;
    if(qs(".rz", win)) return;
    const dirs = ["n","e","s","w","ne","nw","se","sw"];
    dirs.forEach(dir=>{
      const el = document.createElement("div");
      el.className = "rz";
      el.dataset.dir = dir;
      win.appendChild(el);
    });
  }

  function enableResize(win){
    if(!isDesktop) return;
    addResizers(win);

    let rs = null;
    const minW = parseFloat(win.dataset.minw || "260");
    const minH = parseFloat(win.dataset.minh || "160");

    qsa(".rz", win).forEach(handle=>{
      handle.addEventListener("pointerdown", (e)=>{
        if(e.button !== 0) return;
        if(win.classList.contains("is-max")) return;
        e.stopPropagation();
        bringToFront(win);

        const dir = handle.dataset.dir;
        const start = { x: e.clientX, y: e.clientY };
        const pos = getPos(win);
        const rect = win.getBoundingClientRect();

        rs = {
          dir,
          start,
          pos,
          w: rect.width,
          h: rect.height,
        };

        win.classList.add("is-resizing");
        handle.setPointerCapture(e.pointerId);

        // ensure we have an explicit height once resizing starts
        win.style.setProperty("--h", `${rs.h}px`);
        win.classList.add("has-h");
      });

      handle.addEventListener("pointermove", (e)=>{
        if(!rs) return;
        if(win.classList.contains("is-max")) return;

        const dx = e.clientX - rs.start.x;
        const dy = e.clientY - rs.start.y;

        let nw = rs.w;
        let nh = rs.h;
        let nx = rs.pos.x;
        let ny = rs.pos.y;

        if(rs.dir.includes("e")) nw = rs.w + dx;
        if(rs.dir.includes("s")) nh = rs.h + dy;

        if(rs.dir.includes("w")){
          nw = rs.w - dx;
        }
        if(rs.dir.includes("n")){
          nh = rs.h - dy;
        }

        const maxW = Math.max(minW, window.innerWidth - 40);
        const maxH = Math.max(minH, window.innerHeight - 160);

        nw = clamp(nw, minW, maxW);
        nh = clamp(nh, minH, maxH);

        // if clamped, adjust x/y for west/north resize
        if(rs.dir.includes("w")){
          const actualDx = rs.w - nw;
          nx = rs.pos.x + actualDx;
        }
        if(rs.dir.includes("n")){
          const actualDy = rs.h - nh;
          ny = rs.pos.y + actualDy;
        }

        setPos(win, snap(nx, 2), snap(ny, 2));
        setSize(win, snap(nw, 2), snap(nh, 2));
      });

      handle.addEventListener("pointerup", ()=>{
        if(!rs) return;
        rs = null;
        win.classList.remove("is-resizing");
        save(win);
      });
    });
  }

  // init all windows
  wins.forEach(win=>{
    injectTitleButtons(win);
    load(win);
    bringToFront(win);
    enableClickFX(win);
    bindActions(win);
    enableDrag(win);
    enableResize(win);
  });

  function listWindows(){
    return wins.map(win=>{
      const id = win.dataset.win || win.id;
      const label = win.dataset.label || id || "window";
      return { id, label, el: win, closed: win.classList.contains("is-closed") };
    }).filter(w=>w.id);
  }

  function show(id, v){
    const win = wins.find(w => (w.dataset.win||w.id) === id);
    if(!win) return;
    win.classList.toggle("is-closed", !v);
    if(v) bringToFront(win);
    save(win);
  }

  return { listWindows, show, reset, isDesktop };
}
