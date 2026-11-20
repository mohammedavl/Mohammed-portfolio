import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { KeyboardControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { LABS } from '@/labs/registry';
import { createRace, step, steer, isInvulnerable, parseHighScore, LANES, GOAL_DISTANCE, START_LIVES, type RaceState, type Entity } from './engine';

enum C { left = 'left', right = 'right', pause = 'pause' }
const KEYMAP = [
  { name: C.left, keys: ['ArrowLeft', 'KeyA'] },
  { name: C.right, keys: ['ArrowRight', 'KeyD'] },
  { name: C.pause, keys: ['KeyP', 'Escape'] },
];
const HS_KEY = 'devops-lab:race-highscore';
const PICKUPS = LABS.map((l) => ({ slug: l.slug, label: l.tech[0] }));
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function readHS() { try { return parseHighScore(localStorage.getItem(HS_KEY)); } catch { return 0; } }
function writeHS(n: number) { try { localStorage.setItem(HS_KEY, String(Math.floor(n))); } catch { /* storage blocked */ } }

type Hud = { distance: number; score: number; lives: number; speed: number; collected: string[]; flash: string };

function Car({ color, accent }: { color: string; accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[1.6, 0.5, 3.4]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.9, 0.2]} castShadow><boxGeometry args={[1.3, 0.45, 1.6]} /><meshStandardMaterial color={accent} /></mesh>
      {[[-0.8, 1.1], [0.8, 1.1], [-0.8, -1.1], [0.8, -1.1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.32, 0.32, 0.25, 14]} /><meshStandardMaterial color="#1b2233" /></mesh>
      ))}
    </group>
  );
}

function Obstacle({ e, state }: { e: Entity; state: RaceState }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    g.position.set(LANES[e.lane], 0, e.z);
    if (e.kind === 'pickup' && !reduced) g.rotation.y += dt * 2.2;
    void state;
  });
  return (
    <group ref={ref} position={[LANES[e.lane], 0, e.z]}>
      {e.kind === 'car' && <group rotation={[0, Math.PI, 0]}><Car color="#2b3a5c" accent="#e8dfcc" /></group>}
      {e.kind === 'cone' && (<><mesh position={[0, 0.5, 0]} castShadow><coneGeometry args={[0.45, 1, 16]} /><meshStandardMaterial color="#e8542a" /></mesh><mesh position={[0, 0.05, 0]}><boxGeometry args={[0.9, 0.1, 0.9]} /><meshStandardMaterial color="#1b2233" /></mesh></>)}
      {e.kind === 'barrier' && (<><mesh position={[0, 0.6, 0]} castShadow><boxGeometry args={[2.1, 0.55, 0.4]} /><meshStandardMaterial color="#f2c230" /></mesh>{[-0.8, 0.8].map((x) => <mesh key={x} position={[x, 0.25, 0]}><boxGeometry args={[0.15, 0.5, 0.15]} /><meshStandardMaterial color="#1b2233" /></mesh>)}</>)}
      {e.kind === 'pickup' && (<><mesh position={[0, 1.1, 0]}><octahedronGeometry args={[0.75]} /><meshStandardMaterial color="#1f8a74" emissive="#1f8a74" emissiveIntensity={0.6} /></mesh><mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.8, 1.05, 24]} /><meshBasicMaterial color="#1f8a74" /></mesh></>)}
    </group>
  );
}

function Road({ state }: { state: RaceState }) {
  const dashes = useRef<THREE.Group>(null);
  const posts = useRef<THREE.Group>(null);
  const dashZ = useMemo(() => Array.from({ length: 24 }, (_, i) => -i * 8), []);
  useFrame(() => {
    const off = state.distance % 8;
    if (dashes.current) dashes.current.position.z = off;
    if (posts.current) posts.current.position.z = state.distance % 16;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -70]} receiveShadow><planeGeometry args={[9, 180]} /><meshStandardMaterial color="#2a3245" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -70]}><planeGeometry args={[80, 180]} /><meshStandardMaterial color="#e9dfc9" /></mesh>
      {[-4.6, 4.6].map((x) => <mesh key={x} position={[x, 0.15, -70]}><boxGeometry args={[0.3, 0.3, 180]} /><meshStandardMaterial color="#e8542a" /></mesh>)}
      <group ref={dashes}>
        {dashZ.map((z) => [-1.3, 1.3].map((x) => <mesh key={`${z}${x}`} position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.18, 3]} /><meshBasicMaterial color="#e9dfc9" /></mesh>))}
      </group>
      <group ref={posts}>
        {Array.from({ length: 12 }, (_, i) => -i * 16).map((z) => [-7, 7].map((x) => <mesh key={`${z}${x}`} position={[x, 1, z]}><boxGeometry args={[0.5, 2, 0.5]} /><meshStandardMaterial color="#2b3a5c" /></mesh>))}
      </group>
      <mesh position={[0, 3, -GOAL_DISTANCE]} visible={false}><boxGeometry /></mesh>
    </group>
  );
}

function Scene({ state, version, onTick }: { state: RaceState; version: number; onTick: (dt: number) => void }) {
  const player = useRef<THREE.Group>(null);
  const [, get] = useKeyboardControls<C>();
  void get;
  useFrame((s, dt) => {
    onTick(dt);
    const p = player.current;
    if (p) {
      p.position.x = state.x;
      p.rotation.y = (LANES[state.lane] - state.x) * -0.12;
      p.visible = !isInvulnerable(state) || reduced || Math.floor(state.elapsed * 12) % 2 === 0;
    }
    s.camera.position.x += (state.x * 0.5 - s.camera.position.x) * Math.min(1, dt * 4);
    s.camera.lookAt(state.x * 0.3, 0.5, -14);
  });
  const ents = useMemo(() => state.entities.slice(), [version, state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <color attach="background" args={['#efe6d4']} />
      <fog attach="fog" args={['#efe6d4', 50, 140]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[6, 12, 6]} intensity={1.3} castShadow />
      <Road state={state} />
      <group ref={player}><Car color="#e8542a" accent="#1b2233" /></group>
      {ents.map((e) => <Obstacle key={e.id} e={e} state={state} />)}
    </>
  );
}

function KeyBridge({ onSteer, onPause }: { onSteer: (d: -1 | 1) => void; onPause: () => void }) {
  const [sub] = useKeyboardControls<C>();
  const s = useRef(onSteer); s.current = onSteer;
  const p = useRef(onPause); p.current = onPause;
  useEffect(() => {
    const a = sub((st) => st.left, (v) => v && s.current(-1));
    const b = sub((st) => st.right, (v) => v && s.current(1));
    const c = sub((st) => st.pause, (v) => v && p.current());
    return () => { a(); b(); c(); };
  }, [sub]);
  return null;
}

export default function RaceGame() {
  const stateRef = useRef<RaceState>(createRace(PICKUPS, Date.now()));
  const [status, setStatus] = useState(stateRef.current.status);
  const [version, setVersion] = useState(0);
  const [count, setCount] = useState(3);
  const [hs, setHs] = useState(readHS);
  const [newBest, setNewBest] = useState(false);
  const [hud, setHud] = useState<Hud>({ distance: 0, score: 0, lives: START_LIVES, speed: 0, collected: [], flash: '' });
  const lastHud = useRef(0);
  const flash = useRef('');
  const flashTimer = useRef<number>(0);
  const countTimer = useRef<number>(0);

  const sync = useCallback(() => {
    const s = stateRef.current;
    setHud({ distance: s.distance, score: s.score, lives: s.lives, speed: s.speed, collected: s.collected.slice(), flash: flash.current });
  }, []);

  const finish = useCallback(() => {
    const s = stateRef.current;
    const prev = readHS();
    if (s.score > prev) { writeHS(s.score); setHs(Math.floor(s.score)); setNewBest(true); }
    setStatus(s.status); sync();
  }, [sync]);

  const onTick = useCallback((dt: number) => {
    const s = stateRef.current;
    if (s.status !== 'running') return;
    const v = s.version;
    const evs = step(s, dt);
    for (const e of evs) {
      if (e.type === 'pickup') { flash.current = `+ ${e.label} unlocked`; window.clearTimeout(flashTimer.current); flashTimer.current = window.setTimeout(() => { flash.current = ''; }, 1600); }
      if (e.type === 'hit') { flash.current = 'Hit. Shields up for a moment.'; window.clearTimeout(flashTimer.current); flashTimer.current = window.setTimeout(() => { flash.current = ''; }, 1200); }
    }
    if (s.version !== v) setVersion(s.version);
    if (s.status !== 'running') { finish(); return; }
    lastHud.current += dt;
    if (lastHud.current > 0.1 || evs.length) { lastHud.current = 0; sync(); }
  }, [finish, sync]);

  const runCountdown = useCallback(() => {
    const s = stateRef.current;
    s.status = 'countdown'; setStatus('countdown');
    let n = 3; setCount(n);
    window.clearInterval(countTimer.current);
    countTimer.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) { window.clearInterval(countTimer.current); s.status = 'running'; setStatus('running'); }
      else setCount(n);
    }, 700);
  }, []);

  const start = useCallback(() => {
    stateRef.current = createRace(PICKUPS, Date.now());
    flash.current = ''; setNewBest(false); setVersion((x) => x + 1); sync(); runCountdown();
  }, [runCountdown, sync]);

  const pause = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'running' || s.status === 'countdown') { window.clearInterval(countTimer.current); s.status = 'paused'; setStatus('paused'); }
  }, []);
  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'paused') runCountdown(); else pause();
  }, [pause, runCountdown]);
  const onSteer = useCallback((d: -1 | 1) => steer(stateRef.current, d), []);

  useEffect(() => {
    const vis = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', pause);
    return () => {
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', pause);
      window.clearInterval(countTimer.current); window.clearTimeout(flashTimer.current);
    };
  }, [pause]);

  const s = stateRef.current;
  const pct = Math.min(100, (hud.distance / GOAL_DISTANCE) * 100);
  const playing = status === 'running' || status === 'countdown';

  return (
    <KeyboardControls map={KEYMAP}>
      <KeyBridge onSteer={onSteer} onPause={togglePause} />
      <div className="relative flex h-[min(76dvh,680px)] min-h-[420px] flex-col overflow-hidden border border-foreground bg-secondary shadow-[6px_6px_0_hsl(var(--primary))]">
        <div className="relative flex-1" aria-label="Racing track" role="img">
          <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 4.2, 8.5], fov: 55 }} frameloop={playing ? 'always' : 'demand'}>
            <Scene state={s} version={version} onTick={onTick} />
          </Canvas>

          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 p-2 md:p-3">
            <div className="flex items-start justify-between gap-2 font-mono text-[11px] text-secondary-foreground">
              <div className="bg-secondary/90 px-2.5 py-1.5" aria-live="off">
                <div className="opacity-60">SCORE</div><div className="text-lg font-bold leading-none" data-testid="text-race-score">{Math.floor(hud.score)}</div>
                <div className="mt-1 opacity-60">BEST {hs}</div>
              </div>
              <div className="bg-secondary/90 px-2.5 py-1.5 text-right">
                <div aria-label={`${hud.lives} lives left`} className="flex justify-end gap-1">{Array.from({ length: START_LIVES }, (_, i) => <span key={i} className={`h-2.5 w-4 ${i < hud.lives ? 'bg-primary' : 'bg-secondary-foreground/20'}`} />)}</div>
                <div className="mt-1">{Math.round(hud.speed * 3.6)} km/h</div>
                <div className="opacity-60">labs {hud.collected.length}/{LABS.length}</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-secondary/70"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 font-mono text-[10px] text-secondary">{Math.floor(hud.distance)} / {GOAL_DISTANCE} m to deploy</div>
            {hud.flash && status === 'running' && <div className="mx-auto mt-2 w-fit bg-accent px-3 py-1 font-mono text-xs text-accent-foreground" role="status">{hud.flash}</div>}
          </div>

          {playing && (
            <button onClick={togglePause} aria-label="Pause" data-testid="button-race-pause" className="absolute bottom-3 right-3 hidden border border-secondary-foreground/40 bg-secondary/90 p-2 text-secondary-foreground md:block"><Pause className="h-4 w-4" /></button>
          )}

          {status === 'countdown' && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="font-display text-8xl font-extrabold text-primary drop-shadow-[3px_3px_0_hsl(var(--foreground))]" aria-live="assertive">{count}</span></div>}

          {status === 'ready' && (
            <Overlay>
              <p className="font-mono text-[11px] uppercase tracking-wider text-primary">how to drive</p>
              <h2 className="mt-1 font-display text-3xl font-extrabold">Ship it to the deploy line.</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li><b>Steer:</b> Left / Right arrows, A / D, or the big buttons below.</li>
                <li><b>Avoid:</b> blue cars, orange cones and yellow barriers. You have 3 lives.</li>
                <li><b>Collect:</b> green tokens. Each one unlocks a real lab to explore after the race.</li>
                <li><b>Pause:</b> P or Esc. Switching tabs pauses automatically.</li>
              </ul>
              <button className="btn btn-primary mt-5 !px-6 !py-3 !text-sm" onClick={start} data-testid="button-race-start" autoFocus>Start engine</button>
            </Overlay>
          )}
          {status === 'paused' && (
            <Overlay>
              <h2 className="font-display text-3xl font-extrabold">Paused</h2>
              <p className="mt-1 text-sm opacity-70">{Math.floor(hud.distance)} m driven. Resume gives you a short countdown.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={runCountdown} data-testid="button-race-resume" autoFocus><Play className="h-4 w-4" />Resume</button>
                <button className="btn btn-ghost !text-secondary-foreground !border-secondary-foreground/50" onClick={start} data-testid="button-race-restart"><RotateCcw className="h-4 w-4" />Restart</button>
              </div>
            </Overlay>
          )}
          {(status === 'won' || status === 'lost') && (
            <Overlay wide>
              <p className="font-mono text-[11px] uppercase tracking-wider text-primary">{status === 'won' ? 'deploy complete' : 'pipeline failed'}</p>
              <h2 className="font-display text-3xl font-extrabold">{status === 'won' ? 'You reached production.' : 'Out of lives.'}</h2>
              <p className="mt-1 font-mono text-xs">score {Math.floor(hud.score)} · best on this device {hs}{newBest ? ' · new personal best' : ''} · {Math.floor(hud.distance)} m</p>
              <p className="mt-3 text-sm opacity-80">Collected {hud.collected.length} of {LABS.length}. Every lab is open to you either way:</p>
              <ul className="mt-2 grid max-h-[34dvh] gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                {LABS.map((l) => {
                  const got = hud.collected.includes(l.slug);
                  return (
                    <li key={l.slug}>
                      <Link href={`/projects/${l.slug}`} data-testid={`link-race-lab-${l.slug}`} className={`flex items-center gap-2 border px-2 py-1.5 text-xs hover:border-primary ${got ? 'border-accent bg-accent/25' : 'border-secondary-foreground/20 opacity-75'}`}>
                        <span className="font-mono opacity-60">{l.num}</span><span className="flex-1">{l.title}</span><span className="font-mono text-[10px]">{got ? 'collected' : 'open'}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button className="btn btn-primary mt-4" onClick={start} data-testid="button-race-again" autoFocus><RotateCcw className="h-4 w-4" />Race again</button>
            </Overlay>
          )}
        </div>

        {/* Touch controls */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 border-t border-foreground bg-secondary p-2 md:hidden">
          <SteerBtn label="Steer left" onPress={() => onSteer(-1)} disabled={status !== 'running'}><ChevronLeft className="h-8 w-8" /></SteerBtn>
          <button onClick={playing || status === 'paused' ? togglePause : start} aria-label={status === 'paused' ? 'Resume' : playing ? 'Pause' : 'Start'} className="grid w-14 place-items-center border border-secondary-foreground/30 text-secondary-foreground">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <SteerBtn label="Steer right" onPress={() => onSteer(1)} disabled={status !== 'running'}><ChevronRight className="h-8 w-8" /></SteerBtn>
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] text-muted-foreground">High score is saved only in this browser. There is no online leaderboard. Prefer text? <Link href="/game" className="underline">Play Incident Commander</Link>.</p>
    </KeyboardControls>
  );
}

function SteerBtn({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button aria-label={label} disabled={disabled} onPointerDown={(e) => { e.preventDefault(); onPress(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress(); } }}
      className="grid h-16 touch-none select-none place-items-center bg-primary text-primary-foreground shadow-[2px_2px_0_hsl(var(--secondary-foreground)/.4)] active:translate-y-px disabled:opacity-40">{children}</button>
  );
}

function Overlay({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-secondary/70 p-3">
      <div role="dialog" aria-modal="false" className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} border border-secondary-foreground/30 bg-secondary p-5 text-secondary-foreground shadow-[4px_4px_0_hsl(var(--primary))]`}>{children}</div>
    </div>
  );
}
