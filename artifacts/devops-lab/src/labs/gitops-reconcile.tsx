import { useEffect, useRef, useState } from 'react';
import { LabFrame, Panel, Field, Pill, Terminal, Btn } from '@/components/lab-kit';

type Spec = { replicas: number; tag: string; logLevel: string };
const INIT: Spec = { replicas: 3, tag: 'v1.4.0', logLevel: 'info' };
const KEYS: (keyof Spec)[] = ['replicas', 'tag', 'logLevel'];

export default function GitopsReconcile() {
  const [git, setGit] = useState<Spec>(INIT);
  const [live, setLive] = useState<Spec>({ ...INIT, replicas: 5 });
  const [selfHeal, setSelfHeal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hist, setHist] = useState<string[]>(['controller started; initial compare']);
  const t = useRef<number | undefined>(undefined);
  const diff = KEYS.filter((k) => git[k] !== live[k]);
  const sync = (why: string) => {
    if (syncing) return;
    setSyncing(true);
    t.current = window.setTimeout(() => {
      setLive(git);
      setHist((h) => [...h, `sync (${why}): ${diff.map((k) => `${k} ${live[k]} -> ${git[k]}`).join(', ') || 'no-op'}`]);
      setSyncing(false);
    }, 900);
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => { if (selfHeal && diff.length && !syncing) syncRef.current('self-heal'); }, [selfHeal, diff.length, syncing]);
  useEffect(() => () => clearTimeout(t.current), []);
  const editor = (side: 'git' | 'live') => {
    const v = side === 'git' ? git : live;
    const set = side === 'git' ? setGit : setLive;
    return (
      <div className="space-y-3">
        <Field label="replicas"><input type="number" min={0} className="lab-input" value={v.replicas} onChange={(e) => set({ ...v, replicas: +e.target.value })} data-testid={`input-${side}-replicas`} /></Field>
        <Field label="image tag"><input className="lab-input" value={v.tag} onChange={(e) => set({ ...v, tag: e.target.value })} data-testid={`input-${side}-tag`} /></Field>
        <Field label="LOG_LEVEL"><select className="lab-input" value={v.logLevel} onChange={(e) => set({ ...v, logLevel: e.target.value })} data-testid={`select-${side}-log`}>{['debug', 'info', 'warn', 'error'].map((x) => <option key={x}>{x}</option>)}</select></Field>
      </div>
    );
  };
  const diffText = diff.length ? diff.map((k) => `- live.${k}: ${live[k]}\n+ git.${k}:  ${git[k]}`).join('\n') : '(no differences)';
  const app = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: storefront
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://git.example.internal/platform/storefront-deploy.git
    targetRevision: main
    path: overlays/production
    kustomize:
      images: [storefront=registry.internal/storefront:${git.tag}]
      replicas: [{ name: storefront, count: ${git.replicas} }]
  destination:
    server: https://kubernetes.default.svc
    namespace: storefront
  syncPolicy:
${selfHeal ? '    automated:\n      prune: true\n      selfHeal: true\n' : '    # manual sync\n'}    syncOptions: [CreateNamespace=true]
`;
  return (
    <LabFrame mode="simulation" onReset={() => { setGit(INIT); setLive({ ...INIT, replicas: 5 }); setSelfHeal(false); setHist(['controller started; initial compare']); }} files={[{ name: 'application.yaml', content: app }, { name: 'drift.diff', content: diffText }]}>
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Panel title="Git (desired)">{editor('git')}</Panel>
        <div className="flex flex-col items-center justify-center gap-3 py-2">
          <div className={`font-mono text-xs ${syncing ? 'text-primary blink' : ''}`}>{syncing ? 'SYNCING' : '<- compare ->'}</div>
          {diff.length ? <Pill tone="warn">OutOfSync ({diff.length})</Pill> : <Pill tone="ok">Synced</Pill>}
          <Btn onClick={() => sync('manual')} disabled={!diff.length || syncing} data-testid="button-sync">Sync</Btn>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selfHeal} onChange={(e) => setSelfHeal(e.target.checked)} data-testid="checkbox-selfheal" /> self-heal</label>
        </div>
        <Panel title="Cluster (live)">{editor('live')}</Panel>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Diff"><Terminal lines={diffText.split('\n')} /></Panel>
        <Panel title="Controller events"><Terminal lines={hist} /></Panel>
      </div>
    </LabFrame>
  );
}
