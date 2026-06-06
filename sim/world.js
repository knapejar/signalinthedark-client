// ---------------------------------------------------------------------------
// World — the in-browser mesh simulation.
//
// In the original Node.js version, the two Nodes lived on the server and the
// browser was a thin client that received state updates over a WebSocket.
//
// This file is the whole simulation, running directly in the browser:
//   - Two isolated Nodes (Motol Hospital and Central EOC).
//   - A simulated radio "link" between them with a short, *visible* latency
//     (so the visualizer still sees packets flying across the airwaves) — but
//     **no server, no WebSocket, no network round-trip.** Every animation
//     fires immediately on the local client.
//   - A heuristic watchdog that aggregates received messages into a markdown
//     situational picture.
//   - Cross-tab sync via BroadcastChannel: if you open the visualizer and the
//     two node consoles in separate tabs, every action is mirrored everywhere.
// ---------------------------------------------------------------------------

import { NODE_DEFS, SEED, KINDS, TEMPLATES } from './messages.js';
import { heuristic } from './watchdog.js';

// --- A tiny EventEmitter shim (browsers don't ship Node's EventEmitter) -----
class Bus {
  constructor() { this._h = new Map(); }
  on(ev, fn)  { (this._h.get(ev) || this._h.set(ev, new Set()).get(ev)).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._h.get(ev)?.delete(fn); }
  emit(ev, payload) { this._h.get(ev)?.forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); }
}

// --- IDs ---------------------------------------------------------------------
let nidCounter = 0;
const nextId = () => `m${Date.now().toString(36)}-${(nidCounter++).toString(36)}`;

// A short tab-local origin tag so each tab can ignore its own broadcasts.
const ORIGIN = `tab-${Math.random().toString(36).slice(2, 8)}`;

// --- Link --------------------------------------------------------------------
// The radio channel between A and B. Latency is intentionally short so the
// visualizer's packet animation is *snappy* — the user asked for everything
// to play immediately, not for a slow LoRa simulation.

const LINK_LATENCY_MS = [350, 650]; // short, but enough to see the arc
function pickLatency() {
  const [lo, hi] = LINK_LATENCY_MS;
  return Math.round(lo + Math.random() * (hi - lo));
}
function pickQuality() { return 0.78 + Math.random() * 0.22; }

// --- World state ------------------------------------------------------------
export class World extends Bus {
  constructor() {
    super();
    this.nodes = {
      a: this._mkNode('a'),
      b: this._mkNode('b'),
    };
    this.txSeq = 0;
    this.scenarioRunning = false;
    this._watchdogTimers = { a: null, b: null };

    // Cross-tab bridge. Modern browsers always support BroadcastChannel; we
    // degrade gracefully (single-tab only) if not.
    try { this.bc = new BroadcastChannel('sitd-mesh'); }
    catch { this.bc = null; }

    if (this.bc) this.bc.onmessage = (e) => this._handleRemote(e.data);
  }

  _mkNode(id) {
    const def = NODE_DEFS[id];
    return {
      id,
      name: def.name,
      role: def.role,
      icon: def.icon,
      peer: { id: def.peer, name: def.peerName },
      inbox: [],
      outbox: [],
      watch: {
        markdown: '_No messages received yet._',
        backend: '-',
        model: '-',
        sources: 0,
        updatedAt: null,
        busy: false,
      },
    };
  }

  snapshot(id) {
    const n = this.nodes[id];
    return {
      ...n,
      counts: { sent: n.outbox.length, received: n.inbox.length },
    };
  }

  // ---- Public actions -----------------------------------------------------

  // Called by a node-console UI when the operator hits Send. Origin = local.
  send(fromId, kind, text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    const fromNode = this.nodes[fromId];
    const packet = {
      id: nextId(),
      from: fromId,
      fromName: fromNode.name,
      to: fromNode.peer.id,
      kind,
      text: trimmed,
      ts: Date.now(),
    };
    this._localSend(packet);
    this._broadcast({ type: 'send', packet });
    return packet;
  }

  // Called locally and on remote 'send'. Handles outbox, link tx animation,
  // delivery and watchdog scheduling — all client-side, no server.
  _localSend(packet) {
    const fromNode = this.nodes[packet.from];
    fromNode.outbox.push(packet);
    this.emit('update', { node: packet.from, reason: 'sent', packet });

    const latency = pickLatency();
    const quality = pickQuality();
    const txId = ++this.txSeq;

    // Start tap — the visualizer animates the packet leaving the sender.
    this.emit('tx', {
      txId, from: packet.from, to: packet.to,
      kind: packet.kind, text: packet.text,
      latency, quality, phase: 'start', ts: Date.now(),
    });

    // Delivery happens after a short, intentionally-visible delay so the
    // packet has time to fly across the airwaves on screen.
    setTimeout(() => {
      const toNode = this.nodes[packet.to];
      toNode.inbox.push({ ...packet, receivedAt: Date.now() });
      this.emit('update', { node: packet.to, reason: 'received', packet });
      this.emit('tx', {
        txId, from: packet.from, to: packet.to,
        kind: packet.kind, text: packet.text,
        latency, quality, phase: 'deliver', ts: Date.now(),
      });
      this._scheduleWatchdog(packet.to);
    }, latency);
  }

  // Debounced watchdog re-run — but with a *short* debounce so the operator
  // sees the picture fill in almost immediately during a burst.
  _scheduleWatchdog(nodeId, delay = 220) {
    clearTimeout(this._watchdogTimers[nodeId]);
    this._watchdogTimers[nodeId] = setTimeout(() => this.runWatchdog(nodeId), delay);
  }

  runWatchdog(nodeId) {
    const node = this.nodes[nodeId];
    if (node.watch.busy) return;
    node.watch.busy = true;
    this.emit('update', { node: nodeId, reason: 'watchdog-start' });

    // The heuristic is synchronous; we wrap it in a microtask so the "busy"
    // state flashes briefly (it looks alive) without blocking the render.
    Promise.resolve().then(() => {
      const recent = node.inbox.slice(-25);
      const result = heuristic(node, recent);
      node.watch = {
        markdown: result.markdown,
        backend: result.backend,
        model: result.model,
        sources: recent.length,
        updatedAt: Date.now(),
        busy: false,
      };
      this.emit('update', { node: nodeId, reason: 'watchdog-done' });
    });
  }

  // ---- Scenario player ----------------------------------------------------
  // The original server.js timed scenario steps 900 ms apart. We keep a small
  // gap so the visualizer can show each packet separately, but it's much
  // tighter — everything plays *immediately*.

  async playScenario() {
    if (this.scenarioRunning) return;
    this.scenarioRunning = true;
    this._broadcast({ type: 'scenario-start' });
    this.emit('scenario', { phase: 'start' });
    try {
      for (const step of SEED) {
        this.send(step.from.toLowerCase(), step.kind, step.text);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      this.scenarioRunning = false;
      this._broadcast({ type: 'scenario-end' });
      this.emit('scenario', { phase: 'end' });
    }
  }

  // ---- Cross-tab bridge ---------------------------------------------------

  _broadcast(msg) {
    if (!this.bc) return;
    this.bc.postMessage({ ...msg, origin: ORIGIN });
  }

  _handleRemote(msg) {
    if (!msg || msg.origin === ORIGIN) return;
    switch (msg.type) {
      case 'send':
        // Mirror the send into our own state so all tabs share one mesh.
        this._localSend(msg.packet);
        break;
      case 'scenario-start':
        // Mark the local scenario flag so a near-simultaneous local
        // auto-play knows to skip — only the first tab wins.
        this.scenarioRunning = true;
        this.emit('scenario', { phase: 'start', remote: true });
        break;
      case 'scenario-end':
        this.scenarioRunning = false;
        this.emit('scenario', { phase: 'end', remote: true });
        break;
    }
  }
}

// Singleton — the whole app shares one World per tab.
export const world = new World();
export { KINDS, TEMPLATES, NODE_DEFS };
