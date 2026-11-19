import { useState } from 'react';
import { LabFrame, Panel, Pill, Btn } from '@/components/lab-kit';

type Rule = { id: string; pattern: RegExp; severity: 'high' | 'medium' | 'low'; cause: string; next: string[] };
const RULES: Rule[] = [
  { id: 'oom', pattern: /OOMKilled|exit code 137|out of memory/i, severity: 'high', cause: 'Container exceeding memory limit', next: ['kubectl describe pod <pod> | grep -A3 "Last State"', 'Compare kubectl top pod against limits; raise limit or fix leak'] },
  { id: 'conn-refused', pattern: /connection refused|ECONNREFUSED/i, severity: 'high', cause: 'Dependency not listening (down, wrong port, or not Ready)', next: ['kubectl get endpoints <svc>', 'Check the target port matches containerPort'] },
  { id: 'timeout', pattern: /timed? ?out|deadline exceeded|ETIMEDOUT/i, severity: 'medium', cause: 'Slow or saturated dependency', next: ['Check dependency latency p99 and connection pool usage', 'Verify NetworkPolicy and DNS resolution'] },
  { id: 'dns', pattern: /no such host|NXDOMAIN|Temporary failure in name resolution/i, severity: 'high', cause: 'DNS resolution failure', next: ['kubectl -n kube-system logs -l k8s-app=kube-dns', 'nslookup <host> from a debug pod'] },
  { id: 'tls', pattern: /x509|certificate (has )?expired|tls handshake/i, severity: 'high', cause: 'TLS certificate problem', next: ['openssl s_client -connect <host>:443 | openssl x509 -noout -dates', 'Check cert-manager Certificate status'] },
  { id: 'disk', pattern: /no space left on device|disk pressure|ENOSPC/i, severity: 'high', cause: 'Disk exhausted', next: ['df -h on node; kubectl describe node | grep DiskPressure', 'Clean images / expand volume'] },
  { id: 'auth', pattern: /\b(401|403)\b|unauthori[sz]ed|forbidden|permission denied/i, severity: 'medium', cause: 'Authentication or authorisation failure', next: ['Check token/secret rotation dates', 'kubectl auth can-i for service accounts'] },
  { id: '5xx', pattern: /\b5\d\d\b.*(GET|POST|PUT|DELETE)|(GET|POST|PUT|DELETE).*\b5\d\d\b/, severity: 'medium', cause: 'Server errors returned to clients', next: ['Correlate first 5xx timestamp with deploys', 'Consider rollback if aligned with a release'] },
  { id: 'deadlock', pattern: /deadlock detected|lock wait timeout/i, severity: 'medium', cause: 'Database lock contention', next: ['Inspect pg_stat_activity / innodb status', 'Look for long transactions or missing indexes'] },
];
const SAMPLES: Record<string, string> = {
  'Payment outage': `2024-05-14T09:12:01Z INFO  payments-api starting v3.2.0
2024-05-14T09:12:04Z WARN  dial tcp 10.0.4.17:5432: connect: connection refused
2024-05-14T09:12:09Z ERROR POST /charge 503 upstream unavailable
2024-05-14T09:12:15Z ERROR context deadline exceeded calling fraud-svc
2024-05-14T09:12:20Z ERROR POST /charge 503 upstream unavailable`,
  'Node pressure': `kubelet: eviction manager: attempting to reclaim ephemeral-storage
kubelet: Node condition DiskPressure is now: True
app: write /var/log/app/trace.log: no space left on device
kubelet: container api Last State: Terminated Reason: OOMKilled exit code 137`,
  'Expired cert': `nginx: SSL_do_handshake() failed (SSL: error:0A000086:SSL routines::certificate verify failed)
client: x509: certificate has expired or is not yet valid: current time 2024-06-01T00:00:03Z is after 2024-05-31T23:59:59Z
api-gw: GET /v1/orders 502 tls handshake error`,
};
const ORDER = { high: 0, medium: 1, low: 2 };

export default function IncidentAssistant() {
  const [text, setText] = useState(SAMPLES['Payment outage']);
  const [out, setOut] = useState<{ rule: Rule; lines: string[] }[] | null>(null);
  const analyze = () => {
    const lines = text.split('\n').filter((l) => l.trim());
    const res = RULES.map((rule) => ({ rule, lines: lines.filter((l) => rule.pattern.test(l)) })).filter((r) => r.lines.length).sort((a, b) => ORDER[a.rule.severity] - ORDER[b.rule.severity] || b.lines.length - a.lines.length);
    setOut(res);
  };
  const report = out ? `TRIAGE REPORT (rule-based, deterministic - not AI)\n\n${out.length ? out.map((o, i) => `${i + 1}. [${o.rule.severity.toUpperCase()}] ${o.rule.cause}  (rule ${o.rule.id}, ${o.lines.length} line(s))\n   evidence:\n${o.lines.map((l) => `     ${l}`).join('\n')}\n   next:\n${o.rule.next.map((n) => `     - ${n}`).join('\n')}`).join('\n\n') : 'No rule matched. Escalate to a human responder.'}\n` : 'Run triage to produce a report.';
  return (
    <LabFrame mode="tool" onReset={() => { setText(SAMPLES['Payment outage']); setOut(null); }} files={[{ name: 'triage-report.md', content: report }, { name: 'rules.json', content: JSON.stringify(RULES.map((r) => ({ ...r, pattern: r.pattern.source, flags: r.pattern.flags })), null, 2) }]}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Object.keys(SAMPLES).map((k) => <Btn key={k} variant="ghost" onClick={() => { setText(SAMPLES[k]); setOut(null); }} data-testid={`button-sample-${k.replace(/\s/g, '-').toLowerCase()}`}>Load: {k}</Btn>)}
        <Pill tone="warn" className="ml-auto">Not AI - {RULES.length} regex rules</Pill>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Log input">
          <textarea className="lab-input min-h-[260px] resize-y" value={text} onChange={(e) => { setText(e.target.value); setOut(null); }} data-testid="input-logs" />
          <Btn className="mt-3" onClick={analyze} disabled={!text.trim()} data-testid="button-analyze">Run triage</Btn>
        </Panel>
        <Panel title="Findings">
          {!out && <p className="py-12 text-center text-sm text-muted-foreground">Results appear here. Every finding cites the rule and lines that matched.</p>}
          {out && !out.length && <p className="py-12 text-center text-sm">No rule matched. That is an honest answer: escalate to a human.</p>}
          <div className="space-y-3">
            {out?.map((o, i) => (
              <div key={o.rule.id} className="rise border border-border bg-card p-3" style={{ animationDelay: `${i * 60}ms` }} data-testid={`finding-${o.rule.id}`}>
                <div className="flex items-center gap-2"><Pill tone={o.rule.severity === 'high' ? 'bad' : 'warn'}>{o.rule.severity}</Pill><span className="font-medium">{o.rule.cause}</span></div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">rule {o.rule.id}: /{o.rule.pattern.source}/</div>
                <pre className="code-surface mt-2 overflow-auto rounded-[2px] p-2 text-[10.5px]">{o.lines.join('\n')}</pre>
                <ul className="mt-2 space-y-0.5 font-mono text-[11px]">{o.rule.next.map((n) => <li key={n}>&gt; {n}</li>)}</ul>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </LabFrame>
  );
}
