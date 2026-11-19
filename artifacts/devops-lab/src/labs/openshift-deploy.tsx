import { useState } from 'react';
import { LabFrame, Panel, Field, Pill } from '@/components/lab-kit';

const D = { ns: 'payments-dev', app: 'ledger-api', image: 'quay.io/example/ledger-api:1.8.2', replicas: 3, port: 8080, tls: true, host: '' };
const dns = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export default function OpenshiftDeploy() {
  const [s, setS] = useState(D);
  const errs: string[] = [];
  if (!dns.test(s.ns) || s.ns.length > 63) errs.push('namespace must be a DNS-1123 label (lowercase, digits, hyphens, max 63)');
  if (!dns.test(s.app) || s.app.length > 63) errs.push('app name must be a DNS-1123 label');
  if (!/^[\w.-]+(:\d+)?\/[\w./-]+(:[\w.-]+|@sha256:[a-f0-9]{64})$/.test(s.image)) errs.push('image should be registry/repo:tag or @sha256 digest');
  if (/:latest$/.test(s.image)) errs.push('avoid :latest - rollouts become non-reproducible');
  if (s.replicas < 1 || s.replicas > 50) errs.push('replicas must be 1-50');
  if (s.port < 1024 || s.port > 65535) errs.push('restricted SCC: use a non-privileged port (1024-65535)');
  const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${s.app}
  namespace: ${s.ns}
  labels: { app: ${s.app} }
spec:
  replicas: ${s.replicas}
  selector:
    matchLabels: { app: ${s.app} }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 25%, maxUnavailable: 0 }
  template:
    metadata:
      labels: { app: ${s.app} }
    spec:
      containers:
        - name: ${s.app}
          image: ${s.image}
          ports: [{ containerPort: ${s.port}, name: http }]
          readinessProbe: { httpGet: { path: /healthz, port: http }, periodSeconds: 5 }
          resources:
            requests: { cpu: 100m, memory: 256Mi }
            limits:   { memory: 512Mi }
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            capabilities: { drop: [ALL] }
            seccompProfile: { type: RuntimeDefault }
---
apiVersion: v1
kind: Service
metadata:
  name: ${s.app}
  namespace: ${s.ns}
spec:
  selector: { app: ${s.app} }
  ports: [{ name: http, port: ${s.port}, targetPort: http }]
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: ${s.app}
  namespace: ${s.ns}
spec:
${s.host ? `  host: ${s.host}\n` : ''}  to: { kind: Service, name: ${s.app} }
  port: { targetPort: http }
${s.tls ? '  tls:\n    termination: edge\n    insecureEdgeTerminationPolicy: Redirect\n' : ''}`;
  const f = (k: keyof typeof D, label: string, type = 'text') => (
    <Field label={label}>
      <input className="lab-input" type={type} value={String(s[k])} onChange={(e) => setS({ ...s, [k]: type === 'number' ? +e.target.value : e.target.value })} data-testid={`input-${k}`} />
    </Field>
  );
  return (
    <LabFrame mode="tool" onReset={() => setS(D)} files={[{ name: 'openshift.yaml', content: yaml }, { name: 'deploy.sh', content: `#!/usr/bin/env bash\nset -euo pipefail\noc new-project ${s.ns} || oc project ${s.ns}\noc apply -f openshift.yaml\noc rollout status deploy/${s.app} -n ${s.ns}\noc get route ${s.app} -n ${s.ns} -o jsonpath='{.spec.host}'\n` }]}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel title="Inputs">
          <div className="space-y-3">
            {f('ns', 'Namespace')}
            {f('app', 'Application name')}
            {f('image', 'Image')}
            <div className="grid grid-cols-2 gap-3">{f('replicas', 'Replicas', 'number')}{f('port', 'Port', 'number')}</div>
            {f('host', 'Route host (optional)')}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.tls} onChange={(e) => setS({ ...s, tls: e.target.checked })} data-testid="checkbox-tls" /> Edge TLS + redirect</label>
          </div>
        </Panel>
        <Panel title="Validation and flow" aside={errs.length ? <Pill tone="bad">{errs.length} issue(s)</Pill> : <Pill tone="ok">valid</Pill>}>
          <ul className="mb-4 space-y-1 text-sm" data-testid="list-validation">
            {errs.length ? errs.map((e) => <li key={e} className="text-destructive">- {e}</li>) : <li className="text-accent">All inputs pass validation. YAML below is ready for oc apply.</li>}
          </ul>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="border border-foreground px-2 py-1">{s.tls ? 'https' : 'http'}://{s.host || `${s.app}-${s.ns}.apps.cluster`}</span>
            <span>-&gt;</span><span className="border border-primary bg-primary/10 px-2 py-1">Route</span>
            <span>-&gt;</span><span className="border border-foreground px-2 py-1">Service :{s.port}</span>
            <span>-&gt;</span>
            <span className="flex gap-1">{Array.from({ length: Math.min(s.replicas, 12) }).map((_, i) => <span key={i} className="h-5 w-3 border border-accent bg-accent/30" />)}{s.replicas > 12 && <span>+{s.replicas - 12}</span>}</span>
          </div>
        </Panel>
      </div>
    </LabFrame>
  );
}
