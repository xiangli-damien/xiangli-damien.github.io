import { qs, qsa, loadJSON } from "./util.js";
import { mdToHtml } from "./md.js";

export async function initMisc(BASE){
  const cv = await loadJSON(`${BASE}data/cv.json`);
  const profile = await loadJSON(`${BASE}data/profile.json`);

  // CV highlights
  const cvBox = qs("#cvBox");
  if(cvBox){
    cvBox.innerHTML = `
      <div class="pubItem">
        <div class="pubTitle">Education</div>
        <div class="pubMeta">
          <ul>
            ${cv.education.map(e=>`<li><strong>${e.where}</strong> — ${e.what} <span class="muted">(${e.when})</span></li>`).join("")}
          </ul>
        </div>
      </div>

      <div class="pubItem">
        <div class="pubTitle">Research</div>
        <div class="pubMeta">
          ${cv.experience.map(x=>`
            <div style="margin:16px 0 0">
              <div><strong>${x.title}</strong></div>
              ${x.subtitle ? `<div class="muted" style="font-size:13px; margin-top:2px;">${x.subtitle}</div>` : ""}
              <div class="muted" style="font-size:12px; margin-top:2px;">${x.when} ${x.where ? `| ${x.where}` : ""}</div>
              <ul style="margin-top:8px;">${x.bullets.map(b=>`<li style="margin:4px 0;">${b}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="pubItem">
        <div class="pubTitle">Teaching Experience</div>
        <div class="pubMeta">
          <ul>
            ${(cv.teaching || []).map(t=>`<li><strong>${t.title}</strong> <span class="muted">(${t.when})</span></li>`).join("")}
          </ul>
        </div>
      </div>

      <div class="pubItem">
        <div class="pubTitle">Honors & Awards</div>
        <div class="pubMeta">
          <ul>
            ${(cv.honors || []).map(h=>`<li><strong>${h.title}</strong> <span class="muted">(${h.when})</span></li>`).join("")}
          </ul>
        </div>
      </div>

      <div class="pubItem">
        <div class="pubTitle">Skills</div>
        <div class="pubMeta">
          <div class="kvs">
            ${Object.entries(cv.skills || {}).map(([k,v])=>`
              <div class="kv"><div class="k">${k}</div><div class="v">${(v||[]).join(" • ")}</div></div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="pubItem">
        <div class="pubTitle">Download CV</div>
        <div class="pubLinks">
          <a href="${BASE}${profile.links.cv}" target="_blank" rel="noopener">CV PDF</a>
        </div>
      </div>
    `;
  }

}
