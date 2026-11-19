import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, Bookmark, CheckCircle2, ArrowUpRight, ArrowRight } from 'lucide-react';
import { LABS, ALL_TECH } from '@/labs/registry';
import { useProgress, usePageMeta } from '@/lib/lab-store';
import { Pill } from '@/components/lab-kit';

export default function Home() {
  usePageMeta('DevOps Engineering Lab - 15 runnable infrastructure labs', 'A hands-on portfolio of fifteen browser-run DevOps labs: Kubernetes troubleshooting, Terraform drift, GitOps, canary rollouts, SLOs, RBAC, DR drills and more.');
  const [q, setQ] = useState('');
  const [tech, setTech] = useState<string[]>([]);
  const [only, setOnly] = useState<'all' | 'saved' | 'todo'>('all');
  const { bookmarks, completed, toggleBookmark } = useProgress();
  const list = useMemo(() => LABS.filter((l) => {
    const hay = `${l.title} ${l.summary} ${l.tech.join(' ')}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (tech.length && !tech.some((t) => l.tech.includes(t))) return false;
    if (only === 'saved' && !bookmarks.includes(l.slug)) return false;
    if (only === 'todo' && completed.includes(l.slug)) return false;
    return true;
  }), [q, tech, only, bookmarks, completed]);
  const sims = LABS.filter((l) => l.kind === 'simulation').length;

  return (
    <div>
      <section className="grid-paper border-b border-foreground/80">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.5fr_1fr] md:px-8 md:py-20">
          <div>
            <div className="rise mb-5 flex flex-wrap gap-2"><Pill tone="info">{LABS.length} labs</Pill><Pill tone="warn">{sims} simulations</Pill><Pill tone="ok">{LABS.length - sims} working tools</Pill></div>
            <h1 className="rise font-display text-5xl font-extrabold leading-[0.92] tracking-[-0.03em] md:text-7xl" style={{ animationDelay: '60ms' }}>
              Don't read<br />the resume.<br /><span className="text-primary">Break the cluster.</span>
            </h1>
            <p className="rise mt-6 max-w-xl text-lg text-muted-foreground" style={{ animationDelay: '120ms' }}>
              Fifteen working DevOps labs that run entirely in your browser. Inject a failing pipeline stage, diagnose an OOMKilled pod, burn an error budget, and download the config each one produces.
            </p>
          </div>
          <div className="rise self-end border border-foreground bg-secondary p-5 font-mono text-xs leading-relaxed text-secondary-foreground shadow-[6px_6px_0_hsl(var(--primary))]" style={{ animationDelay: '200ms' }}>
            <div className="mb-2 opacity-50">$ lab status</div>
            <div>labs.total ........ {LABS.length}</div>
            <div>labs.completed .... <span className="text-primary">{completed.length}</span></div>
            <div>labs.saved ........ {bookmarks.length}</div>
            <div>network.calls ..... 0</div>
            <div>cloud.accounts .... 0</div>
            <div className="mt-2 opacity-50">progress stored in localStorage<span className="blink">_</span></div>
          </div>
        </div>
      </section>

      <section className="border-b border-foreground/80 bg-secondary text-secondary-foreground">
        <Link href="/game" data-testid="link-play-game" className="group mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center md:gap-8 md:px-8">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-primary"><span className="ping-dot h-2 w-2 bg-primary" />pager: 9 open incidents</span>
          <span className="flex-1">
            <span className="block font-display text-2xl font-extrabold tracking-tight md:text-3xl">Rather play? Take the on-call pager.</span>
            <span className="block text-sm opacity-70">Incident Commander: an untimed, fictional outage game. Every decision leads to one of these fifteen labs.</span>
          </span>
          <span className="btn btn-primary self-start !px-5 !py-2.5 md:self-auto">Play the game <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
        </Link>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="search labs: rollout, terraform, slo..." className="lab-input !py-2.5 !pl-9 !text-sm" data-testid="input-search" />
          </div>
          <div className="flex border border-foreground/80">
            {(['all', 'saved', 'todo'] as const).map((k) => (
              <button key={k} onClick={() => setOnly(k)} data-testid={`button-filter-${k}`} className={`px-3 py-2 font-mono text-xs uppercase ${only === k ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}>{k === 'todo' ? 'not done' : k}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ALL_TECH.map((t) => (
            <button key={t} onClick={() => setTech(tech.includes(t) ? tech.filter((x) => x !== t) : [...tech, t])} data-testid={`button-tech-${t}`}
              className={`border px-2.5 py-1 font-mono text-[11px] transition-colors ${tech.includes(t) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-foreground'}`}>{t}</button>
          ))}
          {tech.length > 0 && <button onClick={() => setTech([])} className="px-2 font-mono text-[11px] underline" data-testid="button-clear-tech">clear</button>}
        </div>

        <div className="mt-8 border-t border-foreground/80">
          {list.map((l, i) => (
            <div key={l.slug} className="rise group relative grid grid-cols-[auto_1fr_auto] items-start gap-4 border-b border-border py-5 transition-colors hover:bg-card md:grid-cols-[70px_1.2fr_1fr_auto] md:px-3" style={{ animationDelay: `${i * 30}ms` }} data-testid={`card-lab-${l.slug}`}>
              <span className="font-display text-3xl font-extrabold text-foreground/20 transition-colors group-hover:text-primary">{l.num}</span>
              <div>
                <Link href={`/projects/${l.slug}`} className="font-display text-xl font-semibold tracking-tight after:absolute after:inset-0" data-testid={`link-lab-${l.slug}`}>{l.title}</Link>
                <p className="mt-1 text-sm text-muted-foreground md:hidden">{l.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Pill tone={l.kind === 'simulation' ? 'warn' : 'ok'}>{l.kind === 'simulation' ? 'simulation' : 'tool'}</Pill>
                  {l.tech.map((t) => <Pill key={t}>{t}</Pill>)}
                </div>
              </div>
              <p className="hidden text-sm text-muted-foreground md:block">{l.summary}</p>
              <div className="relative z-10 flex items-center gap-2">
                {completed.includes(l.slug) && <CheckCircle2 className="h-4 w-4 text-accent" aria-label="completed" />}
                <button onClick={() => toggleBookmark(l.slug)} aria-label="bookmark" data-testid={`button-bookmark-${l.slug}`} className="p-1">
                  <Bookmark className={`h-4 w-4 ${bookmarks.includes(l.slug) ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </button>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </div>
          ))}
          {!list.length && (
            <div className="py-16 text-center">
              <p className="font-display text-2xl font-semibold">No labs match.</p>
              <p className="mt-1 text-sm text-muted-foreground">Clear filters or try a broader term like "kubernetes".</p>
              <button className="btn btn-ghost mt-4" onClick={() => { setQ(''); setTech([]); setOnly('all'); }} data-testid="button-reset-filters">Reset filters</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
