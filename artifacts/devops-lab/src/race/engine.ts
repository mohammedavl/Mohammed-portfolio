// Pure racing engine. No React, no DOM, no three.js — safe to import from Node.

export const LANES = [-2.6, 0, 2.6] as const;
export const GOAL_DISTANCE = 3200; // metres
export const START_LIVES = 3;
export const BASE_SPEED = 26; // m/s
export const MAX_SPEED = 46; // bounded so it stays playable
export const SPAWN_Z = -140;
export const DESPAWN_Z = 12;
export const INVULN_SECONDS = 1.6;
export const WAVE_GAP = 34; // metres between waves
export const PLAYER_HALF = { x: 0.85, z: 1.7 };

export type EntityKind = 'car' | 'cone' | 'barrier' | 'pickup';
export type Entity = { id: number; kind: EntityKind; lane: number; z: number; hit: boolean; slug?: string; label?: string; speedFactor: number };
export type Status = 'ready' | 'countdown' | 'running' | 'paused' | 'won' | 'lost';
export type PickupDef = { slug: string; label: string };
export type RaceEvent = { type: 'hit' | 'pickup' | 'finish' | 'gameover'; slug?: string; label?: string };

export type RaceState = {
  status: Status; distance: number; elapsed: number; speed: number; lives: number; score: number;
  lane: number; x: number; invulnUntil: number; entities: Entity[]; collected: string[];
  nextId: number; nextWaveAt: number; waveCount: number; pickupCursor: number; seed: number; version: number;
  pickups: PickupDef[];
};

const HALF: Record<EntityKind, { x: number; z: number }> = {
  car: { x: 0.85, z: 1.7 }, cone: { x: 0.45, z: 0.45 }, barrier: { x: 1.05, z: 0.4 }, pickup: { x: 0.8, z: 0.8 },
};

export function rng(state: RaceState) {
  // mulberry32
  let t = (state.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createRace(pickups: PickupDef[], seed = 1337): RaceState {
  return {
    status: 'ready', distance: 0, elapsed: 0, speed: BASE_SPEED, lives: START_LIVES, score: 0,
    lane: 1, x: LANES[1], invulnUntil: 0, entities: [], collected: [], nextId: 1, nextWaveAt: 60,
    waveCount: 0, pickupCursor: 0, seed: seed >>> 0, version: 0, pickups,
  };
}

export function speedFor(distance: number) {
  const t = Math.min(1, distance / GOAL_DISTANCE);
  return BASE_SPEED + (MAX_SPEED - BASE_SPEED) * t;
}

export function steer(state: RaceState, dir: -1 | 1) {
  if (state.status !== 'running') return;
  state.lane = Math.max(0, Math.min(2, state.lane + dir));
}

/** Chooses blocked lanes for a wave; never blocks all three and keeps a lane reachable from the previous wave's open lane. */
export function planWave(state: RaceState, prevOpen: number[]): { blocked: number[]; open: number[] } {
  const count = state.waveCount < 3 ? 1 : rng(state) < 0.45 ? 2 : 1;
  const lanes = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = Math.floor(rng(state) * (i + 1)); [lanes[i], lanes[j]] = [lanes[j], lanes[i]]; }
  let blocked = lanes.slice(0, count);
  let open = [0, 1, 2].filter((l) => !blocked.includes(l));
  // reachable: some open lane within 1 step of a previous open lane
  const ok = open.some((o) => prevOpen.some((p) => Math.abs(p - o) <= 1));
  if (!ok) { blocked = blocked.slice(0, 1); open = [0, 1, 2].filter((l) => !blocked.includes(l)); }
  return { blocked, open };
}

function lastOpen(state: RaceState): number[] {
  const recent = state.entities.filter((e) => e.kind !== 'pickup' && e.z < SPAWN_Z + WAVE_GAP);
  return [0, 1, 2].filter((l) => !recent.some((e) => e.lane === l));
}

function spawnWave(state: RaceState) {
  const { blocked, open } = planWave(state, lastOpen(state));
  for (const lane of blocked) {
    const r = rng(state);
    const kind: EntityKind = r < 0.55 ? 'car' : r < 0.8 ? 'cone' : 'barrier';
    state.entities.push({ id: state.nextId++, kind, lane, z: SPAWN_Z, hit: false, speedFactor: kind === 'car' ? 0.82 : 1 });
  }
  // pickup every other wave in an open lane, cycling uncollected labs
  if (state.waveCount % 2 === 1 && state.pickups.length) {
    const remaining = state.pickups.filter((p) => !state.collected.includes(p.slug));
    const pool = remaining.length ? remaining : state.pickups;
    const def = pool[state.pickupCursor++ % pool.length];
    const lane = open[Math.floor(rng(state) * open.length)];
    state.entities.push({ id: state.nextId++, kind: 'pickup', lane, z: SPAWN_Z - WAVE_GAP / 2, hit: false, slug: def.slug, label: def.label, speedFactor: 1 });
  }
  state.waveCount++;
  state.version++;
}

export function overlaps(state: RaceState, e: Entity) {
  const h = HALF[e.kind];
  return Math.abs(LANES[e.lane] - state.x) < h.x + PLAYER_HALF.x - 0.15 && Math.abs(e.z) < h.z + PLAYER_HALF.z;
}

/** Advance simulation. dt is capped internally so resuming after a pause never teleports. */
export function step(state: RaceState, rawDt: number): RaceEvent[] {
  const events: RaceEvent[] = [];
  if (state.status !== 'running') return events;
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  state.elapsed += dt;
  state.speed = speedFor(state.distance);
  const move = state.speed * dt;
  state.distance += move;
  state.score += move * (1 + state.collected.length * 0.1);
  // smooth steering toward target lane
  const target = LANES[state.lane];
  state.x += (target - state.x) * Math.min(1, dt * 12);
  if (Math.abs(target - state.x) < 0.01) state.x = target;

  if (state.distance >= state.nextWaveAt && state.distance < GOAL_DISTANCE - 80) {
    spawnWave(state);
    state.nextWaveAt += WAVE_GAP;
  }

  const before = state.entities.length;
  for (const e of state.entities) {
    e.z += move * e.speedFactor;
    if (e.hit || !overlaps(state, e)) continue;
    if (e.kind === 'pickup') {
      e.hit = true;
      if (e.slug && !state.collected.includes(e.slug)) state.collected.push(e.slug);
      state.score += 250;
      events.push({ type: 'pickup', slug: e.slug, label: e.label });
    } else if (state.elapsed >= state.invulnUntil) {
      e.hit = true; // unique: counts once
      state.lives -= 1;
      state.invulnUntil = state.elapsed + INVULN_SECONDS;
      events.push({ type: 'hit' });
      if (state.lives <= 0) { state.status = 'lost'; events.push({ type: 'gameover' }); return events; }
    } else {
      e.hit = true; // passed through while invulnerable; never counts later
    }
  }
  state.entities = state.entities.filter((e) => e.z < DESPAWN_Z && !(e.kind === 'pickup' && e.hit));
  if (state.entities.length !== before) state.version++;

  if (state.distance >= GOAL_DISTANCE) {
    state.distance = GOAL_DISTANCE;
    state.score += state.lives * 500;
    state.status = 'won';
    events.push({ type: 'finish' });
  }
  return events;
}

export function isInvulnerable(state: RaceState) { return state.elapsed < state.invulnUntil; }

export function parseHighScore(raw: string | null): number {
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 && n < 1e7 ? Math.floor(n) : 0;
}
