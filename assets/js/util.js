export function basePath(){
  // GitHub Pages auto base detection:
  // - user site: https://username.github.io/  -> base "/"
  // - project site: https://username.github.io/repo/ -> base "/repo/"
  if(location.hostname.endsWith("github.io")){
    const parts = location.pathname.split("/").filter(Boolean);
    const known = new Set(["pubs","blog","misc","projects","assets","data","serverless","index.html","404.html"]);
    if(parts.length === 0) return "/";
    if(known.has(parts[0])) return "/";
    // For user site (username.github.io), return "/"
    // Check if it's a user site by checking if path starts with known pages
    if(parts.length > 0 && known.has(parts[0])) return "/";
    // project repo is first segment
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
