export function escapeHtml(str){
  return str.replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

/* Minimal, safe markdown for this site (headings, lists, links, code, quotes, callouts).
   Not a full spec; intentionally small. */
export function mdToHtml(md){
  if(!md) return "";
  let text = md.replace(/\r\n/g,"\n");

  // Extract HTML tags to preserve them (match complete tags like <tag attr="value">content</tag>)
  const htmlTags = [];
  text = text.replace(/<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g, (match, tagName, attrs, content) => {
    const idx = htmlTags.length;
    htmlTags.push(match);
    return `@@HTML_${idx}@@`;
  });
  // Also match self-closing tags
  text = text.replace(/<([^>]+)\/>/g, (match) => {
    const idx = htmlTags.length;
    htmlTags.push(match);
    return `@@HTML_${idx}@@`;
  });

  // code fences
  const fences = [];
  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    const idx = fences.length;
    fences.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `@@FENCE_${idx}@@`;
  });

  // callouts :::note ... :::
  text = text.replace(/:::(note|tip|warn)\n([\s\S]*?)\n:::/g, (_, kind, body) => {
    const label = kind.toUpperCase();
    return `<div class="callout callout-${kind}"><div class="callout-title">${label}</div><div class="callout-body">${mdToHtml(body)}</div></div>`;
  });

  // blockquotes
  text = text.replace(/^>\s?(.*)$/gm, (_, line)=>`<blockquote>${inline(line)}</blockquote>`);

  // headings
  text = text.replace(/^###\s+(.*)$/gm, (_,t)=>`<h3>${inline(t)}</h3>`);
  text = text.replace(/^##\s+(.*)$/gm, (_,t)=>`<h2>${inline(t)}</h2>`);
  text = text.replace(/^#\s+(.*)$/gm, (_,t)=>`<h1>${inline(t)}</h1>`);

  // unordered lists
  // group consecutive list items
  text = text.replace(/(?:^(?:-|\*)\s+.*\n)+/gm, (block)=>{
    const items = block.trim().split("\n").map(l=>l.replace(/^(?:-|\*)\s+/,""));
    return `<ul>${items.map(it=>`<li>${inline(it)}</li>`).join("")}</ul>\n`;
  });

  // ordered lists
  text = text.replace(/(?:^\d+\.\s+.*\n)+/gm, (block)=>{
    const items = block.trim().split("\n").map(l=>l.replace(/^\d+\.\s+/,""));
    return `<ol>${items.map(it=>`<li>${inline(it)}</li>`).join("")}</ol>\n`;
  });

  // horizontal rule
  text = text.replace(/^---$/gm, "<hr/>");

  // paragraphs: split by blank lines, ignore blocks already converted
  const parts = text.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);
  let html = parts.map(p=>{
    if(p.startsWith("<h") || p.startsWith("<ul>") || p.startsWith("<ol>") || p.startsWith("<pre>") || p.startsWith("<blockquote") || p.startsWith("<div class=\"callout") || p.startsWith("<hr")) return p;
    return `<p>${inline(p)}</p>`;
  }).join("\n");

  // restore HTML tags
  html = html.replace(/@@HTML_(\d+)@@/g, (_,i)=>htmlTags[Number(i)]);
  
  // restore fences
  html = html.replace(/@@FENCE_(\d+)@@/g, (_,i)=>fences[Number(i)]);

  return html;
}

function inline(s){
  let t = escapeHtml(s);

  // inline code
  t = t.replace(/`([^`]+)`/g, (_,c)=>`<code>${escapeHtml(c)}</code>`);

  // bold / italic
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_,a,href)=>`<a href="${href}" target="_blank" rel="noopener">${a}</a>`);

  return t;
}

/* Process inline markdown while preserving existing HTML tags */
export function inlineMdWithHtml(s){
  if(!s) return "";
  
  // Extract HTML tags to preserve them, but also process markdown inside tags
  const htmlTags = [];
  let text = s;
  
  // Match HTML tags with content: <tag attr="value">content</tag>
  // Process markdown inside the content, then wrap back in the tag
  text = text.replace(/<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g, (match, tagName, attrs, content) => {
    // Process markdown inside the HTML tag content
    let processedContent = content;
    // inline code
    processedContent = processedContent.replace(/`([^`]+)`/g, (_,c)=>`<code>${escapeHtml(c)}</code>`);
    // bold / italic
    processedContent = processedContent.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    processedContent = processedContent.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    // links
    processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_,a,href)=>`<a href="${href}" target="_blank" rel="noopener">${a}</a>`);
    
    const idx = htmlTags.length;
    htmlTags.push(`<${tagName}${attrs}>${processedContent}</${tagName}>`);
    return `@@HTML_${idx}@@`;
  });
  
  // Match self-closing tags: <tag />
  text = text.replace(/<([^>]+)\/>/g, (match) => {
    const idx = htmlTags.length;
    htmlTags.push(match);
    return `@@HTML_${idx}@@`;
  });
  
  // Process markdown on the remaining text (outside HTML tags)
  let t = text;
  
  // inline code
  t = t.replace(/`([^`]+)`/g, (_,c)=>`<code>${escapeHtml(c)}</code>`);
  
  // bold / italic
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  
  // links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_,a,href)=>`<a href="${href}" target="_blank" rel="noopener">${a}</a>`);
  
  // Restore HTML tags
  t = t.replace(/@@HTML_(\d+)@@/g, (_,i)=>htmlTags[Number(i)]);
  
  return t;
}
