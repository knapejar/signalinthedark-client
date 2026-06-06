// Minimal, dependency-free markdown -> HTML for the watchdog output.
// Handles the small subset the watchdog emits: ### headings, bullet lists,
// **bold**, _italic_, and paragraphs. Escapes HTML first to stay safe.

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^_])_([^_]+?)_/g, '$1<em>$2</em>');
}

export function renderMarkdown(md) {
  const lines = String(md || '').split('\n');
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (/^#{2,4}\s+/.test(line)) {
      closeList();
      out.push('<h3>' + inline(line.replace(/^#{2,4}\s+/, '')) + '</h3>');
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>');
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push('<p>' + inline(line) + '</p>');
    }
  }
  closeList();
  return out.join('\n');
}
