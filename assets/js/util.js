export function basePath(){
  // GitHub Pages auto base detection:
  // - user site: https://username.github.io/  -> base "/"
  // - project site: https://username.github.io/repo/ -> base "/repo/"
  if(location.hostname.endsWith("github.io")){
    const parts = location.pathname.split("/").filter(Boolean);
    const knownPages = new Set(["pubs","blog","misc","projects","assets","data","serverless"]);
    
    // Empty path or root -> user site
    if(parts.length === 0) return "/";
    
    // If first part is a known page, it's a user site
    if(knownPages.has(parts[0])) return "/";
    
    // If first part is index.html or 404.html, it's root
    if(parts[0] === "index.html" || parts[0] === "404.html") return "/";
    
    // Otherwise, assume it's a project site
    return "/" + parts[0] + "/";
  }
  // Local development
  return "/";
}

export function qs(sel, el=document){ return el.querySelector(sel); }
export function qsa(sel, el=document){ return Array.from(el.querySelectorAll(sel)); }

export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
export function snap(v, step=8){ return Math.round(v/step)*step; }

export async function loadJSON(url){
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if(!res.ok) {
      throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  } catch(err) {
    console.error(`Error loading JSON from ${url}:`, err);
    throw err;
  }
}

export function getParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

export function formatDateISO(iso){
  // yyyy-mm-dd
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  if(!y) return iso;
  return `${y}/${m}/${d}`;
}
