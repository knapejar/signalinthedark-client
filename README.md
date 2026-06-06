# Signal in the Dark — client-only simulation

> A prototype of the on-device app that runs on every node of the
> **Signal in the Dark** emergency mesh network — re-implemented as a
> **100% client-side** static site. No server. No WebSockets. No backend.
> Everything runs in your browser and every animation plays immediately.

This is a fork of [`pechmic3/signalinthedark-project-simulation`](https://github.com/pechmic3/signalinthedark-project-simulation)
with the entire Node.js server, WebSocket fan-out and HTTP API removed. The
two simulated nodes, the radio link between them, and the watchdog aggregator
all live in browser JavaScript modules.

---

## What you see

| Route | Screen |
|-------|--------|
| `/`    | Hub / control room (links + "Play blackout scenario") |
| `/a`   | Node A — Motol Hospital console (messaging + watchdog) |
| `/b`   | Node B — Central EOC console (messaging + watchdog) |
| `/viz` | Mesh Visualizer — the airwaves |

Open the visualizer and the two node consoles in separate tabs and press
**▶ Play blackout scenario** anywhere — every tab mirrors the same mesh
in real time (cross-tab sync via `BroadcastChannel`).

---

## What changed vs. the original

| Original (Node.js server) | This version (static client) |
|---------------------------|------------------------------|
| Express-like HTTP server in `src/server.js` | Removed — static files only |
| `WebSocketServer` pushing state updates | Removed — everything is local |
| `MeshLink` simulating LoRa latency 700–1500 ms | Re-implemented in browser, latency 350–650 ms |
| 900 ms gap between scenario steps | 300 ms — plays *immediately* |
| Pluggable LLM backend chain (Groq / Gemini / Ollama / heuristic) | Heuristic only (offline, no network) |
| One process, one mesh | One mesh **per BroadcastChannel** = all open tabs share it |

The on-screen experience is the same: dark "blackout" map, two solar nodes,
animated radio rings, every packet flying across the link, both watchdogs
filling in the situational picture.

---

## Run locally

It's a pure static site, so any static server works. From the project root:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open <http://localhost:3000/> (or whichever port your server picks).

---

## Deploy

Already deployed on Vercel — push to `main` and Vercel rebuilds automatically.
The included `vercel.json` rewrites `/a`, `/b` and `/viz` to the appropriate
HTML files so the routes look exactly like the original.

---

## Credits

**Signal in the Dark** — GreenHack 2026.
Barbora Fučíková · Vojtěch Jedlička · Michal Pech · Jaroslav Knápek

Client-only rewrite by Jaroslav Knápek.
