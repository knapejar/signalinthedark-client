// Auto-play helper.
//
// As soon as a page finishes loading, kick off the blackout scenario so the
// visitor sees the demo immediately — no manual "press play" first. If the
// user has multiple tabs open and they all wake up at once, only the first
// tab to claim the localStorage lock actually plays; the others see the
// BroadcastChannel "scenario-start" event and let their own auto-play skip.

import { world } from './world.js';

const LOCK_KEY = 'sitd_autoplay_lock';
const LOCK_TTL_MS = 2000;

function tryClaimLock() {
  try {
    const now = Date.now();
    const prev = Number(localStorage.getItem(LOCK_KEY) || 0);
    if (now - prev < LOCK_TTL_MS) return false;
    localStorage.setItem(LOCK_KEY, String(now));
    return true;
  } catch {
    // Private mode / disabled storage — just play.
    return true;
  }
}

export function autoPlayScenarioOnLoad(delayMs = 450) {
  const fire = () => setTimeout(() => {
    // Another tab may have already started the scenario via BroadcastChannel.
    if (world.scenarioRunning) return;
    if (!tryClaimLock()) return;
    world.playScenario();
  }, delayMs);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    fire();
  } else {
    window.addEventListener('DOMContentLoaded', fire, { once: true });
  }
}
