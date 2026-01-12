export function basePath(){
  // GitHub Pages auto base detection:
  // For user site (username.github.io), always return "/"
  // For project site (username.github.io/repo/), return "/repo/"
  
  if(location.hostname.endsWith("github.io")){
    const pathParts = location.pathname.split("/").filter(Boolean);
    
    // Empty path -> user site
    if(pathParts.length === 0) return "/";
    
    // Known page directories -> user site (these are our pages)
    const knownPages = new Set(["pubs","blog","misc","projects","assets","data","serverless"]);
    if(knownPages.has(pathParts[0])) return "/";
    
    // index.html or 404.html -> user site
    if(pathParts[0] === "index.html" || pathParts[0] === "404.html") return "/";
    
    // For xiangli-damien.github.io, it's a user site, always return "/"
    // Only project sites would have a different first segment
    // Since we've checked all known pages above, any remaining first segment
    // would be a project repo name, but for user sites we want "/"
    return "/";
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
