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
      <div class="postItem postCard">
        <div class="postMain">
          <div class="postTitle"><a href="${BASE}blog/post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a></div>
          <div class="pubMeta">${formatDateISO(p.date)} • ${p.summary || ""}</div>
          <div class="tagRow">${(p.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        </div>
        <div class="postMedia">${renderMedia(BASE, p.media, "Add media")}</div>
      </div>
    `).join("") || `<div class="muted">No posts.</div>`;
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
  if(sub) sub.textContent = `${formatDateISO(post?.date || "")} • ${(post?.tags||[]).join(", ")}`;

  const md = await fetch(`${BASE}blog/posts/${slug}.md`).then(r=>r.text());

  // Optional hero media (kept lightweight; no build step)
  const hero = post?.media ? `<div class="postMedia postHero">${renderMedia(BASE, post.media, "")}</div>` : "";
  content.innerHTML = hero + mdToHtml(md);

  const back = qs("#backToBlog");
  if(back) back.href = `${BASE}blog/`;
}
