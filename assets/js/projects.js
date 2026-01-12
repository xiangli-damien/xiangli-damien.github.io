import { qs, loadJSON } from "./util.js";

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

export async function initProjects(BASE){
  const projects = await loadJSON(`${BASE}data/projects.json`);
  const list = qs("#projList");

  if(list){
    // Sort projects by year (descending)
    const sortedProjects = [...projects].sort((a, b) => (b.year || 0) - (a.year || 0));
    
    list.innerHTML = sortedProjects.map(p=>`
      <div class="pubItem pubCard">
        <div class="pubMain">
          <div class="pubTitle">${p.title} <span class="muted">(${p.year})</span></div>
          <div class="pubMeta">${p.description}</div>
          <div class="tagRow">${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
          ${p.links ? `
          <div class="pubLinks">
            ${p.links.code ? `<a href="${p.links.code}" target="_blank" rel="noopener">Code</a>` : ""}
            ${p.links.paper ? `<a href="${p.links.paper}" target="_blank" rel="noopener">Paper</a>` : ""}
            ${p.links.demo ? `<a href="${p.links.demo}" target="_blank" rel="noopener">Demo</a>` : ""}
          </div>
          ` : ""}
        </div>
        <div class="pubMedia">${renderMedia(BASE, p.media, "Add media")}</div>
      </div>
    `).join("") || `<div class="muted">Add projects in <code>data/projects.json</code>.</div>`;
  }
}
