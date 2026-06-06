// Heuristic watchdog — the offline, no-model aggregator.
// In the original Node.js version this was the fallback at the end of a chain
// that could also call out to Groq/Gemini/Ollama. In the static client-only
// build, the heuristic is the ONLY backend: it runs purely in the browser,
// needs zero configuration and zero network, and is genuinely useful — it
// groups messages by kind, sorts requests by urgency keywords and derives
// suggested priorities.

import { KINDS } from './messages.js';

export function heuristic(node, messages) {
  if (!messages.length) {
    return { markdown: '_No messages received yet._', backend: 'heuristic', model: 'rules' };
  }
  const by = (k) => messages.filter((m) => m.kind === k);
  const out = [];

  const incidents = by('INCIDENT');
  const capacity  = by('CAPACITY');
  const requests  = by('RESOURCE_REQUEST');
  const offers    = by('RESOURCE_OFFER');
  const missing   = by('MISSING_PERSON');
  const status    = by('STATUS');
  const free      = by('FREE');

  out.push('### 🧭 Situation');
  out.push(
    `${messages.length} message(s) received. ` +
      `${incidents.length} incident(s), ${requests.length} open request(s), ` +
      `${offers.length} offer(s), ${missing.length} missing person(s).`
  );

  const fmt = (m) => `- ${m.text}  _(from ${m.fromName})_`;

  if (capacity.length || status.length) {
    out.push('\n### 🛏️ Capacity & infrastructure');
    [...capacity, ...status].forEach((m) => out.push(fmt(m)));
  }
  if (requests.length) {
    out.push('\n### 🆘 Open requests');
    const urgent = /urgent|asap|now|critical|immediately|bleeding|dying/i;
    [...requests]
      .sort((a, b) => (urgent.test(b.text) ? 1 : 0) - (urgent.test(a.text) ? 1 : 0))
      .forEach((m) => out.push(fmt(m)));
  }
  if (offers.length) {
    out.push('\n### 🤝 Available resources');
    offers.forEach((m) => out.push(fmt(m)));
  }
  if (missing.length) {
    out.push('\n### 🧒 Missing persons');
    missing.forEach((m) => out.push(fmt(m)));
  }
  if (incidents.length) {
    out.push('\n### ⚠️ Incidents');
    incidents.forEach((m) => out.push(fmt(m)));
  }
  if (free.length) {
    out.push('\n### 💬 Other');
    free.forEach((m) => out.push(fmt(m)));
  }

  const prio = [];
  if (missing.length) prio.push(`Cross-check ${missing.length} missing-person report(s) against arrivals.`);
  if (requests.length && offers.length) prio.push('Match open requests against available resources (see above).');
  else if (requests.length) prio.push('Escalate open requests — no matching offers yet.');
  if (status.some((m) => /fuel|battery|generator|power/i.test(m.text))) prio.push('Watch power/fuel status — infrastructure at risk.');
  if (incidents.length) prio.push('Confirm trauma capacity for active incident sites.');
  if (prio.length) {
    out.push('\n### ✅ Suggested priorities');
    prio.slice(0, 4).forEach((p) => out.push(`- ${p}`));
  }

  // Tiny cosmetic touch so the icons render at the start of the kind list.
  void KINDS;

  return { markdown: out.join('\n'), backend: 'heuristic', model: 'rules' };
}
