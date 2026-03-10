import { qs, loadJSON } from "./util.js";

export async function initMisc(BASE){
  const [cv, profile] = await Promise.all([
    loadJSON(`${BASE}data/cv.json`).catch(()=>({})),
    loadJSON(`${BASE}data/profile.json`).catch(()=>({})),
  ]);

  const download = qs('#cvDownload');
  if(download) download.href = `${BASE}${profile.links?.cv||''}`;

  const education = qs('#cvEducation');
  if(education){
    const items = cv.education || [];
    education.innerHTML = items.length ? items.map(e=>`
      <article class="listCard">
        <h3>${(e.where||'').replace(/</g,'&lt;')}</h3>
        <div class="entryMeta">${(e.what||'').replace(/</g,'&lt;')}</div>
        <div class="muted">${(e.when||'')}${e.where2 ? ` • ${e.where2}` : ''}</div>
      </article>
    `).join('') : `<p class="muted">No education items.</p>`;
  }

  const experience = qs('#cvExperience');
  if(experience){
    const items = cv.experience || [];
    experience.innerHTML = items.length ? items.map(x=>`
      <article class="listCard">
        <h3>${(x.title||'').replace(/</g,'&lt;')}</h3>
        ${x.subtitle ? `<div class="muted" style="font-size:13px; margin-top:2px;">${(x.subtitle||'').replace(/</g,'&lt;')}</div>` : ''}
        <div class="muted">${(x.when||'')}${x.where ? ` • ${x.where}` : ''}</div>
        <ul>${(x.bullets||[]).map(b=>`<li>${(b||'').replace(/</g,'&lt;')}</li>`).join('')}</ul>
      </article>
    `).join('') : `<p class="muted">No experience items.</p>`;
  }

  const teaching = qs('#cvTeaching');
  if(teaching){
    const items = cv.teaching || [];
    teaching.innerHTML = items.length ? items.map(t=>`
      <article class="listCard compact">
        <h3>${(t.title||'').replace(/</g,'&lt;')}</h3>
        <div class="muted">${t.when||''}</div>
      </article>
    `).join('') : `<p class="muted">No teaching items.</p>`;
  }

  const honors = qs('#cvHonors');
  if(honors){
    const items = cv.honors || [];
    honors.innerHTML = items.length ? items.map(h=>{
      const title = typeof h === 'string' ? h : h.title;
      const when = typeof h === 'object' ? h.when : '';
      return `<article class="listCard compact"><h3>${(title||'').replace(/</g,'&lt;')}</h3><div class="muted">${when}</div></article>`;
    }).join('') : `<p class="muted">No honors listed.</p>`;
  }

  const skills = qs('#cvSkills');
  if(skills){
    const entries = Object.entries(cv.skills || {});
    skills.innerHTML = entries.length ? entries.map(([k,v])=>`
      <article class="skillCard"><h3>${k.replace(/</g,'&lt;')}</h3><p>${(v||[]).join(' • ')}</p></article>
    `).join('') : `<p class="muted">No skills listed.</p>`;
  }

}
