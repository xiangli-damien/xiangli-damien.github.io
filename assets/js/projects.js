import { qs, qsa, loadJSON } from "./util.js";
import { mdToHtml } from "./md.js";

function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }
function matches(p, q){ if(!q) return true; const s=q.toLowerCase(); return `${p.title||''} ${(p.description||'').split('\n').join(' ')} ${(p.tags||[]).join(' ')} ${p.year||''}`.toLowerCase().includes(s); }

function renderMedia(BASE, media){
  if(!media?.src) return "";
  const src = media.src.startsWith("http") ? media.src : `${BASE}${media.src}`;
  if(media.type === "video") return `<div class="projectMedia"><video src="${src}" controls playsinline></video></div>`;
  return `<div class="projectMedia"><img src="${src}" alt="${(media.alt||'').replace(/"/g,'&quot;')}"></div>`;
}

export async function initProjects(BASE){
  const projects = await loadJSON(`${BASE}data/projects.json`);
  const qInput = qs("#projectQuery");
  const tagSel = qs("#projectTag");
  const yearSel = qs("#projectYear");
  const grid = qs("#projectGrid");

  const tags = uniq(projects.flatMap(p=>p.tags||[])).sort();
  const years = uniq(projects.map(p=>String(p.year))).sort((a,b)=>b.localeCompare(a));
  tagSel.innerHTML = `<option value="">All tags</option>` + tags.map(t=>`<option value="${t}">${t}</option>`).join("");
  yearSel.innerHTML = `<option value="">All years</option>` + years.map(y=>`<option value="${y}">${y}</option>`).join("");

  function render(){
    const q = qInput?.value?.trim() || "";
    const tag = tagSel?.value || "";
    const year = yearSel?.value || "";
    const filtered = projects.filter(p=>matches(p,q)).filter(p=>!tag||(p.tags||[]).includes(tag)).filter(p=>!year||String(p.year)===year).sort((a,b)=>(b.year||0)-(a.year||0));

    grid.innerHTML = filtered.length ? filtered.map(p=>{
      const preview = String(p.description||"").split(/\n+/).slice(0,2).join(" ");
      const fullHtml = mdToHtml(p.description||"");
      return `<article class="projectCard">
          ${renderMedia(BASE, p.media)}
          <div class="projectHead">
            <h3>${(p.title||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</h3>
            <span class="projectYear">${p.year||""}</span>
          </div>
          <div class="tagRow">${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
          <div class="projectPreview">${(preview||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          <details class="projectDetails">
            <summary>Read more</summary>
            <div class="projectDetailsBody">${fullHtml}</div>
          </details>
          <div class="entryActions">
            ${p.links?.paper ? `<a href="${p.links.paper}" target="_blank" rel="noopener">Paper</a>` : ''}
            ${p.links?.code ? `<a href="${p.links.code}" target="_blank" rel="noopener">Code</a>` : ''}
            ${p.links?.demo ? `<a href="${p.links.demo}" target="_blank" rel="noopener">Demo</a>` : ''}
          </div>
        </article>`;
    }).join("") : `<p class="muted">No projects match.</p>`;
  }

  qInput?.addEventListener("input", render);
  tagSel?.addEventListener("change", render);
  yearSel?.addEventListener("change", render);
  render();
}
