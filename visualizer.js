// Mesh Visualizer — a Canvas animation of the two nodes and every radio packet
// crossing the simulated LoRa link. Subscribes directly to the in-browser
// World (no WebSocket). Cross-tab traffic is mirrored automatically by the
// World's BroadcastChannel bridge.

import { world, KINDS, NODE_DEFS } from '/sim/world.js';

const canvas = document.getElementById('viz');
const ctx = canvas.getContext('2d');

let counts = { a: { sent: 0, received: 0 }, b: { sent: 0, received: 0 } };
const watchdogPulse = { a: 0, b: 0 };

const packets = [];
const rings = [];
const stars = [];

// Node layout (positions recomputed on resize)
const N = {
  a: { ...NODE_DEFS.a, x: 0, y: 0, batPhase: 0 },
  b: { ...NODE_DEFS.b, x: 0, y: 0, batPhase: 2 },
};

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  N.a.x = innerWidth * 0.24; N.a.y = innerHeight * 0.5;
  N.b.x = innerWidth * 0.76; N.b.y = innerHeight * 0.5;
}
addEventListener('resize', resize);
resize();

// Starfield for the "dark"
for (let i = 0; i < 120; i++) {
  stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.2, tw: Math.random() * Math.PI * 2 });
}

function refreshCounts() {
  const a = world.snapshot('a'), b = world.snapshot('b');
  counts = { a: a.counts, b: b.counts };
}
refreshCounts();

function spawnPacket(tx) {
  const from = N[tx.from], to = N[tx.to];
  const k = KINDS[tx.kind] || { color: '#94a3b8', icon: '' };
  packets.push({
    from, to, t: 0, duration: Math.max(550, tx.latency),
    color: k.color, icon: k.icon,
    label: (k.label || tx.kind), quality: tx.quality, arrived: false,
  });
  for (let i = 0; i < 3; i++) {
    rings.push({ x: from.x, y: from.y, r: 24 + i * 10, max: 140, alpha: 0.5, color: k.color });
  }
}

// --- Wire up to the World --------------------------------------------------
world.on('tx', (tx) => {
  if (tx.phase === 'start') spawnPacket(tx);
});
world.on('update', (info) => {
  refreshCounts();
  if (info.reason === 'sent') addFeed({ from: info.packet.from, kind: info.packet.kind, text: info.packet.text });
  if (info.reason === 'watchdog-done') watchdogPulse[info.node] = 1;
});

// --- Animation loop --------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(64, now - last); last = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  drawBackground(now);
  drawLink(now);
  updateRings(dt);
  updatePackets(dt);
  drawNode(N.a, now);
  drawNode(N.b, now);

  watchdogPulse.a = Math.max(0, watchdogPulse.a - dt / 1200);
  watchdogPulse.b = Math.max(0, watchdogPulse.b - dt / 1200);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function drawBackground(now) {
  for (const s of stars) {
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now / 800 + s.tw));
    ctx.beginPath();
    ctx.arc(s.x * innerWidth, s.y * innerHeight, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(150,180,220,${0.15 * tw})`;
    ctx.fill();
  }
}

function drawLink(now) {
  const { a, b } = N;
  ctx.save();
  ctx.setLineDash([6, 12]);
  ctx.lineDashOffset = -(now / 40) % 18;
  ctx.strokeStyle = 'rgba(120,160,220,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();

  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(138,160,189,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('LoRa · Reticulum mesh link', mx, my - 16);
}

function updateRings(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r += dt * 0.06;
    r.alpha -= dt * 0.0011;
    if (r.alpha <= 0 || r.r > r.max) { rings.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = hexA(r.color, r.alpha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function updatePackets(dt) {
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    p.t += dt / p.duration;
    if (p.t >= 1) {
      if (!p.arrived) {
        p.arrived = true;
        for (let j = 0; j < 3; j++) rings.push({ x: p.to.x, y: p.to.y, r: 18 + j * 8, max: 90, alpha: 0.6, color: p.color });
      }
      packets.splice(i, 1);
      continue;
    }
    const e = easeInOut(p.t);
    const x = p.from.x + (p.to.x - p.from.x) * e;
    const y = p.from.y + (p.to.y - p.from.y) * e - Math.sin(p.t * Math.PI) * 38;

    for (let k = 1; k <= 6; k++) {
      const tt = Math.max(0, p.t - k * 0.025);
      const ee = easeInOut(tt);
      const tx = p.from.x + (p.to.x - p.from.x) * ee;
      const ty = p.from.y + (p.to.y - p.from.y) * ee - Math.sin(tt * Math.PI) * 38;
      ctx.beginPath();
      ctx.arc(tx, ty, 6 - k * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = hexA(p.color, 0.12 * (1 - k / 7));
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 18);
    grad.addColorStop(0, hexA(p.color, 0.9));
    grad.addColorStop(1, hexA(p.color, 0));
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();

    if (p.t > 0.15 && p.t < 0.85) {
      ctx.font = '11px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      const label = `${p.icon} ${p.label}`;
      const w = ctx.measureText(label).width + 14;
      roundRect(x - w / 2, y - 34, w, 18, 6);
      ctx.fillStyle = 'rgba(10,16,26,0.85)'; ctx.fill();
      ctx.fillStyle = hexA(p.color, 1); ctx.fillText(label, x, y - 21);
    }
  }
}

function drawNode(n, now) {
  const pulse = 0.5 + 0.5 * Math.sin(now / 700 + (n.id === 'b' ? 1.5 : 0));
  const wd = watchdogPulse[n.id];

  const R = 46;
  const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, R * 2.4);
  glow.addColorStop(0, hexA(n.color, 0.32 + wd * 0.4));
  glow.addColorStop(1, hexA(n.color, 0));
  ctx.beginPath(); ctx.arc(n.x, n.y, R * 2.4, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();

  ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, Math.PI * 2);
  ctx.strokeStyle = hexA(n.color, 0.5 + 0.3 * pulse); ctx.lineWidth = 2; ctx.stroke();

  ctx.beginPath(); ctx.arc(n.x, n.y, R - 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,16,26,0.9)'; ctx.fill();

  ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(n.icon, n.x, n.y + 1);
  ctx.textBaseline = 'alphabetic';

  ctx.font = '700 16px ui-sans-serif, system-ui'; ctx.fillStyle = '#e6edf6';
  ctx.fillText(n.name, n.x, n.y + R + 22);
  ctx.font = '12px ui-sans-serif, system-ui'; ctx.fillStyle = '#8aa0bd';
  ctx.fillText(n.role.replace(' · solar node', ''), n.x, n.y + R + 40);

  const c = counts[n.id] || { sent: 0, received: 0 };
  ctx.font = '12px ui-monospace, monospace'; ctx.fillStyle = '#8aa0bd';
  ctx.fillText(`▲ ${c.sent} sent   ▼ ${c.received} recv`, n.x, n.y + R + 58);
  if (wd > 0.02) {
    ctx.fillStyle = hexA('#22d3ee', wd);
    ctx.fillText('👁️ watchdog updated', n.x, n.y + R + 76);
  }

  drawSolar(n, now);
}

function drawSolar(n, now) {
  const sx = n.x, sy = n.y - 70;
  const sun = 0.6 + 0.4 * Math.sin(now / 900 + n.batPhase);
  ctx.beginPath(); ctx.arc(sx - 34, sy, 6, 0, Math.PI * 2);
  ctx.fillStyle = hexA('#fbbf24', 0.6 + 0.4 * sun); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + now / 2000;
    ctx.beginPath();
    ctx.moveTo(sx - 34 + Math.cos(a) * 9, sy + Math.sin(a) * 9);
    ctx.lineTo(sx - 34 + Math.cos(a) * (12 + sun * 2), sy + Math.sin(a) * (12 + sun * 2));
    ctx.strokeStyle = hexA('#fbbf24', 0.5 * sun); ctx.lineWidth = 1.4; ctx.stroke();
  }
  const charge = 0.7 + 0.25 * (0.5 + 0.5 * Math.sin(now / 3000 + n.batPhase));
  const bw = 46, bh = 9, bx = sx - 12, by = sy - bh / 2;
  roundRect(bx, by, bw, bh, 3); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  roundRect(bx + 1, by + 1, (bw - 2) * charge, bh - 2, 2);
  ctx.fillStyle = charge > 0.4 ? '#22c55e' : '#eab308'; ctx.fill();
  ctx.fillStyle = '#8aa0bd'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'left';
  ctx.fillText(Math.round(charge * 100) + '%', bx + bw + 6, by + bh);
  ctx.textAlign = 'center';
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

// --- Legend + feed ---------------------------------------------------------
function buildLegend() {
  const el = document.getElementById('legend');
  let html = '<div class="row" style="color:#e6edf6;font-weight:700;margin-bottom:2px">Message types</div>';
  for (const [, v] of Object.entries(KINDS)) {
    html += `<div class="row"><span class="sw" style="background:${v.color}"></span>${v.icon} ${v.label}</div>`;
  }
  html += `<div class="row" style="margin-top:8px;border-top:1px solid var(--line);padding-top:8px">🧠 Watchdog: heuristic (offline, in-browser)</div>`;
  el.innerHTML = html;
}
buildLegend();

function addFeed(msg) {
  const feed = document.getElementById('feed');
  const k = KINDS[msg.kind] || {};
  const who = msg.from === 'a' ? N.a.name : N.b.name;
  const line = document.createElement('div');
  line.className = 'line';
  line.innerHTML = `<span class="who" style="color:${k.color}">${k.icon || ''} ${who}</span>` +
    `<span class="txt">${escapeHtml(msg.text)}</span>`;
  feed.prepend(line);
  while (feed.children.length > 6) feed.removeChild(feed.lastChild);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// --- Play scenario button --------------------------------------------------
const playBtn = document.getElementById('play');
playBtn.onclick = () => {
  playBtn.textContent = '▶ Running…';
  playBtn.disabled = true;
  world.playScenario().then(() => setTimeout(() => {
    playBtn.textContent = '▶ Play scenario'; playBtn.disabled = false;
  }, 800));
};
world.on('scenario', ({ phase, remote }) => {
  if (phase === 'start' && remote) { playBtn.textContent = '▶ Running (other tab)…'; playBtn.disabled = true; }
  if (phase === 'end' && remote)   { playBtn.textContent = '▶ Play scenario'; playBtn.disabled = false; }
});
