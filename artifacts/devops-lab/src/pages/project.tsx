import { useParams, Link } from 'wouter';
import { ArrowLeft, ArrowRight, Bookmark, CheckCircle2, Download } from 'lucide-react';
import { LABS, getLab } from '@/labs/registry';
import { LAB_COMPONENTS } from '@/labs';
import { useProgress, usePageMeta, downloadText } from '@/lib/lab-store';
import { Pill } from '@/components/lab-kit';
import NotFound from '@/pages/not-found';

export default function Project() {
  const { slug = '' } = useParams<{ slug: string }>();
  const lab = getLab(slug);
  usePageMeta(lab ? `${lab.title} - DevOps Engineering Lab` : 'Lab not found - DevOps Engineering Lab', lab ? lab.summary : 'This lab does not exist.');
  const { bookmarks, completed, toggleBookmark, toggleCompleted } = useProgress();
  if (!lab) return <NotFound />;
  const Comp = LAB_COMPONENTS[lab.slug];
  const idx = LABS.indexOf(lab);
  const prev = LABS[(idx + LABS.length - 1) % LABS.length];
  const next = LABS[(idx + 1) % LABS.length];
  const done = completed.includes(lab.slug);
  const saved = bookmarks.includes(lab.slug);
  const notes = `# ${lab.title}\n\nType: ${lab.kind}\nTech: ${lab.tech.join(', ')}\n\n## How to use\n${lab.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## Technical explanation\n${lab.explanation.join('\n\n')}\n\n## Architecture\n\`\`\`\n${lab.diagram}\n\`\`\`\n\n## Limitations\n${lab.limitations.map((s) => `- ${s}`).join('\n')}\n`;

  return (
    <div key={lab.slug}>
      <section className="grid-paper border-b border-foreground/80">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
          <Link href="/" className="mb-6 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground" data-testid="link-back"><ArrowLeft className="h-3.5 w-3.5" /> all labs</Link>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="rise">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-extrabold text-primary">LAB {lab.num}</span>
                <Pill tone={lab.kind === 'simulation' ? 'warn' : 'ok'}>{lab.kind}</Pill>
                {lab.tech.map((t) => <Pill key={t}>{t}</Pill>)}
              </div>
              <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.025em] md:text-6xl" data-testid="text-lab-title">{lab.title}</h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{lab.summary}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => toggleBookmark(lab.slug)} className={`btn ${saved ? 'btn-ink' : 'btn-ghost'}`} data-testid="button-bookmark"><Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-current' : ''}`} />{saved ? 'Saved' : 'Save'}</button>
              <button onClick={() => toggleCompleted(lab.slug)} className={`btn ${done ? 'btn-ghost !border-accent !text-accent' : 'btn-primary'}`} data-testid="button-complete"><CheckCircle2 className="h-3.5 w-3.5" />{done ? 'Completed' : 'Mark complete'}</button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <h2 className="lab-label mb-3">01 / Run it</h2>
            <Comp />
          </div>
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <div>
              <h2 className="lab-label mb-3">Guided steps</h2>
              <ol className="space-y-3">
                {lab.instructions.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm"><span className="grid h-5 w-5 shrink-0 place-items-center bg-secondary font-mono text-[10px] text-secondary-foreground">{i + 1}</span><span>{s}</span></li>
                ))}
              </ol>
            </div>
            <div className="border border-destructive/40 bg-destructive/5 p-4">
              <h2 className="lab-label mb-2 !text-destructive">Limitations</h2>
              <ul className="space-y-1.5 text-sm">{lab.limitations.map((s) => <li key={s}>- {s}</li>)}</ul>
            </div>
          </aside>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="lab-label mb-3">02 / How it works</h2>
            <div className="space-y-4 text-[15px] leading-relaxed">{lab.explanation.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
            <button className="btn btn-ghost mt-6" onClick={() => downloadText(`${lab.slug}-notes.md`, notes)} data-testid="button-download-notes"><Download className="h-3.5 w-3.5" /> Download lab notes (.md)</button>
          </div>
          <div>
            <h2 className="lab-label mb-3">03 / Architecture</h2>
            <pre className="code-surface overflow-auto border border-foreground p-5 text-[12px] shadow-[4px_4px_0_hsl(var(--primary))]" data-testid="text-diagram">{lab.diagram}</pre>
          </div>
        </div>

        <nav className="mt-16 grid gap-3 border-t border-foreground/80 pt-6 sm:grid-cols-2">
          <Link href={`/projects/${prev.slug}`} className="group border border-border p-4 transition-colors hover:border-foreground" data-testid="link-prev-lab">
            <span className="lab-label flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> previous</span>
            <span className="font-display text-lg font-semibold group-hover:text-primary">{prev.num} {prev.title}</span>
          </Link>
          <Link href={`/projects/${next.slug}`} className="group border border-border p-4 text-right transition-colors hover:border-foreground" data-testid="link-next-lab">
            <span className="lab-label flex items-center justify-end gap-1">next <ArrowRight className="h-3 w-3" /></span>
            <span className="font-display text-lg font-semibold group-hover:text-primary">{next.num} {next.title}</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
