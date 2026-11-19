import { useState } from 'react';
import { LabFrame, Panel, Field, Pill, Terminal, Btn, Stat } from '@/components/lab-kit';

const STEPS = [5, 10, 25, 50, 100];
type Phase = 'stable' | 'progressing' | 'promoted' | 'aborted';

export default function CanaryRollout() {
  const [threshold, setThreshold] = useState(1.5);
  const [canaryErr, setCanaryErr] = useState(0.8);
  const [stableErr] = useState(0.42);
  const [step, setStep] = useState(-1);
  const [phase, setPhase] = useState<Phase>('stable');
  const [log, setLog] = useState<string[]>(['rollout storefront: stable v1.4.0 at 100%']);
  const weight = phase === 'aborted' ? 0 : phase === 'promoted' ? 100 : step < 0 ? 0 : STEPS[step];
  const reqs = Math.round(1840 * weight / 100);
  const add = (m: string) => setLog((l) => [...l, m]);
  const advance = () => {
    const next = step + 1;
    if (next === 0) { setStep(0); setPhase('progressing'); add(`setWeight ${STEPS[0]}% -> canary v1.5.0`); return; }
    const pass = canaryErr <= threshold;
    add(`analysis at ${STEPS[step]}%: canary error ${canaryErr.toFixed(2)}% vs threshold ${threshold.toFixed(2)}% (${reqs} req/min) -> ${pass ? 'Successful' : 'Failed'}`);
    if (!pass) { setPhase('aborted'); add('rollout ABORTED: traffic returned to stable 100%'); return; }
    if (next >= STEPS.length - 1) { setStep(STEPS.length - 1); setPhase('promoted'); add('canary promoted: v1.5.0 now stable'); return; }
    setStep(next); add(`setWeight ${STEPS[next]}%`);
  };
  const reset = () => { setStep(-1); setPhase('stable'); setLog(['rollout storefront: stable v1.4.0 at 100%']); setThreshold(1.5); setCanaryErr(0.8); };
  const yaml = `apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: storefront }
spec:
  replicas: 10
  selector: { matchLabels: { app: storefront } }
  template:
    metadata: { labels: { app: storefront } }
    spec:
      containers: [{ name: storefront, image: registry.internal/storefront:v1.5.0 }]
  strategy:
    canary:
      steps:
${STEPS.slice(0, -1).map((w) => `        - setWeight: ${w}\n        - analysis: { templates: [{ templateName: error-rate }] }`).join('\n')}
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: error-rate }
spec:
  metrics:
    - name: error-rate
      interval: 1m
      count: 3
      failureLimit: 1
      successCondition: result[0] <= ${(threshold / 100).toFixed(4)}
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{app="storefront",role="canary",code=~"5.."}[2m]))
            / sum(rate(http_requests_total{app="storefront",role="canary"}[2m]))
`;
  return (
    <LabFrame mode="simulation" onReset={reset} files={[{ name: 'rollout.yaml', content: yaml }, { name: 'rollout.log', content: log.join('\n') }]}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel title="Analysis inputs">
          <div className="space-y-4">
            <Field label={`Error threshold: ${threshold.toFixed(2)}%`}><input type="range" min={0.1} max={5} step={0.05} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="w-full accent-[hsl(var(--primary))]" data-testid="input-threshold" /></Field>
            <Field label={`Canary error rate: ${canaryErr.toFixed(2)}%`} hint={`stable baseline ${stableErr}%`}><input type="range" min={0} max={8} step={0.05} value={canaryErr} onChange={(e) => setCanaryErr(+e.target.value)} className="w-full accent-[hsl(var(--primary))]" data-testid="input-canary-error" /></Field>
            <Btn onClick={advance} disabled={phase === 'promoted' || phase === 'aborted'} className="w-full justify-center" data-testid="button-advance">{step < 0 ? 'Start canary' : 'Run analysis and advance'}</Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="ink" disabled={phase !== 'progressing'} onClick={() => { setPhase('promoted'); setStep(STEPS.length - 1); add('manual promote-full'); }} data-testid="button-promote">Promote</Btn>
              <Btn variant="ghost" disabled={phase !== 'progressing'} onClick={() => { setPhase('aborted'); add('manual abort: rollback to stable'); }} data-testid="button-rollback">Rollback</Btn>
            </div>
          </div>
        </Panel>
        <Panel title="Traffic split" aside={<Pill tone={phase === 'aborted' ? 'bad' : phase === 'promoted' ? 'ok' : phase === 'progressing' ? 'warn' : 'info'}>{phase}</Pill>}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Canary weight" value={`${weight}%`} />
            <Stat label="Canary req/min" value={reqs} />
            <Stat label="Verdict" value={canaryErr <= threshold ? 'pass' : 'fail'} tone={canaryErr <= threshold ? 'ok' : 'bad'} />
          </div>
          <div className="flex h-10 overflow-hidden border border-foreground font-mono text-[11px]">
            <div className="flex items-center justify-center bg-secondary text-secondary-foreground transition-all duration-700" style={{ width: `${100 - weight}%` }}>{100 - weight > 8 && `stable v1.4.0 ${100 - weight}%`}</div>
            <div className="flex items-center justify-center bg-primary text-primary-foreground transition-all duration-700" style={{ width: `${weight}%` }}>{weight > 8 && `canary ${weight}%`}</div>
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">{STEPS.map((s, i) => <span key={s} className={i <= step && phase !== 'aborted' ? 'text-primary' : ''}>{s}%</span>)}</div>
          <Terminal lines={log} className="mt-4" />
        </Panel>
      </div>
    </LabFrame>
  );
}
