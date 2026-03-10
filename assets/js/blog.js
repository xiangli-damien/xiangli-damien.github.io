import { qs, qsa, loadJSON, getParam, formatDateISO } from "./util.js";
import { mdToHtml } from "./md.js";

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
  return `<img src="${src}" alt="${alt}">`;
}

export async function initBlogIndex(BASE){
  const posts = await loadJSON(`${BASE}data/posts.json`);
  const list = qs("#postList");
  const tagSel = qs("#tagFilter");

  const tags = Array.from(new Set(posts.flatMap(p=>p.tags||[]))).sort();
  tagSel.innerHTML = `<option value="">All tags</option>` + tags.map(t=>`<option value="${t}">${t}</option>`).join("");

  function render(){
    const tag = tagSel.value;
    const filtered = posts
      .filter(p=>!tag || (p.tags||[]).includes(tag))
      .sort((a,b)=> String(b.date).localeCompare(String(a.date)));

    list.innerHTML = filtered.map(p=>`
      <article class="entryCard postEntry">
        <div class="entryMain">
          <div class="entryTitle"><a href="${BASE}blog/post.html?slug=${encodeURIComponent(p.slug)}">${(p.title||'').replace(/</g,'&lt;')}</a></div>
          <div class="entryMeta">${formatDateISO(p.date)} • ${(p.summary||'').replace(/</g,'&lt;')}</div>
          <div class="tagRow">${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        </div>
        ${p.media?.src ? `<div class="entryMedia">${renderMedia(BASE, p.media, "Add media")}</div>` : '<div class="entryMedia"><div class="placeholder muted">Add media</div></div>'}
      </article>
    `).join("") || `<p class="muted">No posts.</p>`;
  }

  tagSel.addEventListener("change", render);
  render();
}

export async function initBlogPost(BASE){
  const slug = getParam("slug") || "welcome";
  const meta = await loadJSON(`${BASE}data/posts.json`);
  const post = meta.find(p=>p.slug===slug) || meta[0];

  const title = qs("#postTitle");
  const sub = qs("#postSub");
  const content = qs("#postContent");

  if(title) title.textContent = post?.title || slug;
  if(sub){
    const parts = [post?.summary, formatDateISO(post?.date || ""), (post?.tags||[]).join(", ")].filter(Boolean);
    sub.textContent = parts.join(" • ");
  }

  let md = await fetch(`${BASE}blog/posts/${slug}.md`).then(r=>r.text());
  const fmEnd = md.indexOf("\n---\n", 4);
  if(fmEnd >= 0) md = md.slice(fmEnd + 5).trimStart();

  const hero = post?.media ? `<div class="postMedia postHero">${renderMedia(BASE, post.media, "")}</div>` : "";
  content.innerHTML = hero + mdToHtml(md);

  // TOC: add ids to headings, build nav, scroll progress
  buildPostToc(content);

  const back = qs("#backToBlog");
  if(back) back.href = `${BASE}blog/`;
}

function slugify(t){
  return String(t||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "h";
}

function buildPostToc(contentEl){
  const toc = qs("#postToc");
  const tocNav = qs("#tocNav");
  const tocProgress = qs(".tocProgressFill");
  if(!toc || !tocNav) return;
  const headings = contentEl?.querySelectorAll("h2, h3") || [];
  if(!headings.length){ toc.classList.remove("hasToc"); return; }
  const items = [];
  const used = new Set();
  headings.forEach((h, i)=>{
    let id = slugify(h.textContent) || `h-${i}`;
    while(used.has(id)){ id = `${id}-${i}`; }
    used.add(id);
    h.id = id;
    const cls = h.tagName.toLowerCase()==="h2" ? "tocH2" : "tocH3";
    items.push(`<a href="#${id}" class="${cls}">${h.textContent}</a>`);
  });
  tocNav.innerHTML = items.join("");
  toc.classList.add("hasToc");
  const links = tocNav.querySelectorAll("a");
  links.forEach((a, i)=>{
    a.addEventListener("click", (e)=>{
      e.preventDefault();
      const el = headings[i];
      if(el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${el?.id || ""}`);
    });
  });
  // scroll spy + progress
  function onScroll(){
    if(!tocProgress) return;
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const scrollH = doc.scrollHeight - doc.clientHeight;
    const pct = scrollH > 0 ? Math.min(100, (scrollTop / scrollH) * 100) : 0;
    tocProgress.style.height = `${pct}%`;
    const offset = 160;
    let active = links[0];
    for(let i = headings.length - 1; i >= 0; i--){
      const rect = headings[i].getBoundingClientRect();
      if(rect.top <= offset){ active = links[i]; break; }
    }
    links.forEach(l=>l.classList.remove("active"));
    if(active) active.classList.add("active");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
