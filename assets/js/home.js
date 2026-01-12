import { qs, qsa, loadJSON } from "./util.js";
import { mdToHtml, inlineMdWithHtml } from "./md.js";
import { initLens } from "./lens.js";

function fmtLinks(links){
  const rows = [];
  if(links.scholar) rows.push(`<a href="${links.scholar}" target="_blank" rel="noopener">Scholar</a>`);
  if(links.github) rows.push(`<a href="${links.github}" target="_blank" rel="noopener">GitHub</a>`);
  if(links.linkedin) rows.push(`<a href="${links.linkedin}" target="_blank" rel="noopener">LinkedIn</a>`);
  if(links.twitter) rows.push(`<a href="${links.twitter}" target="_blank" rel="noopener">X</a>`);
  if(links.cv) rows.push(`<a href="${links.cv}" target="_blank" rel="noopener">CV</a>`);
  return rows.join(" <span class=\"muted\">|</span> ");
}

function sortNews(items){
  return [...items].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}

export async function initHome(BASE){
  const profile = await loadJSON(`${BASE}data/profile.json`);
  const news = await loadJSON(`${BASE}data/news.json`);

  // whoami
  const who = qs("#whoami");
  if(who){
    const aiAvatars = (profile.avatarAI && profile.avatarAI.length)
      ? profile.avatarAI
      : [profile.avatar];
    const realAvatar = profile.avatarReal || profile.avatar;

    who.innerHTML = `
      <div class="avatarRow">
        <div class="avatar avatarClickable">
          <img id="avatarImg" src="${BASE}${aiAvatars[0]}" alt="avatar" draggable="false">
        </div>
        <div class="nameBlock">
          <div class="name">${profile.name}</div>
          <div class="tagline">${profile.tagline}</div>
          <div class="muted" style="margin-top:6px; font-size:13px;">${profile.affiliation}</div>
        </div>
      </div>
      <div class="links">${fmtLinks(profile.links)}</div>
      <div class="kvs">
        <div class="kv"><div class="k">Location</div><div class="v">${profile.location}</div></div>
        <div class="kv"><div class="k">Email</div><div class="v"><a href="mailto:${profile.email}">${profile.email}</a></div></div>
      </div>
      ${profile.quickFacts ? `
        <div class="kvs" style="margin-top:10px">
          ${profile.quickFacts.map(f => `
            <div class="kv"><div class="k">${f.k}</div><div class="v">${f.v}</div></div>
          `).join("")}
        </div>
      ` : ""}
    `;

    // Avatar: click cycles AI variants; hover shows real photo.
    const img = qs("#avatarImg", who);
    if(img){
      let idx = 0;

      img.addEventListener("click", ()=>{
        idx = (idx + 1) % aiAvatars.length;
        img.src = `${BASE}${aiAvatars[idx]}`;
      });
      img.addEventListener("pointerenter", ()=>{
        img.src = `${BASE}${realAvatar}`;
      });
      img.addEventListener("pointerleave", ()=>{
        img.src = `${BASE}${aiAvatars[idx]}`;
      });
    }
  }

  // profile markdown
  const about = qs("#about");
  if(about) about.innerHTML = mdToHtml(profile.about_md);

  // updates
  const up = qs("#updates");
  if(up){
    const items = sortNews(news).slice(0, 6);
    up.innerHTML = `
      <ul>
        ${items.map(it=>{
          const processedText = inlineMdWithHtml(it.text);
          const txt = it.url ? `<a href="${it.url}" target="_blank" rel="noopener">${processedText}</a>` : processedText;
          return `<li><span class="muted">${it.date}:</span> ${txt}</li>`;
        }).join("")}
      </ul>
      <div class="muted" style="margin-top:8px; font-family:var(--mono); font-size:12px;">${profile.updatesHint || ""}</div>
    `;
  }

  // lens
  const canvas = qs("#lensCanvas");
  if(canvas){
    const lens = initLens(canvas, { mode: "trajectories" });

    const qEl = qs("#lensQuestion");
    const paperEl = qs("#lensPaper");

    function setNarrative(mode){
      // map mode -> theme
      const t = (profile.researchThemes || []).find(x => x.key === mode);
      if(qEl) qEl.textContent = (t && (t.question || t.oneLiner))
        || "I study geometric dynamics of hidden representations in LLMs.";

      if(paperEl){
        // Featured work display removed
        paperEl.innerHTML = "";
      }
    }

    const modeBtns = qsa("[data-lens-mode]");
    modeBtns.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        modeBtns.forEach(b=>b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const m = btn.dataset.lensMode;
        lens.setMode(m);
        setNarrative(m);
      });
    });

    setNarrative(lens.mode);
  }
}
