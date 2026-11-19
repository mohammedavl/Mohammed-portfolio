import { Link } from 'wouter';
import { usePageMeta } from '@/lib/lab-store';
import { LABS, ALL_TECH } from '@/labs/registry';

const SKILLS: [string, string][] = [
  ['Infrastructure as code', 'CloudFormation generation with deterministic CIDR allocation; Terraform plan semantics for count and in-place updates.'],
  ['Kubernetes operations', 'Evidence-first debugging of pod states, OpenShift security contexts and Routes, RBAC evaluation identical to auth can-i.'],
  ['Delivery', 'Pipeline gating and retry semantics, GitOps reconciliation with self-heal, metric-gated canary progression.'],
  ['Reliability', 'Golden-signal correlation, burn-rate alerting, error budget policy, RPO/RTO drill arithmetic.'],
  ['Security and cost', 'Vulnerability triage and CI gates, image hardening, unit-rate cost modelling.'],
  ['Platform engineering', 'Service catalog ownership metadata and Backstage manifests, transparent rule-based triage.'],
];

export default function About() {
  usePageMeta('About - DevOps Engineering Lab', 'Scope, skills demonstrated and honest limitations of the DevOps Engineering Lab portfolio.');
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-8 md:py-20">
      <p className="lab-label rise">About this lab</p>
      <h1 className="rise mt-3 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] md:text-6xl">Claims are cheap.<br /><span className="text-primary">Inputs and outputs aren't.</span></h1>
      <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
        This portfolio exists so a technical interviewer can test reasoning instead of reading adjectives. Each of the {LABS.length} labs takes real input, computes a result with visible logic, and produces a file you can take away and inspect.
      </p>

      <section className="mt-14">
        <h2 className="lab-label mb-4">Skills each lab exercises</h2>
        <div className="divide-y divide-border border-y border-foreground/80">
          {SKILLS.map(([k, v]) => (
            <div key={k} className="grid gap-2 py-4 md:grid-cols-[240px_1fr]"><span className="font-display text-lg font-semibold">{k}</span><span className="text-muted-foreground">{v}</span></div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">{ALL_TECH.map((t) => <span key={t} className="border border-border bg-card px-2 py-0.5 font-mono text-[11px]">{t}</span>)}</div>
      </section>

      <section className="mt-14 grid gap-6 md:grid-cols-2">
        <div className="border border-foreground bg-card p-6 shadow-[4px_4px_0_hsl(var(--accent))]">
          <h2 className="font-display text-2xl font-bold">What is real</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>- Calculators (SLO, cost, DR) compute exact results from your inputs.</li>
            <li>- Generators (CloudFormation, OpenShift, RBAC, Backstage) emit valid, downloadable configuration.</li>
            <li>- The RBAC evaluator and log triage rules are working logic you can read in the downloads.</li>
            <li>- The developer portal stores entries in your browser's localStorage.</li>
          </ul>
        </div>
        <div className="border border-foreground bg-card p-6 shadow-[4px_4px_0_hsl(var(--destructive))]">
          <h2 className="font-display text-2xl font-bold">What is simulated</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>- No AWS, Kubernetes, OpenShift or CI system is contacted. Nothing is deployed.</li>
            <li>- Cluster output, telemetry and vulnerability findings are labelled fixtures.</li>
            <li>- Incident triage is regular-expression rules, not AI.</li>
            <li>- Cost rates are illustrative, not published provider prices.</li>
          </ul>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="lab-label mb-4">How it is built</h2>
        <p className="max-w-3xl text-[15px] leading-relaxed">
          React and TypeScript, one module per lab under <code className="font-mono text-sm">src/labs/</code>, metadata in a single registry. No backend, no network requests, no analytics. Bookmarks and completion state live in localStorage and never leave the device. The work history here is the code itself: no invented employers, certifications or metrics.
        </p>
        <Link href="/" className="btn btn-primary mt-8" data-testid="link-start-labs">Open the labs</Link>
      </section>
    </div>
  );
}
