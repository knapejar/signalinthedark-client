// Node console UI — talks directly to the in-browser World (no WebSocket).

import { world, KINDS, TEMPLATES, NODE_DEFS } from '/sim/world.js';
import { renderMarkdown } from '/md.js';
import { autoPlayScenarioOnLoad } from '/sim/autoplay.js';

// Which node is this page showing? The route is /a or /b, but on a static
// host the URL might still carry a trailing slash or .html — be tolerant.
const ID = (location.pathname.replace(/[^a-z]/gi, '').toLowerCase().endsWith('b') ? 'b' : 'a');

const $ = (s) => document.querySelector(s);

// --- One-time UI setup ------------------------------------------------------
function setupStatic() {
  // Kind selector
  const sel = $('#kind');
  sel.innerHTML = '';
  for (const [k, v] of Object.entries(KINDS)) {
    const o = document.createElement('option');
    o.value = k; o.textContent = `${v.icon} ${v.label}`;
    sel.appendChild(o);
  }

  // Templates for this node
  const tpl = $('#templates');
  tpl.innerHTML = '';
  (TEMPLATES[ID.toUpperCase()] || []).forEach((t) => {
    const c = document.createElement('div');
    c.className = 'chip';
    c.textContent = `${KINDS[t.kind]?.icon || ''} ${t.text.slice(0, 42)}${t.text.length > 42 ? '…' : ''}`;
    c.title = t.text;
    c.onclick = () => { sel.value = t.kind; $('#text').value = t.text; $('#text').focus(); };
    tpl.appendChild(c);
  });

  // Tabs
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.view[data-view="${tab.dataset.view}"]`).classList.add('active');
    };
  });

  // Send
  const doSend = () => {
    const text = $('#text').value.trim();
    if (!text) return;
    world.send(ID, $('#kind').value, text);
    $('#text').value = '';
  };
  $('#send').onclick = doSend;
  $('#text').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  $('#refresh').onclick = () => world.runWatchdog(ID);
  $('#scenario').onclick = (e) => {
    e.target.textContent = '▶ Running…';
    e.target.disabled = true;
    world.playScenario().then(() => setTimeout(() => {
      e.target.textContent = '▶ Scenario';
      e.target.disabled = false;
    }, 600));
  };

  // Battery wander (cosmetic — solar charge breathing).
  let bat = 82;
  setInterval(() => {
    bat += (Math.random() - 0.45) * 2;
    bat = Math.max(60, Math.min(98, bat));
    $('#battery').style.width = bat.toFixed(0) + '%';
  }, 2500);
}

// --- Render state -----------------------------------------------------------
function apply() {
  const node = world.snapshot(ID);
  $('#nodeName').textContent = node.name;
  $('#nodeRole').textContent = node.role;
  $('#linkPeer').textContent = `↔ ${node.peer.name}`;
  const badge = $('#badge');
  badge.textContent = NODE_DEFS[ID].icon;
  badge.classList.add(ID);
  document.title = `${node.name} — Signal in the Dark`;

  renderLog(node);
  renderWatch(node);

  $('#cMsg').textContent = node.inbox.length + node.outbox.length;
  $('#cWatch').textContent = node.watch.updatedAt ? '●' : '';
}

function renderLog(node) {
  const log = $('#log');
  const items = [
    ...node.outbox.map((m) => ({ ...m, dir: 'out' })),
    ...node.inbox.map((m) => ({ ...m, dir: 'in' })),
  ].sort((a, b) => (a.dir === 'out' ? a.ts : a.receivedAt) - (b.dir === 'out' ? b.ts : b.receivedAt));

  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  log.innerHTML = '';
  if (!items.length) {
    log.innerHTML = '<div class="empty">No traffic yet. Send a message, or press ▶ Scenario above.</div>';
    return;
  }
  items.forEach((m) => {
    const k = KINDS[m.kind] || {};
    const el = document.createElement('div');
    el.className = `msg ${m.dir}`;
    el.style.setProperty('--kindcolor', k.color || '#94a3b8');
    const time = new Date(m.dir === 'out' ? m.ts : m.receivedAt).toLocaleTimeString();
    el.innerHTML = `
      <div class="meta">
        <span class="kindtag" style="color:${k.color}">${k.icon || ''} ${k.label || m.kind}</span>
        <span>${m.dir === 'out' ? 'you → ' + escapeHtml(node.peer.name) : escapeHtml(m.fromName) + ' → you'}</span>
        <span>${time}</span>
      </div>
      <div class="body">${escapeHtml(m.text)}</div>`;
    log.appendChild(el);
  });
  if (atBottom) log.scrollTop = log.scrollHeight;
}

function renderWatch(node) {
  const w = node.watch;
  const spin = $('#watchSpin');
  spin.innerHTML = w.busy ? '<span class="spinner"></span>' : '';

  const b = $('#watchBackend');
  b.textContent = w.backend === '-' ? 'idle' : w.backend;
  b.className = 'badge-backend' + (w.backend === 'heuristic' ? ' heuristic' : '');
  b.title = w.model ? `model: ${w.model}` : '';

  $('#watchSources').textContent = `${w.sources || 0} source msgs`;
  $('#watchUpdated').textContent = w.updatedAt
    ? 'updated ' + new Date(w.updatedAt).toLocaleTimeString()
    : 'never updated';

  const body = $('#watchBody');
  if (!node.inbox.length) {
    body.innerHTML = '<div class="empty">No messages received yet. The watchdog summarises incoming traffic here.</div>';
    return;
  }
  body.innerHTML = renderMarkdown(w.markdown);
}

// --- TX pulse (the "📡 transmitting…" indicator) ----------------------------
let txTimer = null;
function flashTx() {
  $('#tx').classList.add('on');
  clearTimeout(txTimer);
  txTimer = setTimeout(() => $('#tx').classList.remove('on'), 1100);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// --- Wire up to the World --------------------------------------------------
setupStatic();
apply();

world.on('update', (info) => {
  if (info.node === ID) apply();
});
world.on('tx', (tx) => {
  if (tx.from === ID && tx.phase === 'start') flashTx();
});

// Play the blackout scenario automatically the moment this console loads.
autoPlayScenarioOnLoad();
