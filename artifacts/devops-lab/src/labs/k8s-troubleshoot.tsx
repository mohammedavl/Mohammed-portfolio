import { useState } from 'react';
import { LabFrame, Panel, Pill, Terminal, Btn } from '@/components/lab-kit';

type Scenario = { id: string; label: string; status: string; cmds: { cmd: string; out: string[] }[]; fixes: { label: string; ok: boolean; why: string }[]; fixYaml: string };

const S: Scenario[] = [
  {
    id: 'crash', label: 'CrashLoopBackOff', status: 'CrashLoopBackOff   6 (41s ago)',
    cmds: [
      { cmd: 'kubectl describe pod checkout-7d9f-x2k4', out: ['Last State: Terminated', '  Reason: Error', '  Exit Code: 1', 'Events:', '  Warning BackOff  kubelet  Back-off restarting failed container'] },
      { cmd: 'kubectl logs checkout-7d9f-x2k4 --previous', out: ['level=info msg="starting checkout"', 'level=fatal msg="required env DATABASE_URL not set"'] },
    ],
    fixes: [
      { label: 'Increase memory limit to 1Gi', ok: false, why: 'Exit code 1 with a fatal config log is not an OOM (that would be 137 / OOMKilled).' },
      { label: 'Add DATABASE_URL from secret checkout-db', ok: true, why: 'The app exits because a required env var is missing; injecting it from the secret fixes startup.' },
      { label: 'Delete the pod', ok: false, why: 'The ReplicaSet recreates it with the same spec; it will crash again.' },
    ],
    fixYaml: `        env:\n          - name: DATABASE_URL\n            valueFrom:\n              secretKeyRef: { name: checkout-db, key: url }`,
  },
  {
    id: 'pull', label: 'ImagePullBackOff', status: 'ImagePullBackOff   0',
    cmds: [
      { cmd: 'kubectl describe pod checkout-7d9f-x2k4', out: ['Image: registry.internal/checkout:v2.4.l', 'Events:', '  Warning Failed  kubelet  Failed to pull image "registry.internal/checkout:v2.4.l": manifest unknown'] },
      { cmd: 'kubectl get deploy checkout -o jsonpath={..image}', out: ['registry.internal/checkout:v2.4.l'] },
    ],
    fixes: [
      { label: 'Create imagePullSecret', ok: false, why: '"manifest unknown" means the registry was reached and authorised; the tag does not exist. Auth failures return 401/unauthorized.' },
      { label: 'Correct tag to v2.4.1', ok: true, why: 'The tag has a typo (letter l instead of 1). Fixing it lets the kubelet pull.' },
      { label: 'Set imagePullPolicy: Never', ok: false, why: 'The image is not cached on the node, so the pod would fail with ErrImageNeverPull.' },
    ],
    fixYaml: `        image: registry.internal/checkout:v2.4.1`,
  },
  {
    id: 'oom', label: 'OOMKilled', status: 'CrashLoopBackOff   3 (12s ago)',
    cmds: [
      { cmd: 'kubectl describe pod checkout-7d9f-x2k4', out: ['Last State: Terminated', '  Reason: OOMKilled', '  Exit Code: 137', 'Limits: memory: 256Mi'] },
      { cmd: 'kubectl top pod checkout-7d9f-x2k4', out: ['NAME                 CPU   MEMORY', 'checkout-7d9f-x2k4   180m  251Mi'] },
    ],
    fixes: [
      { label: 'Raise memory limit to 512Mi and set JVM MaxRAMPercentage=75', ok: true, why: 'Working set reaches the 256Mi limit; the kernel kills the process. More headroom plus a heap cap relative to the limit fixes it.' },
      { label: 'Increase CPU request', ok: false, why: 'CPU throttles, it never causes OOM kills.' },
      { label: 'Add a liveness probe', ok: false, why: 'Probes restart containers; this one is already being killed by the kernel.' },
    ],
    fixYaml: `        resources:\n          requests: { memory: 384Mi }\n          limits:   { memory: 512Mi }\n        env:\n          - { name: JAVA_TOOL_OPTIONS, value: "-XX:MaxRAMPercentage=75" }`,
  },
  {
    id: 'pending', label: 'Pending (unschedulable)', status: 'Pending            0',
    cmds: [
      { cmd: 'kubectl describe pod checkout-7d9f-x2k4', out: ['Requests: cpu: 4', 'Events:', '  Warning FailedScheduling  default-scheduler  0/3 nodes are available: 3 Insufficient cpu.'] },
      { cmd: 'kubectl describe nodes | grep -A2 Allocatable', out: ['Allocatable: cpu: 1930m', 'Allocatable: cpu: 1930m', 'Allocatable: cpu: 1930m'] },
    ],
    fixes: [
      { label: 'Lower CPU request to 500m', ok: true, why: 'No node has 4 CPUs allocatable. A realistic request fits; set it from observed usage.' },
      { label: 'Restart the scheduler', ok: false, why: 'The scheduler is working correctly; it reports the exact reason.' },
      { label: 'Add a toleration', ok: false, why: 'Tolerations address taints; events report insufficient CPU, not taints.' },
    ],
    fixYaml: `        resources:\n          requests: { cpu: 500m }\n          limits:   { cpu: "1" }`,
  },
  {
    id: 'ready', label: 'Running but not Ready', status: 'Running 0/1        0',
    cmds: [
      { cmd: 'kubectl describe pod checkout-7d9f-x2k4', out: ['Readiness: http-get http://:8080/healthz', 'Events:', '  Warning Unhealthy  kubelet  Readiness probe failed: connection refused'] },
      { cmd: 'kubectl logs checkout-7d9f-x2k4', out: ['level=info msg="listening" addr=:9090'] },
    ],
    fixes: [
      { label: 'Change probe port to 9090', ok: true, why: 'The app listens on 9090 while the probe hits 8080. Aligning the port makes it Ready and adds it to Service endpoints.' },
      { label: 'Remove the readiness probe', ok: false, why: 'The pod would receive traffic, but the Service targetPort is likely wrong too; hiding the signal is not a fix.' },
      { label: 'Raise initialDelaySeconds to 120', ok: false, why: '"connection refused" is a port mismatch, not slow startup.' },
    ],
    fixYaml: `        readinessProbe:\n          httpGet: { path: /healthz, port: 9090 }`,
  },
];

export default function K8sTroubleshoot() {
  const [sid, setSid] = useState('crash');
  const [ran, setRan] = useState<number[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const sc = S.find((x) => x.id === sid)!;
  const fixed = pick !== null && sc.fixes[pick].ok;
  const reset = (id = 'crash') => { setSid(id); setRan([]); setPick(null); };
  const term = [`$ kubectl get pods -n shop`, 'NAME                 READY  STATUS', `checkout-7d9f-x2k4   ${fixed ? '1/1    Running            0' : sc.status}`];
  ran.forEach((i) => term.push('', `$ ${sc.cmds[i].cmd}`, ...sc.cmds[i].out));
  const runbook = `# Runbook: ${sc.label}\n\n## Symptom\n${sc.status}\n\n## Evidence\n${sc.cmds.map((c) => `$ ${c.cmd}\n${c.out.join('\n')}`).join('\n\n')}\n\n## Fix\n${sc.fixes.find((f) => f.ok)!.label}\n\n${sc.fixes.find((f) => f.ok)!.why}\n\n## Rejected options\n${sc.fixes.filter((f) => !f.ok).map((f) => `- ${f.label}: ${f.why}`).join('\n')}\n\n## Verify\nkubectl rollout status deploy/checkout -n shop\n`;
  const patch = `# patch for deploy/checkout (spec.template.spec.containers[0])\napiVersion: apps/v1\nkind: Deployment\nmetadata: { name: checkout, namespace: shop }\nspec:\n  template:\n    spec:\n      containers:\n      - name: checkout\n${sc.fixYaml}\n`;
  return (
    <LabFrame mode="simulation" onReset={() => reset()} files={[{ name: 'runbook.md', content: runbook }, { name: 'fix-patch.yaml', content: patch }]}>
      <div className="mb-4 flex flex-wrap gap-2">
        {S.map((x) => <Btn key={x.id} variant={x.id === sid ? 'ink' : 'ghost'} onClick={() => reset(x.id)} data-testid={`button-scenario-${x.id}`}>{x.label}</Btn>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Cluster shell" aside={fixed ? <Pill tone="ok">resolved</Pill> : <Pill tone="bad">degraded</Pill>}>
          <Terminal lines={term} className="min-h-[220px]" />
          <div className="mt-3 flex flex-wrap gap-2">
            {sc.cmds.map((c, i) => <Btn key={i} variant="ghost" disabled={ran.includes(i)} onClick={() => setRan([...ran, i])} data-testid={`button-cmd-${i}`}>run: {c.cmd.split(' ').slice(0, 3).join(' ')}</Btn>)}
          </div>
        </Panel>
        <Panel title="Apply repair">
          {ran.length < sc.cmds.length && <p className="mb-2 text-xs text-muted-foreground">Gather evidence first ({ran.length}/{sc.cmds.length} commands run).</p>}
          <div className="space-y-2">
            {sc.fixes.map((f, i) => (
              <button key={i} disabled={ran.length === 0 || fixed} onClick={() => setPick(i)} data-testid={`button-fix-${i}`}
                className={`w-full border p-2 text-left text-sm transition-colors disabled:opacity-50 ${pick === i ? (f.ok ? 'border-accent bg-accent/10' : 'border-destructive bg-destructive/10') : 'border-border hover:border-foreground'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {pick !== null && <p className={`rise mt-3 text-sm ${sc.fixes[pick].ok ? 'text-accent' : 'text-destructive'}`} data-testid="text-fix-result">{sc.fixes[pick].ok ? 'Fixed. ' : 'Not this. '}{sc.fixes[pick].why}</p>}
        </Panel>
      </div>
    </LabFrame>
  );
}
