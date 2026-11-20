import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useProgress } from '@/lib/lab-store';
import { LABS } from '@/labs/registry';

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { completed } = useProgress();
  const nav = [['/', 'Labs'], ['/race', 'Race'], ['/game', 'Play'], ['/about', 'About']] as const;
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-foreground/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
            <span className="grid h-7 w-7 place-items-center bg-primary font-mono text-[11px] font-bold text-primary-foreground shadow-[2px_2px_0_hsl(var(--foreground))]">DL</span>
            <span className="hidden font-display text-lg min-[380px]:inline font-extrabold tracking-tight">devops<span className="text-primary">/</span>lab</span>
          </Link>
          <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {nav.map(([h, l]) => (
              <Link key={h} href={h} data-testid={`link-nav-${l.toLowerCase()}`} aria-current={loc === h ? 'page' : undefined} className={`px-2 py-1.5 sm:px-3 font-mono text-xs uppercase tracking-wider transition-colors ${loc === h ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}>{l}</Link>
            ))}
            <span className="ml-2 hidden font-mono text-[11px] text-muted-foreground sm:inline" data-testid="text-progress">{completed.length}/{LABS.length} done</span>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-foreground/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 font-mono text-[11px] text-muted-foreground md:px-8">
          <span>All labs run locally in your browser. No cloud accounts, no telemetry, no network calls.</span>
          <span>Source for every lab is viewable and downloadable on its page.</span>
        </div>
      </footer>
    </div>
  );
}
