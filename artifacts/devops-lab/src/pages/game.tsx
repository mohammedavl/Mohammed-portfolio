import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Lightbulb, RotateCcw, Activity, Flame, Trophy, ArrowUpRight, ShieldAlert, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { usePageMeta } from '@/lib/lab-store';
import { getLab } from '@/labs/registry';
import { Pill } from '@/components/lab-kit';
import {
  SCENARIOS, LAB_SLUGS, MAX_HEALTH, HINT_PENALTY, createInitialState, startGame, chooseOption, nextIncident, showHint,
  getCurrentScenario, lastAnswer, discoveredSlugs, loadBestScore, saveBestScore, maxPossibleScore, rankFor,
  type GameState, type Quality,
} from '@/game/engine';

const QUALITY: Record<Quality, { label: string; tone: 'ok' | 'warn' | 'bad'; Icon: typeof CheckCircle2 }> = {
  best: { label: 'Resolved', tone: 'ok', Icon: CheckCircle2 },
  partial: { label: 'Partial fix', tone: 'warn', Icon: AlertTriangle },
  harmful: { label: 'Made it worse', tone: 'bad', Icon: XCircle },
};

function LabLinks({ slugs }: { slugs: string[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {slugs.map((s) => {
        const lab = getLab(s);
        if (!lab) return null;
        return (
          <li key={s}>
            <Link href={`/projects/${s}`} data-testid={`link-game-lab-${s}`} className="group flex items-start gap-3 border border-foreground/80 bg-card p-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">
              <span className="font-display text-xl font-extrabold text-foreground/30 group-hover:text-primary">{lab.num}</span>
              <span className="flex-1">
                <span className="block font-display font-semibold leading-tight">{lab.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{lab.summary}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function HealthBar({ health }: { health: number }) {
  const tone = health > 60 ? 'bg-accent' : health > 30 ? 'bg-[hsl(var(--chart-4))]' : 'bg-destructive';
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" aria-hidden />Platform health</span>
        <span data-testid="text-health">{health}%</span>
      </div>
      <div className="mt-1.5 h-3 border border-foreground/80 bg-card" role="progressbar" aria-label="Platform health" aria-valuemin={0} aria-valuemax={MAX_HEALTH} aria-valuenow={health}>
        <div className={`game-bar h-full origin-left ${tone}`} style={{ transform: `scaleX(${health / MAX_HEALTH})` }} />
      </div>
    </div>
  );
}

export default function Game() {
  usePageMeta('Incident Commander - a DevOps on-call game', 'Play an untimed, browser-only incident response game. Rescue a fictional platform across nine incidents and discover fifteen hands-on DevOps labs along the way.');
  const [state, setState] = useState<GameState>(createInitialState);
  const [best, setBest] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setBest(loadBestScore()); }, []);
  useEffect(() => {
    if (state.status === 'won' || state.status === 'lost') setBest(saveBestScore(state.score));
  }, [state.status, state.score]);
  useEffect(() => { headingRef.current?.focus(); }, [state.status, state.index]);

  const choose = useCallback((id: string) => setState((s) => chooseOption(s, id)), []);
  const next = useCallback(() => setState((s) => nextIncident(s)), []);
  const hint = useCallback(() => setState((s) => showHint(s)), []);
  const begin = useCallback(() => setState(startGame()), []);
  const reset = useCallback(() => setState(createInitialState()), []);

  const sc = getCurrentScenario(state);
  const ans = lastAnswer(state);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      setState((s) => {
        if (s.status === 'playing') {
          const cur = getCurrentScenario(s);
          const n = Number(e.key);
          if (cur && n >= 1 && n <= cur.choices.length) return chooseOption(s, cur.choices[n - 1].id);
          if (e.key.toLowerCase() === 'h') return showHint(s);
        } else if (s.status === 'answered' && e.key.toLowerCase() === 'n') return nextIncident(s);
        return s;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const found = discoveredSlugs(state);

  return (
    <div className="grid-paper min-h-[80dvh] border-b border-foreground/80">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
        <div className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <Pill tone="warn">fictional simulation</Pill>
          <span>no real systems, no credentials, untimed</span>
        </div>

        {state.status === 'intro' && (
          <section className="rise" aria-labelledby="game-title">
            <h1 id="game-title" ref={headingRef} tabIndex={-1} className="font-display text-5xl font-extrabold leading-[0.92] tracking-[-0.03em] outline-none md:text-7xl">
              You're on call.<br /><span className="text-primary">Halcyon is on fire.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Halcyon is a made-up online store. Tonight, nine incidents hit it one after another. For each, read the signals and pick a response. Good calls restore health and build a streak; bad calls cost health. Reach the end with the platform alive.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-[1.3fr_1fr]">
              <div className="border border-foreground bg-card p-5">
                <h2 className="lab-label mb-3">How it works</h2>
                <ol className="space-y-2 text-sm">
                  <li><b>1.</b> Read the incident brief and the signals. No timer; take your time.</li>
                  <li><b>2.</b> Stuck? Open the plain-language hint (costs {HINT_PENALTY} points on that incident).</li>
                  <li><b>3.</b> Pick a response. You will see what happened and why.</li>
                  <li><b>4.</b> Each result links to the real lab on this site that practises that skill.</li>
                </ol>
              </div>
              <div className="code-surface border border-foreground p-5 shadow-[6px_6px_0_hsl(var(--primary))]">
                <div className="opacity-50">$ pager --controls</div>
                <div>1 2 3 ....... choose response</div>
                <div>H ........... show hint</div>
                <div>N ........... next incident</div>
                <div>touch/click . everything works</div>
                <div className="mt-2 opacity-50">best score on this device: <span className="text-[hsl(var(--chart-4))]" data-testid="text-best-intro">{best}</span></div>
              </div>
            </div>
            <button onClick={begin} className="btn btn-primary mt-8 !px-6 !py-3 !text-sm" data-testid="button-start-game">
              Take the pager <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </section>
        )}

        {(state.status === 'playing' || state.status === 'answered') && sc && (
          <div className="grid gap-6 md:grid-cols-[1fr_240px]">
            <aside className="order-first space-y-4 md:order-last" aria-label="Status">
              <div className="border border-foreground bg-card p-4 md:sticky md:top-20">
                <HealthBar health={state.health} />
                <dl className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px] md:grid-cols-1">
                  <div><dt className="text-muted-foreground uppercase">Score</dt><dd className="font-display text-2xl font-extrabold" data-testid="text-score">{state.score}</dd></div>
                  <div><dt className="flex items-center gap-1 text-muted-foreground uppercase"><Flame className="h-3 w-3" aria-hidden />Streak</dt><dd className="font-display text-2xl font-extrabold text-primary" data-testid="text-streak">{state.streak}</dd></div>
                  <div><dt className="text-muted-foreground uppercase">Best</dt><dd className="font-display text-2xl font-extrabold" data-testid="text-best">{best}</dd></div>
                </dl>
                <div className="mt-4 flex gap-1" aria-label={`Incident ${state.index + 1} of ${SCENARIOS.length}`}>
                  {SCENARIOS.map((s, i) => {
                    const a = state.answers[i];
                    const c = a ? (a.quality === 'best' ? 'bg-accent' : a.quality === 'partial' ? 'bg-[hsl(var(--chart-4))]' : 'bg-destructive') : i === state.index ? 'bg-foreground' : 'bg-muted';
                    return <span key={s.id} className={`h-1.5 flex-1 ${c}`} />;
                  })}
                </div>
                <button onClick={reset} className="btn btn-ghost mt-4 w-full justify-center" data-testid="button-abandon">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restart
                </button>
              </div>
            </aside>

            <section key={sc.id} className="rise" aria-labelledby="incident-title">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className={`px-2 py-0.5 font-bold text-primary-foreground ${sc.severity === 'SEV1' ? 'bg-destructive' : sc.severity === 'SEV2' ? 'bg-primary' : 'bg-secondary'}`}>{sc.severity}</span>
                <span>{sc.code}</span>
                <span className="text-muted-foreground">service/{sc.service}</span>
                <span className="ml-auto text-muted-foreground">{state.index + 1} / {SCENARIOS.length}</span>
              </div>
              <h1 id="incident-title" ref={headingRef} tabIndex={-1} className="mt-3 font-display text-3xl font-extrabold tracking-tight outline-none md:text-5xl" data-testid="text-incident-title">{sc.title}</h1>
              <p className="mt-3 text-base">{sc.brief}</p>
              <div className="code-surface mt-4 border border-foreground p-4">
                {sc.signals.map((x) => <div key={x}><span className="text-[hsl(var(--chart-4))]">&gt;</span> {x}</div>)}
              </div>

              {state.status === 'playing' && (
                <div className="mt-4">
                  {state.hintShown ? (
                    <div className="rise flex gap-3 border-l-4 border-[hsl(var(--chart-4))] bg-card p-4 text-sm" role="note" data-testid="text-hint">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><p>{sc.hint}</p>
                    </div>
                  ) : (
                    <button onClick={hint} className="btn btn-ghost" data-testid="button-hint"><Lightbulb className="h-3.5 w-3.5" aria-hidden /> Show hint (-{HINT_PENALTY} pts) [H]</button>
                  )}
                </div>
              )}

              <fieldset className="mt-6" disabled={state.status !== 'playing'}>
                <legend className="lab-label mb-2">Your call</legend>
                <div className="space-y-2">
                  {sc.choices.map((c, i) => {
                    const picked = ans && state.status === 'answered' && ans.choiceId === c.id;
                    const reveal = state.status === 'answered';
                    const q = QUALITY[c.quality];
                    return (
                      <button key={c.id} onClick={() => choose(c.id)} data-testid={`button-choice-${c.id}`} aria-pressed={!!picked}
                        className={`game-choice group flex w-full items-center gap-3 border p-4 text-left transition-colors ${picked ? 'border-foreground bg-secondary text-secondary-foreground shadow-[4px_4px_0_hsl(var(--primary))]' : reveal ? 'border-border bg-card opacity-60' : 'border-foreground/80 bg-card hover:bg-muted'}`}>
                        <span className="grid h-7 w-7 shrink-0 place-items-center border border-current font-mono text-xs">{i + 1}</span>
                        <span className="flex-1 font-medium">{c.label}</span>
                        {reveal && <q.Icon className={`h-4 w-4 shrink-0 ${c.quality === 'best' ? 'text-accent' : c.quality === 'partial' ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'}`} aria-label={q.label} />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {state.status === 'answered' && ans && (() => {
                const choice = sc.choices.find((c) => c.id === ans.choiceId)!;
                const q = QUALITY[ans.quality];
                return (
                  <div className="rise mt-6 border border-foreground bg-card" role="status" aria-live="polite" data-testid="panel-feedback">
                    <div className={`flex flex-wrap items-center gap-3 border-b border-foreground px-4 py-3 ${ans.quality === 'best' ? 'bg-accent text-accent-foreground' : ans.quality === 'partial' ? 'bg-[hsl(var(--chart-4))] text-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                      <q.Icon className="h-5 w-5" aria-hidden />
                      <span className="font-display text-xl font-bold">{q.label}</span>
                      <span className="ml-auto font-mono text-xs">+{ans.points} pts{ans.hintUsed ? ' (hint used)' : ''}</span>
                    </div>
                    <div className="space-y-4 p-4">
                      <p>{choice.consequence}</p>
                      <p className="text-sm text-muted-foreground"><b className="text-foreground">Takeaway.</b> {sc.lesson}</p>
                      <div>
                        <h2 className="lab-label mb-2">Practise this for real in the portfolio</h2>
                        <LabLinks slugs={sc.labs} />
                      </div>
                      <button onClick={next} className="btn btn-primary !px-5 !py-2.5" data-testid="button-next">
                        {state.health <= 0 ? 'See what happened' : state.index + 1 >= SCENARIOS.length ? 'Finish shift' : 'Next incident'} [N] <ArrowRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {(state.status === 'won' || state.status === 'lost') && (
          <section className="rise" aria-labelledby="end-title">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
              {state.status === 'won' ? <Trophy className="h-4 w-4 text-primary" aria-hidden /> : <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden />}
              {state.status === 'won' ? 'Shift complete' : 'Platform down'}
            </div>
            <h1 id="end-title" ref={headingRef} tabIndex={-1} className="mt-3 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] outline-none md:text-6xl" data-testid="text-end-title">
              {state.status === 'won' ? <>Halcyon survived.<br /><span className="text-primary">{rankFor(state.score)}.</span></> : <>Health hit zero.<br /><span className="text-primary">Every outage teaches.</span></>}
            </h1>
            <div className="mt-6 grid max-w-2xl grid-cols-2 gap-px border border-foreground bg-foreground sm:grid-cols-4">
              {[['Score', `${state.score} / ${maxPossibleScore()}`], ['Health', `${state.health}%`], ['Best streak', state.bestStreak], ['Device best', best]].map(([k, v]) => (
                <div key={k as string} className="bg-card p-3"><div className="lab-label">{k}</div><div className="font-display text-2xl font-extrabold" data-testid={`text-final-${String(k).toLowerCase().replace(' ', '-')}`}>{v}</div></div>
              ))}
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">Best score is stored only in this browser. There is no global leaderboard.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={begin} className="btn btn-primary !px-5 !py-2.5" data-testid="button-replay"><RotateCcw className="h-4 w-4" aria-hidden /> Play again</button>
              <Link href="/" className="btn btn-ghost !px-5 !py-2.5" data-testid="link-back-labs">Browse all labs</Link>
            </div>
            <div className="mt-10">
              <h2 className="font-display text-2xl font-bold">All 15 labs behind tonight's incidents</h2>
              <p className="mt-1 text-sm text-muted-foreground">{found.length} of {LAB_SLUGS.length} surfaced during your shift. Every one is a working, browser-run lab.</p>
              <div className="mt-4"><LabLinks slugs={[...LAB_SLUGS]} /></div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
