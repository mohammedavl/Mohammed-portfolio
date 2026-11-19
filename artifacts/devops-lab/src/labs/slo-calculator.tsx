import { useState } from 'react';
import { LabFrame, Panel, Field, Pill, Stat } from '@/components/lab-kit';

const D = { target: 99.9, window: 30, elapsed: 12, requests: 18_400_000, errors: 9_870 };

export default function SloCalculator() {
  const [s, setS] = useState(D);
  const allowedRatio = 1 - s.target / 100;
  const budget = allowedRatio * s.requests;
  const consumed = budget > 0 ? s.errors / budget : 0;
  const errRatio = s.requests > 0 ? s.errors / s.requests : 0;
  const burn = allowedRatio > 0 ? errRatio / allowedRatio : 0;
  const elapsedFrac = Math.min(1, s.elapsed / s.window);
  const projected = elapsedFrac > 0 ? consumed / elapsedFrac : 0;
  const downtimeMin = allowedRatio * s.window * 24 * 60;
  const policy = consumed >= 1 ? ['bad', 'Budget exhausted: freeze feature releases, reliability work only.'] : projected > 1 ? ['warn', 'Projected to exhaust before window end: slow releases, require canaries.'] : ['ok', 'Within budget: normal release cadence.'];
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const num = (k: keyof typeof D, label: string, step = 1) => (
    <Field label={label}><input type="number" step={step} min={0} className="lab-input" value={s[k]} onChange={(e) => setS({ ...s, [k]: Math.max(0, +e.target.value) })} data-testid={`input-${k}`} /></Field>
  );
  const sloth = `version: "prometheus/v1"
service: "storefront"
slos:
  - name: "requests-availability"
    objective: ${s.target}
    description: "Share of non-5xx responses over ${s.window}d"
    sli:
      events:
        error_query: sum(rate(http_requests_total{job="storefront",code=~"5.."}[{{.window}}]))
        total_query: sum(rate(http_requests_total{job="storefront"}[{{.window}}]))
    alerting:
      name: StorefrontAvailability
      page_alert: { labels: { severity: page } }
      ticket_alert: { labels: { severity: ticket } }
`;
  const report = `SLO report
target            ${s.target}%
window            ${s.window}d (day ${s.elapsed})
requests          ${fmt(s.requests)}
errors            ${fmt(s.errors)}
error budget      ${fmt(budget)} requests
consumed          ${(consumed * 100).toFixed(1)}%
burn rate         ${burn.toFixed(2)}x
projected at end  ${(projected * 100).toFixed(1)}%
allowed downtime  ${downtimeMin.toFixed(1)} min / window
policy            ${policy[1]}
`;
  const pct = Math.min(100, consumed * 100);
  return (
    <LabFrame mode="tool" onReset={() => setS(D)} files={[{ name: 'slo.yaml', content: sloth }, { name: 'slo-report.txt', content: report }]}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel title="Inputs">
          <div className="space-y-3">
            {num('target', 'SLO target (%)', 0.01)}
            <div className="grid grid-cols-2 gap-3">{num('window', 'Window (days)')}{num('elapsed', 'Elapsed (days)')}</div>
            {num('requests', 'Total requests')}
            {num('errors', 'Failed requests')}
          </div>
        </Panel>
        <Panel title="Budget" aside={<Pill tone={policy[0] as 'ok'}>{policy[0] === 'ok' ? 'healthy' : policy[0] === 'warn' ? 'at risk' : 'exhausted'}</Pill>}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Budget (req)" value={fmt(Math.round(budget))} />
            <Stat label="Consumed" value={`${(consumed * 100).toFixed(1)}%`} tone={consumed >= 1 ? 'bad' : consumed > elapsedFrac ? 'warn' : 'ok'} />
            <Stat label="Burn rate" value={`${burn.toFixed(2)}x`} tone={burn > 1 ? 'warn' : 'ok'} />
            <Stat label="Downtime allowed" value={`${downtimeMin.toFixed(1)}m`} />
          </div>
          <div className="relative mt-6 h-6 border border-foreground bg-card">
            <div className={`h-full transition-all duration-500 ${consumed >= 1 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-6px] h-[34px] w-px bg-foreground" style={{ left: `${elapsedFrac * 100}%` }} />
            <span className="absolute -top-5 -translate-x-1/2 font-mono text-[10px]" style={{ left: `${elapsedFrac * 100}%` }}>day {s.elapsed}</span>
          </div>
          <p className="mt-4 text-sm" data-testid="text-policy">{policy[1]} Projected consumption at window end: <b>{(projected * 100).toFixed(1)}%</b>.</p>
        </Panel>
      </div>
    </LabFrame>
  );
}
