// Shared definition of the message "kinds" that can travel across the mesh.
// Kept deliberately small — LoRa frames are tiny, so the real product would use
// short structured messages exactly like these.

export const KINDS = {
  CAPACITY:        { label: 'Capacity update',  color: '#38bdf8', icon: '🛏️' },
  RESOURCE_REQUEST:{ label: 'Resource request', color: '#f97316', icon: '🆘' },
  RESOURCE_OFFER:  { label: 'Resource offer',   color: '#22c55e', icon: '🤝' },
  MISSING_PERSON:  { label: 'Missing person',   color: '#e879f9', icon: '🧒' },
  INCIDENT:        { label: 'Incident report',  color: '#ef4444', icon: '⚠️' },
  STATUS:          { label: 'Status / infra',   color: '#eab308', icon: '🔋' },
  FREE:            { label: 'Free text',        color: '#94a3b8', icon: '💬' },
};

export const KIND_KEYS = Object.keys(KINDS);

// Quick-send templates surfaced as buttons in the messaging UI.
export const TEMPLATES = {
  A: [
    { kind: 'CAPACITY',        text: 'Motol ER at 78% capacity, 6 trauma + 2 ICU beds free, blood O- low.' },
    { kind: 'RESOURCE_OFFER',  text: 'We can accept up to 6 trauma patients and run a field triage team.' },
    { kind: 'STATUS',          text: 'Backup generator fuel at 34%, ~6h runtime left, need diesel resupply.' },
    { kind: 'RESOURCE_REQUEST',text: 'Request 4 units O- blood and 10 oxygen cylinders, urgent.' },
  ],
  B: [
    { kind: 'CAPACITY',        text: 'Central EOC overwhelmed, switchboard down, coordinating via mesh only.' },
    { kind: 'MISSING_PERSON',  text: 'Missing child: Anna, 8, red jacket, last seen Andel metro 16:10.' },
    { kind: 'INCIDENT',        text: 'Building collapse Smichov, ~12 casualties, need trauma capacity now.' },
    { kind: 'RESOURCE_REQUEST',text: 'Need 2 ambulances rerouted to Smichov and a list of free ICU beds.' },
  ],
};

// A scripted blackout scenario. from = which node sends it; the OTHER receives.
export const SEED = [
  { from: 'B', kind: 'INCIDENT',         text: 'Grid down across Prague 5. Mobile networks offline. EOC running on mesh.' },
  { from: 'A', kind: 'CAPACITY',         text: 'Motol ER at 72% capacity, 8 trauma beds, 3 ICU beds free.' },
  { from: 'B', kind: 'INCIDENT',         text: 'Building collapse Smichov, estimated 12 casualties, 4 critical.' },
  { from: 'B', kind: 'RESOURCE_REQUEST', text: 'Need 6 trauma beds and 2 ICU beds for Smichov casualties asap.' },
  { from: 'A', kind: 'RESOURCE_OFFER',   text: 'Confirmed: we accept 6 trauma + 2 ICU. Send them to Motol gate C.' },
  { from: 'B', kind: 'MISSING_PERSON',   text: 'Missing child Anna, age 8, red jacket, last seen Andel metro 16:10.' },
  { from: 'A', kind: 'STATUS',           text: 'Backup generator fuel 34%, ~6h left. Request diesel resupply.' },
  { from: 'B', kind: 'RESOURCE_REQUEST', text: 'Anyone with O- blood? Two patients bleeding out at Smichov.' },
  { from: 'A', kind: 'RESOURCE_OFFER',   text: 'We hold 4 units O-. Can spare 2. Dispatch courier on foot/bike.' },
];

export const NODE_DEFS = {
  a: { id: 'a', name: 'Motol Hospital', role: 'Trauma centre · solar node',     icon: '🏥', color: '#38bdf8', peer: 'b' },
  b: { id: 'b', name: 'Central EOC',    role: 'Emergency operations · solar node', icon: '🛰️', color: '#a855f7', peer: 'a' },
};
NODE_DEFS.a.peerName = NODE_DEFS.b.name;
NODE_DEFS.b.peerName = NODE_DEFS.a.name;
