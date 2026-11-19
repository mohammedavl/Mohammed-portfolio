import { useState } from 'react';
import { LabFrame, Panel, Field, Pill, Stat } from '@/components/lab-kit';

const D = { instRate: 0.0832, storRate: 0.08, egressRate: 0.09, lbRate: 0.0225, instances: 6, hours: 730, storage: 850, egress: 1200, lbs: 1, discount: 28 };

export default function CostCalculator() {
  const [s, setS] = useState(D);
  const rows = [
    ['Compute', `${s.instances} inst x ${s.hours} h x $${s.instRate}/h`, s.instances * s.hours * s.instRate],
    ['Block storage', `${s.storage} GB-mo x $${s.storRate}`, s.storage * s.storRate],
    ['Data egress', `${s.egress} GB x $${s.egressRate}`, s.egress * s.egressRate],
    ['Load balancers', `${s.lbs} x ${s.hours} h x $${s.lbRate}/h`, s.lbs * s.hours * s.lbRate],
  ] as const;
  const total = rows.reduce((a, r) => a + r[2], 0);
  const commit = total - rows[0][2] * (s.discount / 100);
  const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const max = Math.max(...rows.map((r) => r[2]), 1);
  const num = (k: keyof typeof D, label: string, step = 1) => (
    <Field label={label}><input type="number" min={0} step={step} className="lab-input" value={s[k]} onChange={(e) => setS({ ...s, [k]: Math.max(0, +e.target.value) })} data-testid={`input-${k}`} /></Field>
  );
  const csv = `# ILLUSTRATIVE RATES - not published provider prices\nline_item,basis,monthly_usd\n${rows.map((r) => `${r[0]},"${r[1]}",${r[2].toFixed(2)}`).join('\n')}\ntotal_on_demand,,${total.toFixed(2)}\ntotal_with_${s.discount}pct_compute_commit,,${commit.toFixed(2)}\nannual_on_demand,,${(total * 12).toFixed(2)}\n`;
  return (
    <LabFrame mode="tool" onReset={() => setS(D)} files={[{ name: 'cost-estimate.csv', content: csv }]}>
      <div className="mb-3"><Pill tone="warn">Illustrative rates - edit them to match your pricing</Pill></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
        <Panel title="Unit rates (USD)">
          <div className="space-y-3">{num('instRate', 'Instance / hour', 0.0001)}{num('storRate', 'Storage / GB-month', 0.001)}{num('egressRate', 'Egress / GB', 0.001)}{num('lbRate', 'Load balancer / hour', 0.0001)}</div>
        </Panel>
        <Panel title="Usage">
          <div className="space-y-3">{num('instances', 'Instances')}{num('hours', 'Hours / month', 1)}{num('storage', 'Storage GB')}{num('egress', 'Egress GB')}{num('lbs', 'Load balancers')}{num('discount', 'Compute commit discount %')}</div>
        </Panel>
        <Panel title="Estimate">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat label="Monthly" value={money(total)} />
            <Stat label="With commit" value={money(commit)} tone="ok" />
          </div>
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r[0]} data-testid={`row-cost-${r[0]}`}>
                <div className="flex justify-between text-sm"><span>{r[0]}</span><span className="font-mono">{money(r[2])}</span></div>
                <div className="font-mono text-[10px] text-muted-foreground">{r[1]}</div>
                <div className="mt-1 h-1.5 bg-muted"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${(r[2] / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Annual on-demand: {money(total * 12)}. Business-hours scheduling (217 h) would make compute {money(s.instances * 217 * s.instRate)}.</p>
        </Panel>
      </div>
    </LabFrame>
  );
}
