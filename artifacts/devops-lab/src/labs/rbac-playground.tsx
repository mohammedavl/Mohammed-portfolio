import { useState } from 'react';
import { LabFrame, Panel, Field } from '@/components/lab-kit';

type Rule = { apiGroups: string[]; resources: string[]; verbs: string[] };
type Role = { name: string; kind: 'Role' | 'ClusterRole'; namespace?: string; rules: Rule[] };
const ROLES: Role[] = [
  { name: 'viewer', kind: 'ClusterRole', rules: [{ apiGroups: ['', 'apps'], resources: ['pods', 'services', 'deployments', 'configmaps'], verbs: ['get', 'list', 'watch'] }] },
  { name: 'developer', kind: 'Role', namespace: 'team-a', rules: [{ apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list', 'watch', 'create', 'update', 'patch'] }, { apiGroups: [''], resources: ['pods', 'pods/log', 'services', 'configmaps'], verbs: ['get', 'list', 'watch'] }, { apiGroups: [''], resources: ['pods'], verbs: ['delete'] }] },
  { name: 'sre', kind: 'ClusterRole', rules: [{ apiGroups: ['', 'apps'], resources: ['*'], verbs: ['get', 'list', 'watch', 'patch', 'delete'] }, { apiGroups: [''], resources: ['nodes'], verbs: ['get', 'list', 'patch'] }] },
  { name: 'ci-deployer', kind: 'Role', namespace: 'team-a', rules: [{ apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'patch'] }] },
  { name: 'cluster-admin', kind: 'ClusterRole', rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }] },
];
const VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'];
const RES: [string, string][] = [['pods', ''], ['pods/log', ''], ['services', ''], ['configmaps', ''], ['secrets', ''], ['nodes', ''], ['deployments', 'apps']];
const NS = ['team-a', 'team-b', 'kube-system'];

export default function RbacPlayground() {
  const [role, setRole] = useState('developer');
  const [verb, setVerb] = useState('delete');
  const [res, setRes] = useState('pods');
  const [ns, setNs] = useState('team-a');
  const r = ROLES.find((x) => x.name === role)!;
  const group = RES.find((x) => x[0] === res)![1];
  const scoped = r.kind === 'ClusterRole' || r.namespace === ns || res === 'nodes';
  const nsOk = r.kind === 'ClusterRole' || (r.namespace === ns && res !== 'nodes');
  const match = scoped && nsOk ? r.rules.findIndex((rule) => (rule.apiGroups.includes('*') || rule.apiGroups.includes(group)) && (rule.resources.includes('*') || rule.resources.includes(res)) && (rule.verbs.includes('*') || rule.verbs.includes(verb))) : -1;
  const allowed = match >= 0;
  const reason = allowed
    ? `rule[${match}] of ${r.kind}/${r.name} matches apiGroup "${group || 'core'}", resource "${res}", verb "${verb}"`
    : !nsOk
      ? res === 'nodes' && r.kind === 'Role' ? 'nodes are cluster-scoped; a namespaced Role can never grant them' : `Role ${r.name} is bound only in namespace ${r.namespace}`
      : 'no rule matches; RBAC is deny-by-default with no explicit deny';
  const yaml = ROLES.map((x) => `apiVersion: rbac.authorization.k8s.io/v1
kind: ${x.kind}
metadata:
  name: ${x.name}${x.namespace ? `\n  namespace: ${x.namespace}` : ''}
rules:
${x.rules.map((ru) => `  - apiGroups: [${ru.apiGroups.map((g) => `"${g}"`).join(', ')}]\n    resources: [${ru.resources.map((g) => `"${g}"`).join(', ')}]\n    verbs: [${ru.verbs.map((g) => `"${g}"`).join(', ')}]`).join('\n')}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ${x.kind === 'Role' ? 'RoleBinding' : 'ClusterRoleBinding'}
metadata:
  name: ${x.name}-binding${x.namespace ? `\n  namespace: ${x.namespace}` : ''}
subjects: [{ kind: Group, name: ${x.name}s, apiGroup: rbac.authorization.k8s.io }]
roleRef: { kind: ${x.kind}, name: ${x.name}, apiGroup: rbac.authorization.k8s.io }`).join('\n---\n');
  const sel = (label: string, v: string, set: (s: string) => void, opts: string[], id: string) => (
    <Field label={label}><select className="lab-input" value={v} onChange={(e) => set(e.target.value)} data-testid={`select-${id}`}>{opts.map((o) => <option key={o}>{o}</option>)}</select></Field>
  );
  return (
    <LabFrame mode="tool" onReset={() => { setRole('developer'); setVerb('delete'); setRes('pods'); setNs('team-a'); }} files={[{ name: 'rbac.yaml', content: yaml }, { name: 'can-i.sh', content: `kubectl auth can-i ${verb} ${res} -n ${ns} --as-group=${role}s --as=probe-user\n# expected: ${allowed ? 'yes' : 'no'}\n` }]}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel title="Request">
          <div className="space-y-3">
            {sel('Subject role', role, setRole, ROLES.map((x) => x.name), 'role')}
            {sel('Verb', verb, setVerb, VERBS, 'verb')}
            {sel('Resource', res, setRes, RES.map((x) => x[0]), 'resource')}
            {sel('Namespace', ns, setNs, NS, 'namespace')}
          </div>
        </Panel>
        <div className="space-y-4">
          <div key={`${role}${verb}${res}${ns}`} className={`rise border-2 p-5 ${allowed ? 'border-accent bg-accent/10' : 'border-destructive bg-destructive/10'}`} data-testid="text-decision">
            <div className="font-mono text-xs">kubectl auth can-i {verb} {res} -n {ns} --as-group={role}s</div>
            <div className={`font-display text-5xl font-extrabold tracking-tight ${allowed ? 'text-accent' : 'text-destructive'}`}>{allowed ? 'ALLOW' : 'DENY'}</div>
            <p className="mt-1 text-sm">{reason}</p>
          </div>
          <Panel title={`${r.kind} / ${r.name}${r.namespace ? ` (ns ${r.namespace})` : ''}`}>
            <div className="space-y-1 font-mono text-xs">
              {r.rules.map((ru, i) => (
                <div key={i} className={`border px-2 py-1.5 ${i === match ? 'border-accent bg-accent/10' : 'border-border'}`}>
                  [{i}] groups={ru.apiGroups.map((g) => g || 'core').join(',')} resources={ru.resources.join(',')} verbs={ru.verbs.join(',')}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </LabFrame>
  );
}
