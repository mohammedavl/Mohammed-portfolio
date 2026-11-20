import { lazy, Suspense, useState } from 'react';
import { Link } from 'wouter';
import { usePageMeta } from '@/lib/lab-store';

const RaceGame = lazy(() => import('@/race/race-game'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export default function Race() {
  usePageMeta('Pipeline Run - arcade drive through the DevOps lab', 'Drive three lanes, dodge traffic and collect DevOps tool pickups that unlock the fifteen runnable labs.');
  const [ok] = useState(hasWebGL);
  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-8 md:py-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-primary">arcade / 3 lanes / about 90 seconds</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">Pipeline Run</h1>
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">Steer left and right. Dodge cars, cones and barriers. Drive over glowing tool tokens to unlock labs. Reach the deploy line.</p>
      </div>
      {ok ? (
        <Suspense fallback={<div className="grid h-[min(72dvh,640px)] place-items-center border border-foreground bg-secondary font-mono text-xs text-secondary-foreground" role="status">loading engine<span className="blink">_</span></div>}>
          <RaceGame />
        </Suspense>
      ) : (
        <div className="border border-foreground bg-card p-6" role="alert">
          <p className="font-display text-2xl font-bold">This browser cannot run 3D graphics.</p>
          <p className="mt-2 text-sm text-muted-foreground">WebGL is unavailable or disabled, so the racing game cannot start. The text-based incident game works everywhere.</p>
          <div className="mt-4 flex flex-wrap gap-2"><Link href="/game" className="btn btn-primary">Play Incident Commander</Link><Link href="/" className="btn btn-ghost">Browse labs</Link></div>
        </div>
      )}
    </div>
  );
}
