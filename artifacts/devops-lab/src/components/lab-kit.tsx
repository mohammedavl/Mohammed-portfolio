import { useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Download, RotateCcw, FileCode2, FlaskConical, Wrench } from 'lucide-react';
import { downloadText } from '@/lib/lab-store';
import { cn } from '@/lib/utils';

export type LabFile = { name: string; content: string };

export function LabFrame({
  mode,
  files,
  onReset,
  children,
}: {
  mode: 'simulation' | 'tool';
  files: LabFile[];
  onReset: () => void;
  children: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const file = files[Math.min(active, files.length - 1)];
  return (
    <div className="border border-foreground/80 bg-card shadow-[4px_4px_0_hsl(var(--foreground))]" data-testid="lab-frame">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/80 bg-secondary px-4 py-2.5 text-secondary-foreground">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          {mode === 'simulation' ? <FlaskConical className="h-3.5 w-3.5 text-primary" /> : <Wrench className="h-3.5 w-3.5 text-primary" />}
          <span data-testid="text-lab-mode">
            {mode === 'simulation' ? 'Simulation - runs in your browser, no real infrastructure' : 'Functional tool - deterministic, client-side'}
          </span>
        </div>
        <button onClick={onReset} className="btn btn-ghost !border-secondary-foreground/40 !py-1 !text-secondary-foreground hover:!bg-white/10" data-testid="button-reset-lab">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
      <div className="grid-paper p-4 md:p-6">{children}</div>
      <div className="border-t border-foreground/80">
        <div className="flex flex-wrap items-center gap-1 bg-muted px-2 pt-2">
          <FileCode2 className="ml-1 mr-1 h-4 w-4 text-muted-foreground" />
          {files.map((f, i) => (
            <button
              key={f.name}
              onClick={() => setActive(i)}
              data-testid={`tab-file-${i}`}
              className={cn(
                'rounded-t-[3px] px-3 py-1.5 font-mono text-[11px] transition-colors',
                i === active ? 'bg-[hsl(222_34%_12%)] text-[hsl(40_30%_88%)]' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.name}
            </button>
          ))}
          <button className="btn btn-ghost ml-auto mb-1 !py-1" onClick={() => downloadText(file.name, file.content)} data-testid="button-download-file">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
        <pre className="code-surface max-h-[420px] overflow-auto p-4" data-testid="text-file-content">{file.content}</pre>
      </div>
    </div>
  );
}

export function Panel({ title, children, className, aside }: { title: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={cn('border border-border bg-card/90 p-4 backdrop-blur-[1px]', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="lab-label !text-foreground">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="lab-label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Btn({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'ink' }) {
  return <button {...p} className={cn('btn', `btn-${variant}`, className)} />;
}

const tones = {
  ok: 'bg-accent/12 text-accent border-accent/40',
  bad: 'bg-destructive/10 text-destructive border-destructive/40',
  warn: 'bg-[hsl(42_85%_48%/.14)] text-[hsl(32_80%_32%)] border-[hsl(42_85%_40%/.5)]',
  info: 'bg-muted text-muted-foreground border-border',
};
export function Pill({ tone = 'info', children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider', tones[tone], className)}>{children}</span>;
}

export function Terminal({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <pre className={cn('code-surface max-h-72 overflow-auto rounded-[3px] p-3', className)} data-testid="text-terminal">
      {lines.join('\n')}
    </pre>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className="border-l-2 border-foreground/70 pl-3">
      <div className="lab-label">{label}</div>
      <div className={cn('font-display text-2xl font-semibold tabular-nums', tone === 'ok' && 'text-accent', tone === 'bad' && 'text-destructive', tone === 'warn' && 'text-[hsl(32_80%_38%)]')}>{value}</div>
    </div>
  );
}
