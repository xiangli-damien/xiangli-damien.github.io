import { qs, qsa, loadJSON, copyText, escapeRegExp } from "./util.js";
import { mdToHtml } from "./md.js";

function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }
function matches(p, q){ if(!q) return true; const s=q.toLowerCase(); return `${p.title||''} ${p.authors||''} ${p.venue||''} ${p.year||''} ${p.type||''}`.toLowerCase().includes(s); }

function renderMedia(BASE, media){
  if(!media?.src) return "";
  const src = media.src.startsWith("http") ? media.src : `${BASE}${media.src}`;
  if(media.type === "video") return `<div class="entryMedia"><video src="${src}" controls playsinline></video></div>`;
  return `<div class="entryMedia"><img src="${src}" alt="${(media.alt||'').replace(/"/g,'&quot;')}"></div>`;
}

function highlightSelf(authors, selfName){
  if(!authors || !selfName) return authors || "";
  return authors.replace(new RegExp(`\\b${escapeRegExp(selfName)}\\b`, "g"), `<span class="authorSelf">${selfName}</span>`);
}

function renderEntry(p, selfName, BASE){
  const absId = `abs-${String(p.title||'').replace(/[^a-z0-9]/gi,'-')}`;
  const bib = p.bibtex ? encodeURIComponent(p.bibtex) : "";
  return `
    <article class="entryCard pubEntry">
      <div class="entryMain">
        <div class="entryTitle">${(p.title||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div class="entryMeta">${highlightSelf(p.authors, selfName)}<br><span class="muted">${(p.venue||'')} • ${p.year||''} • ${p.type||""}</span></div>
        <div class="entryActions">
          ${p.links?.pdf ? `<a href="${p.links.pdf}" target="_blank" rel="noopener">PDF</a>` : ""}
          ${p.links?.url ? `<a href="${p.links.url}" target="_blank" rel="noopener">Link</a>` : ""}
          ${p.links?.doi ? `<a href="${p.links.doi}" target="_blank" rel="noopener">DOI</a>` : ""}
          ${p.links?.code ? `<a href="${p.links.code}" target="_blank" rel="noopener">Code</a>` : ""}
          ${p.abstract ? `<button type="button" data-toggle-abs="${absId}">Abstract</button>` : ""}
          ${p.bibtex ? `<button type="button" data-copy-bib="${bib}">Copy BibTeX</button>` : ""}
        </div>
        ${p.abstract ? `<div id="${absId}" class="entryAbstract" hidden>${mdToHtml(p.abstract)}</div>` : ""}
      </div>
      ${renderMedia(BASE, p.media)}
    </article>`;
}

export async function initPubs(BASE){
  const [pubs, profile] = await Promise.all([
    loadJSON(`${BASE}data/publications.json`),
    loadJSON(`${BASE}data/profile.json`).catch(()=>({})),
  ]);
  const selfName = profile.name || "Xiang Li";

  const qInput = qs("#pubQuery");
  const typeSel = qs("#pubType");
  const yearSel = qs("#pubYear");
  const list = qs("#pubList");

  const types = uniq(pubs.map(p=>p.type)).filter(Boolean).sort();
  const years = uniq(pubs.map(p=>String(p.year))).sort((a,b)=>b.localeCompare(a));
  typeSel.innerHTML = `<option value="">All types</option>` + types.map(t=>`<option value="${t}">${t}</option>`).join("");
  yearSel.innerHTML = `<option value="">All years</option>` + years.map(y=>`<option value="${y}">${y}</option>`).join("");

  function render(){
    const q = qInput?.value?.trim() || "";
    const type = typeSel?.value || "";
    const year = yearSel?.value || "";
    const filtered = pubs.filter(p=>matches(p,q)).filter(p=>!type||p.type===type).filter(p=>!year||String(p.year)===year).sort((a,b)=>(b.year||0)-(a.year||0));

    list.innerHTML = filtered.length ? filtered.map(p=>renderEntry(p, selfName, BASE)).join("") : `<p class="muted">No publications match.</p>`;

    qsa("[data-toggle-abs]", list).forEach(btn=>{
      btn.onclick = ()=>{
        const el = qs(`#${btn.dataset.toggleAbs}`);
        if(!el) return;
        const hidden = el.hasAttribute("hidden");
        el.toggleAttribute("hidden", !hidden);
        btn.textContent = hidden ? "Hide Abstract" : "Abstract";
      };
    });
    qsa("[data-copy-bib]", list).forEach(btn=>{
      btn.onclick = async ()=>{
        const text = decodeURIComponent(btn.dataset.copyBib || "");
        if(!text) return;
        const old = btn.textContent;
        try{ await copyText(text); btn.textContent = "Copied"; }catch{ btn.textContent = "Copy failed"; }
        setTimeout(()=>{ btn.textContent = old; }, 1400);
      };
    });
  }

  qInput?.addEventListener("input", render);
  typeSel?.addEventListener("change", render);
  yearSel?.addEventListener("change", render);
  render();
}
