import { useState } from 'react';
import { LabFrame, Panel, Pill, Stat } from '@/components/lab-kit';

type Sev = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type F = { id: string; sev: Sev; pkg: string; installed: string; fixed: string | null; title: string; fix: string };
const FINDINGS: F[] = [
  { id: 'FIX-0101', sev: 'CRITICAL', pkg: 'openssl', installed: '1.1.1n', fixed: '3.0.13', title: 'Outdated TLS library in base image', fix: 'Rebase from node:16-buster to node:20-bookworm-slim; OpenSSL 3 ships with the new base.' },
  { id: 'FIX-0114', sev: 'HIGH', pkg: 'glibc', installed: '2.28', fixed: '2.36', title: 'Base OS C library behind security updates', fix: 'Same rebase; bookworm-slim includes the patched glibc.' },
  { id: 'FIX-0122', sev: 'HIGH', pkg: 'config', installed: 'USER root', fixed: 'USER node', title: 'Container runs as root', fix: 'Add USER node (UID 1000) after copying files with --chown.' },
  { id: 'FIX-0137', sev: 'HIGH', pkg: 'lodash', installed: '4.17.15', fixed: '4.17.21', title: 'Application dependency with known prototype pollution class', fix: 'npm install lodash@4.17.21 and commit the lockfile.' },
  { id: 'FIX-0150', sev: 'MEDIUM', pkg: 'secret', installed: '.npmrc layer', fixed: null, title: 'Registry token present in an image layer', fix: 'Use RUN --mount=type=secret,id=npmrc; rotate the exposed token.' },
  { id: 'FIX-0163', sev: 'MEDIUM', pkg: 'curl', installed: '7.64.0', fixed: '7.88.1', title: 'Unneeded network tool in runtime image', fix: 'Remove curl from the runtime stage; use a multi-stage build.' },
  { id: 'FIX-0178', sev: 'LOW', pkg: 'config', installed: 'no HEALTHCHECK', fixed: 'HEALTHCHECK', title: 'No healthcheck defined', fix: 'Add HEALTHCHECK or rely on Kubernetes probes.' },
  { id: 'FIX-0189', sev: 'LOW', pkg: 'tar', installed: '1.30', fixed: null, title: 'Low-severity issue, no fix published', fix: 'Accept risk with expiry date in .trivyignore-style allowlist.' },
];
const SEVS: Sev[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const W: Record<Sev, number> = { CRITICAL: 10, HIGH: 6, MEDIUM: 3, LOW: 1 };

export default function ContainerSecurity() {
  const [filter, setFilter] = useState<Sev[]>(SEVS);
  const [done, setDone] = useState<string[]>([]);
  const [hideFixed, setHideFixed] = useState(false);
  const [sel, setSel] = useState('FIX-0101');
  const list = FINDINGS.filter((f) => filter.includes(f.sev) && !(hideFixed && done.includes(f.id)));
  const open = FINDINGS.filter((f) => !done.includes(f.id));
  const risk = open.reduce((a, f) => a + W[f.sev], 0);
  const blocking = open.filter((f) => (f.sev === 'CRITICAL' || f.sev === 'HIGH') && f.fixed);
  const cur = FINDINGS.find((f) => f.id === sel)!;
  const sevTone = (s: Sev) => (s === 'CRITICAL' || s === 'HIGH' ? 'bad' : s === 'MEDIUM' ? 'warn' : 'info');
  const docker = `# syntax=docker/dockerfile:1.6
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s CMD node dist/healthcheck.js
CMD ["node", "dist/server.js"]
`;
  return (
    <LabFrame mode="simulation" onReset={() => { setFilter(SEVS); setDone([]); setHideFixed(false); setSel('FIX-0101'); }} files={[{ name: 'Dockerfile.hardened', content: docker }, { name: 'findings.json', content: JSON.stringify(FINDINGS.map((f) => ({ ...f, status: done.includes(f.id) ? 'remediated' : 'open' })), null, 2) }]}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SEVS.map((s) => (
          <label key={s} className="flex items-center gap-1.5 border border-border bg-card px-2 py-1 font-mono text-[11px]">
            <input type="checkbox" checked={filter.includes(s)} onChange={() => setFilter(filter.includes(s) ? filter.filter((x) => x !== s) : [...filter, s])} data-testid={`checkbox-sev-${s}`} />{s} ({FINDINGS.filter((f) => f.sev === s).length})
          </label>
        ))}
        <label className="flex items-center gap-1.5 font-mono text-[11px]"><input type="checkbox" checked={hideFixed} onChange={(e) => setHideFixed(e.target.checked)} data-testid="checkbox-hide-fixed" /> hide remediated</label>
        <Pill tone="warn" className="ml-auto">fixture report - no scan performed</Pill>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Open" value={open.length} />
        <Stat label="Risk score" value={risk} tone={risk > 20 ? 'bad' : risk > 5 ? 'warn' : 'ok'} />
        <Stat label="CI gate" value={blocking.length ? 'BLOCK' : 'PASS'} tone={blocking.length ? 'bad' : 'ok'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={`Findings (${list.length})`}>
          <div className="divide-y divide-border">
            {list.map((f) => (
              <button key={f.id} onClick={() => setSel(f.id)} data-testid={`row-finding-${f.id}`} className={`flex w-full items-center gap-3 px-2 py-2 text-left transition-colors ${sel === f.id ? 'bg-muted' : 'hover:bg-muted/50'} ${done.includes(f.id) ? 'opacity-50' : ''}`}>
                <Pill tone={sevTone(f.sev)} className="w-[76px] justify-center">{f.sev}</Pill>
                <span className="font-mono text-[11px] text-muted-foreground">{f.id}</span>
                <span className={`flex-1 text-sm ${done.includes(f.id) ? 'line-through' : ''}`}>{f.title}</span>
              </button>
            ))}
            {!list.length && <p className="py-6 text-center text-sm text-muted-foreground">No findings match the filter.</p>}
          </div>
        </Panel>
        <Panel title={cur.id}>
          <h5 className="font-display text-lg font-semibold">{cur.title}</h5>
          <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
            <div><dt className="lab-label">package</dt><dd>{cur.pkg}</dd></div>
            <div><dt className="lab-label">installed</dt><dd>{cur.installed}</dd></div>
            <div><dt className="lab-label">fixed in</dt><dd>{cur.fixed ?? 'no fix available'}</dd></div>
            <div><dt className="lab-label">severity</dt><dd>{cur.sev}</dd></div>
          </dl>
          <p className="mt-3 border-l-2 border-primary pl-3 text-sm">{cur.fix}</p>
          <button className={`btn mt-4 ${done.includes(cur.id) ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setDone(done.includes(cur.id) ? done.filter((x) => x !== cur.id) : [...done, cur.id])} data-testid="button-toggle-remediated">
            {done.includes(cur.id) ? 'Reopen finding' : 'Mark remediated'}
          </button>
        </Panel>
      </div>
    </LabFrame>
  );
}
