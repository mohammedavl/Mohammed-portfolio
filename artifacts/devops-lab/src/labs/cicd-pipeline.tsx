import { useEffect, useRef, useState } from 'react';
import { Check, X, Loader2, Minus } from 'lucide-react';
import { LabFrame, Panel, Field, Pill, Terminal, Btn } from '@/components/lab-kit';

const STAGES = ['lint', 'test', 'build', 'scan', 'deploy'] as const;
type St = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';
const FAIL_LOG: Record<string, string> = {
  lint: 'src/cart.ts:41:7  error  no-unused-vars  "total" is assigned but never used',
  test: 'FAIL cart.test.ts > applies discount: expected 87.5 received 90',
  build: 'error: failed to fetch base image: registry timeout after 30s',
  scan: 'gate: 2 HIGH findings with fixes available (policy: block)',
  deploy: 'error: deployment "web" exceeded progress deadline (readiness failing)',
};

export default function CicdPipeline() {
  const [failAt, setFailAt] = useState<string>('test');
  const [transient, setTransient] = useState(false);
  const [st, setSt] = useState<Record<string, St>>({});
  const [log, setLog] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = (from: number, att: number) => {
    setBusy(true);
    setAttempt(att);
    setSt((p) => { const n = { ...p }; STAGES.forEach((s, i) => { if (i >= from) n[s] = 'idle'; }); return n; });
    setLog((l) => [...l, `--- attempt ${att} from stage "${STAGES[from]}" ---`]);
    let t = 0;
    for (let i = from; i < STAGES.length; i++) {
      const s = STAGES[i];
      const fails = s === failAt && !(transient && att > 1);
      timers.current.push(window.setTimeout(() => { setSt((p) => ({ ...p, [s]: 'running' })); setLog((l) => [...l, `[${s}] started`]); }, t));
      t += 700;
      if (fails) {
        timers.current.push(window.setTimeout(() => {
          setSt((p) => { const n = { ...p, [s]: 'failed' as St }; STAGES.slice(i + 1).forEach((x) => (n[x] = 'skipped')); return n; });
          setLog((l) => [...l, `[${s}] ${FAIL_LOG[s]}`, `[${s}] FAILED - downstream skipped`]);
          setBusy(false);
        }, t));
        return;
      }
      timers.current.push(window.setTimeout(() => { setSt((p) => ({ ...p, [s]: 'passed' })); setLog((l) => [...l, `[${s}] passed`]); }, t));
    }
    timers.current.push(window.setTimeout(() => { setLog((l) => [...l, 'pipeline succeeded']); setBusy(false); }, t));
  };
  const failedIdx = STAGES.findIndex((s) => st[s] === 'failed');
  const reset = () => { timers.current.forEach(clearTimeout); setSt({}); setLog([]); setAttempt(0); setBusy(false); setFailAt('test'); setTransient(false); };
  const icon = (s: St) => s === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : s === 'passed' ? <Check className="h-4 w-4" /> : s === 'failed' ? <X className="h-4 w-4" /> : s === 'skipped' ? <Minus className="h-4 w-4" /> : null;
  const tone = (s: St) => s === 'passed' ? 'border-accent bg-accent/15 text-accent' : s === 'failed' ? 'border-destructive bg-destructive/10 text-destructive' : s === 'running' ? 'border-primary bg-primary/10 text-primary' : s === 'skipped' ? 'border-dashed border-border text-muted-foreground' : 'border-border';
  const wf = `name: pipeline
on:
  push: { branches: [main] }
  pull_request:
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run lint
  test:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test -- --reporter=junit
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image (retry transient registry errors)
        run: |
          for i in 1 2 3; do docker build -t app:\${{ github.sha }} . && break || sleep $((i*10)); done
  scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/scan.sh app:\${{ github.sha }} --fail-on high
  deploy:
    needs: scan
    if: github.ref == 'refs/heads/main'
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/deploy.sh app:\${{ github.sha }} && kubectl rollout status deploy/web --timeout=120s
`;
  return (
    <LabFrame mode="simulation" onReset={reset} files={[{ name: '.github/workflows/pipeline.yml', content: wf }, { name: 'run.log', content: log.join('\n') || '(run the pipeline to produce a log)' }]}>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Panel title="Fault injection">
          <div className="space-y-3">
            <Field label="Failing stage">
              <select className="lab-input" value={failAt} disabled={busy} onChange={(e) => setFailAt(e.target.value)} data-testid="select-fail-stage">
                <option value="none">none (green run)</option>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={transient} disabled={busy} onChange={(e) => setTransient(e.target.checked)} data-testid="checkbox-transient" /> Failure is transient</label>
            <Btn onClick={() => { setLog([]); setSt({}); run(0, 1); }} disabled={busy} className="w-full justify-center" data-testid="button-run-pipeline">Run pipeline</Btn>
            <Btn variant="ghost" onClick={() => run(failedIdx, attempt + 1)} disabled={busy || failedIdx < 0} className="w-full justify-center" data-testid="button-retry">Retry from failed stage</Btn>
          </div>
        </Panel>
        <Panel title={`Run ${attempt ? '#' + attempt : ''}`} aside={failedIdx >= 0 ? <Pill tone="bad">failed at {STAGES[failedIdx]}</Pill> : st.deploy === 'passed' ? <Pill tone="ok">succeeded</Pill> : busy ? <Pill tone="warn">running</Pill> : <Pill>idle</Pill>}>
          <div className="mb-4 flex flex-wrap items-center gap-1">
            {STAGES.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`flex min-w-[84px] items-center gap-2 border px-3 py-2 font-mono text-xs transition-colors ${tone(st[s] || 'idle')}`} data-testid={`stage-${s}`}>{icon(st[s] || 'idle')}{s}</div>
                {i < STAGES.length - 1 && <span className="h-px w-3 bg-foreground/40" />}
              </div>
            ))}
          </div>
          <Terminal lines={log.length ? log : ['waiting for run...']} className="min-h-[160px]" />
        </Panel>
      </div>
    </LabFrame>
  );
}
