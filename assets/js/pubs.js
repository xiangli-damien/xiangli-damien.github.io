import { qs, qsa, loadJSON } from "./util.js";

function mediaSrc(BASE, src){
  if(!src) return "";
  if(/^https?:\/\//i.test(src)) return src;
  return `${BASE}${src}`;
}

function renderMedia(BASE, m, fallbackText){
  if(!m || !m.src){
    return `<div class="placeholder">${fallbackText || "No media"}</div>`;
  }

  const src = mediaSrc(BASE, m.src);
  const alt = m.alt || "media";

  if(m.type === "video"){
    return `<video src="${src}" controls playsinline></video>`;
  }
  // img / gif (render both with <img>)
  return `<img src="${src}" alt="${alt}">`;
}

function uniq(arr){
  return Array.from(new Set(arr.filter(Boolean)));
}

function matches(p, q){
  if(!q) return true;
  const s = q.toLowerCase();
  const hay = `${p.title} ${p.authors} ${p.venue} ${p.year} ${p.type}`.toLowerCase();
  return hay.includes(s);
}

export async function initPubs(BASE){
  const pubs = await loadJSON(`${BASE}data/publications.json`);

  const qInput = qs("#pubQuery");
  const typeSel = qs("#pubType");
  const yearSel = qs("#pubYear");
  const list = qs("#pubList");

  // populate filters
  const types = uniq(pubs.map(p=>p.type)).sort();
  const years = uniq(pubs.map(p=>String(p.year))).sort((a,b)=>b.localeCompare(a));

  typeSel.innerHTML = `<option value="">All types</option>` + types.map(t=>`<option value="${t}">${t}</option>`).join("");
  yearSel.innerHTML = `<option value="">All years</option>` + years.map(y=>`<option value="${y}">${y}</option>`).join("");

  function render(){
    const q = qInput.value.trim();
    const type = typeSel.value;
    const year = yearSel.value;

    const filtered = pubs
      .filter(p=>matches(p,q))
      .filter(p=>!type || p.type===type)
      .filter(p=>!year || String(p.year)===year)
      .sort((a,b)=> (b.year||0) - (a.year||0));

    list.innerHTML = filtered.map(p => `
      <div class="pubItem pubCard">
        <div class="pubMain">
          <div class="pubTitle">${p.title}</div>
          <div class="pubMeta">${p.authors}<br><span class="muted">${p.venue} • ${p.year} • ${p.type || ""}</span></div>
          <div class="pubLinks">
            ${p.links?.pdf ? `<a href="${p.links.pdf}" target="_blank" rel="noopener">PDF</a>` : ""}
            ${p.links?.url ? `<a href="${p.links.url}" target="_blank" rel="noopener">Link</a>` : ""}
            ${p.links?.doi ? `<a href="${p.links.doi}" target="_blank" rel="noopener">DOI</a>` : ""}
            ${p.links?.code ? `<a href="${p.links.code}" target="_blank" rel="noopener">Code</a>` : ""}
            ${p.abstract ? `<button data-abstract="${encodeURIComponent(p.abstract)}">Abstract</button>` : ""}
            ${p.bibtex ? `<button data-bib="${encodeURIComponent(p.bibtex)}">BibTeX</button>` : ""}
          </div>
        </div>
        <div class="pubMedia">${renderMedia(BASE, p.media, "Add media")}</div>
      </div>
    `).join("") || `<div class="muted">No results.</div>`;

    // bind modal buttons
    qsa("button[data-bib]", list).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        openModal("BibTeX", decodeURIComponent(btn.dataset.bib), true);
      });
    });
    qsa("button[data-abstract]", list).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        openModal("Abstract", decodeURIComponent(btn.dataset.abstract), false);
      });
    });
  }

  function openModal(title, body, isCode){
    const modal = qs("#modalWin");
    const t = qs("#modalTitle");
    const b = qs("#modalBody");
    const pre = qs("#modalPre");

    t.textContent = title;
    if(isCode){
      pre.style.display = "block";
      b.style.display = "none";
      pre.textContent = body;
    }else{
      pre.style.display = "none";
      b.style.display = "block";
      b.textContent = body;
    }

    modal.classList.remove("is-closed");
    modal.classList.remove("is-minimized");
    modal.style.setProperty("--x","120px");
    modal.style.setProperty("--y","120px");
    modal.style.zIndex = "999";
  }

  qInput.addEventListener("input", render);
  typeSel.addEventListener("change", render);
  yearSel.addEventListener("change", render);

  // close modal button
  const close = qs("#modalClose");
  if(close){
    close.addEventListener("click", ()=>{
      qs("#modalWin").classList.add("is-closed");
    });
  }

  render();
}
