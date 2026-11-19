import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { LabFrame, Panel, Pill, Btn } from '@/components/lab-kit';

type Inc = { id: string; label: string; cause: string; series: (t: number) => { p99: number; err: number; sat: number }; logs: [number, string, string][]; satLabel: string; deployAt?: number };
const rnd = (t: number) => ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1;
const INCIDENTS: Inc[] = [
  {
    id: 'pool', label: 'Checkout latency spike', cause: 'Database connection pool exhaustion', satLabel: 'db pool in use (%)',
    series: (t) => ({ p99: t < 18 ? 210 + rnd(t) * 30 : 1400 + rnd(t) * 600, err: t < 22 ? 0.3 + rnd(t + 1) * 0.2 : 2.1 + rnd(t) * 1.2, sat: t < 14 ? 45 + rnd(t) * 10 : Math.min(100, 60 + (t - 14) * 9) }),
    logs: [[12, 'INFO', 'batch export job started (rows=2.4M)'], [16, 'WARN', 'pool: 18/20 connections in use'], [19, 'WARN', 'pool: waiting for connection 1200ms'], [22, 'ERROR', 'timeout acquiring connection after 5000ms'], [24, 'ERROR', 'POST /checkout 503 upstream timeout']],
  },
  {
    id: 'leak', label: 'Gradual memory growth', cause: 'Memory leak in session cache', satLabel: 'container memory (% of limit)',
    series: (t) => ({ p99: 180 + t * 4 + rnd(t) * 20 + (t % 10 === 9 ? 900 : 0), err: t % 10 === 9 ? 4.5 : 0.2 + rnd(t) * 0.1, sat: 30 + (t % 10) * 7.5 }),
    logs: [[5, 'INFO', 'session cache size=48120'], [9, 'ERROR', 'container killed: OOMKilled exit 137'], [15, 'INFO', 'session cache size=51877 (no evictions)'], [19, 'ERROR', 'container killed: OOMKilled exit 137'], [29, 'ERROR', 'container killed: OOMKilled exit 137']],
  },
  {
    id: 'deploy', label: '5xx after release', cause: 'Bad deployment (v2.7.0 config change)', satLabel: 'cpu (%)', deployAt: 15,
    series: (t) => ({ p99: 220 + rnd(t) * 40, err: t < 15 ? 0.25 + rnd(t) * 0.15 : 11 + rnd(t) * 3, sat: 38 + rnd(t) * 8 }),
    logs: [[14, 'INFO', 'rollout web: v2.6.3 -> v2.7.0 started'], [15, 'INFO', 'rollout web: complete'], [15, 'ERROR', 'GET /api/cart 500 feature flag "cart_v2" missing from config'], [17, 'ERROR', 'GET /api/cart 500 feature flag "cart_v2" missing from config'], [21, 'WARN', 'alert ErrorBudgetBurn fired (burn=26.4)']],
  },
];
const CAUSES = ['Database connection pool exhaustion', 'Memory leak in session cache', 'Bad deployment (v2.7.0 config change)', 'Network partition between zones', 'Upstream DNS failure'];

export default function Observability() {
  const [id, setId] = useState('pool');
  const [lvl, setLvl] = useState('ALL');
  const [guess, setGuess] = useState('');
  const inc = INCIDENTS.find((i) => i.id === id)!;
  const data = useMemo(() => Array.from({ length: 30 }, (_, t) => ({ t: `14:${String(t * 2).padStart(2, '0')}`, ...inc.series(t) })).map((d) => ({ ...d, p99: Math.round(d.p99), err: +d.err.toFixed(2), sat: Math.round(d.sat) })), [inc]);
  const logs = inc.logs.filter((l) => lvl === 'ALL' || l[1] === lvl);
  const ts = (n: number) => `14:${String(n * 2).padStart(2, '0')}`;
  const chart = (key: 'p99' | 'err' | 'sat', label: string, color: string) => (
    <div>
      <div className="lab-label mb-1">{label}</div>
      <div className="h-28">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: -18, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <XAxis dataKey="t" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} interval={6} />
            <YAxis tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} />
            <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
            {inc.deployAt !== undefined && <ReferenceLine x={ts(inc.deployAt)} stroke="hsl(var(--primary))" strokeDasharray="4 2" label={{ value: 'deploy', fontSize: 9 }} />}
            <Line type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={1.8} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
  const rules = `groups:
  - name: storefront-slo
    rules:
      - alert: ErrorBudgetFastBurn
        expr: |
          (sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) > (14.4 * 0.001)
          and
          (sum(rate(http_requests_total{code=~"5.."}[1h])) / sum(rate(http_requests_total[1h]))) > (14.4 * 0.001)
        labels: { severity: page }
      - alert: LatencyP99High
        expr: histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))) > 1
        for: 5m
        labels: { severity: ticket }
      - alert: DbPoolSaturation
        expr: db_pool_in_use / db_pool_max > 0.9
        for: 3m
        labels: { severity: ticket }
      - alert: ContainerOOMKilled
        expr: increase(kube_pod_container_status_restarts_total[15m]) > 0 and on(pod) kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1
        labels: { severity: ticket }
`;
  const notes = `# Incident notes (synthetic): ${inc.label}\n\nRoot cause: ${inc.cause}\nYour hypothesis: ${guess || '(not submitted)'}\n\n## Timeline\n${inc.logs.map((l) => `${ts(l[0])} ${l[1]} ${l[2]}`).join('\n')}\n`;
  return (
    <LabFrame mode="simulation" onReset={() => { setId('pool'); setLvl('ALL'); setGuess(''); }} files={[{ name: 'alert-rules.yaml', content: rules }, { name: 'incident-notes.md', content: notes }]}>
      <div className="mb-4 flex flex-wrap gap-2">
        {INCIDENTS.map((i) => <Btn key={i.id} variant={i.id === id ? 'ink' : 'ghost'} onClick={() => { setId(i.id); setGuess(''); }} data-testid={`button-incident-${i.id}`}>{i.label}</Btn>)}
        <Pill tone="warn" className="ml-auto self-center">synthetic telemetry</Pill>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Golden signals">
          <div className="space-y-2">
            {chart('p99', 'latency p99 (ms)', 'hsl(12 82% 50%)')}
            {chart('err', 'error rate (%)', 'hsl(354 70% 46%)')}
            {chart('sat', inc.satLabel, 'hsl(168 55% 30%)')}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Logs" aside={<select className="lab-input !w-auto !py-1" value={lvl} onChange={(e) => setLvl(e.target.value)} data-testid="select-log-level">{['ALL', 'INFO', 'WARN', 'ERROR'].map((x) => <option key={x}>{x}</option>)}</select>}>
            <div className="code-surface max-h-56 space-y-1 overflow-auto rounded-[3px] p-3" data-testid="list-logs">
              {logs.map((l, i) => <div key={i}><span className="opacity-50">{ts(l[0])}</span> <span className={l[1] === 'ERROR' ? 'text-[hsl(354_80%_68%)]' : l[1] === 'WARN' ? 'text-[hsl(42_90%_62%)]' : 'text-[hsl(168_50%_60%)]'}>{l[1]}</span> {l[2]}</div>)}
            </div>
          </Panel>
          <Panel title="Root cause hypothesis">
            <div className="space-y-1.5">
              {CAUSES.map((c) => (
                <button key={c} onClick={() => setGuess(c)} data-testid={`button-cause-${CAUSES.indexOf(c)}`} className={`w-full border px-2 py-1.5 text-left text-sm transition-colors ${guess === c ? (c === inc.cause ? 'border-accent bg-accent/10' : 'border-destructive bg-destructive/10') : 'border-border hover:border-foreground'}`}>{c}</button>
              ))}
            </div>
            {guess && <p className={`rise mt-2 text-sm ${guess === inc.cause ? 'text-accent' : 'text-destructive'}`} data-testid="text-cause-result">{guess === inc.cause ? 'Correct. The saturation and log sequence point here.' : 'Not supported by the evidence. Compare when each signal first changes.'}</p>}
          </Panel>
        </div>
      </div>
    </LabFrame>
  );
}
