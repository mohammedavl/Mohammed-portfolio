import { useState } from 'react';
import { LabFrame, Panel, Field, Pill, Terminal, Btn } from '@/components/lab-kit';

const SIZES = ['t3.micro', 't3.small', 't3.medium', 't3.large', 'm6i.large'];
const D = { dReplicas: 3, dSize: 't3.medium', aReplicas: 5, aSize: 't3.large', strategy: 'revert' as 'revert' | 'adopt' };

export default function TerraformDrift() {
  const [s, setS] = useState(D);
  const [applied, setApplied] = useState(false);
  const set = (p: Partial<typeof D>) => { setS({ ...s, ...p }); setApplied(false); };
  const revert = s.strategy === 'revert';
  const lines: string[] = ['$ terraform plan -refresh=true', 'aws_instance.web: Refreshing state...', ''];
  let add = 0, change = 0, destroy = 0;
  const finalCount = revert ? s.dReplicas : s.aReplicas;
  const targetSize = revert ? s.dSize : s.aSize;
  if (revert) {
    const keep = Math.min(s.dReplicas, s.aReplicas);
    for (let i = 0; i < keep; i++) {
      if (s.aSize !== s.dSize) {
        lines.push(`  # aws_instance.web[${i}] will be updated in-place`, `  ~ resource "aws_instance" "web" {`, `      ~ instance_type = "${s.aSize}" -> "${s.dSize}"`, '    }', '');
        change++;
      }
    }
    for (let i = s.aReplicas; i < s.dReplicas; i++) { lines.push(`  # aws_instance.web[${i}] will be created`, `  + resource "aws_instance" "web" {`, `      + instance_type = "${s.dSize}"`, '    }', ''); add++; }
    for (let i = s.dReplicas; i < s.aReplicas; i++) { lines.push(`  # aws_instance.web[${i}] will be destroyed`, `  - resource "aws_instance" "web" {`, `      - instance_type = "${s.aSize}" -> null`, '    }', ''); destroy++; }
  } else {
    lines.push('  # Strategy: adopt drift. Code updated to match reality:', `  #   var.replicas      ${s.dReplicas} -> ${s.aReplicas}`, `  #   var.instance_type "${s.dSize}" -> "${s.aSize}"`, '');
  }
  const drifted = s.aReplicas !== s.dReplicas || s.aSize !== s.dSize;
  lines.push(add + change + destroy === 0 ? 'No changes. Your infrastructure matches the configuration.' : `Plan: ${add} to add, ${change} to change, ${destroy} to destroy.`);
  if (applied) lines.push('', '$ terraform apply -auto-approve', `Apply complete! Resources: ${add} added, ${change} changed, ${destroy} destroyed.`);

  const tf = `variable "replicas" {
  type    = number
  default = ${revert ? s.dReplicas : s.aReplicas}
}

variable "instance_type" {
  type    = string
  default = "${targetSize}"
}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_instance" "web" {
  count         = var.replicas
  ami           = data.aws_ssm_parameter.al2023.value
  instance_type = var.instance_type

  tags = {
    Name      = "web-\${count.index}"
    ManagedBy = "terraform"
  }
}
`;
  const report = `DRIFT REPORT (simulated)
desired.replicas      = ${s.dReplicas}
actual.replicas       = ${s.aReplicas}
desired.instance_type = ${s.dSize}
actual.instance_type  = ${s.aSize}
drift detected        = ${drifted}
strategy              = ${s.strategy}
result                = ${finalCount} x ${targetSize}

${lines.join('\n')}
`;
  return (
    <LabFrame mode="simulation" onReset={() => { setS(D); setApplied(false); }} files={[{ name: 'main.tf', content: tf }, { name: 'drift-report.txt', content: report }]}>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Desired (main.tf)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Replicas"><input type="number" min={0} max={10} className="lab-input" value={s.dReplicas} onChange={(e) => set({ dReplicas: Math.max(0, Math.min(10, +e.target.value)) })} data-testid="input-desired-replicas" /></Field>
            <Field label="Instance size"><select className="lab-input" value={s.dSize} onChange={(e) => set({ dSize: e.target.value })} data-testid="select-desired-size">{SIZES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
        </Panel>
        <Panel title="Actual (refreshed)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Replicas"><input type="number" min={0} max={10} className="lab-input" value={s.aReplicas} onChange={(e) => set({ aReplicas: Math.max(0, Math.min(10, +e.target.value)) })} data-testid="input-actual-replicas" /></Field>
            <Field label="Instance size"><select className="lab-input" value={s.aSize} onChange={(e) => set({ aSize: e.target.value })} data-testid="select-actual-size">{SIZES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
        </Panel>
      </div>
      <Panel title="Plan" className="mt-4" aside={drifted ? <Pill tone="warn">drift detected</Pill> : <Pill tone="ok">in sync</Pill>}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(['revert', 'adopt'] as const).map((k) => (
            <Btn key={k} variant={s.strategy === k ? 'ink' : 'ghost'} onClick={() => set({ strategy: k })} data-testid={`button-strategy-${k}`}>{k === 'revert' ? 'Revert drift (apply code)' : 'Adopt drift (update code)'}</Btn>
          ))}
          <Btn className="ml-auto" onClick={() => setApplied(true)} disabled={applied} data-testid="button-apply">Apply</Btn>
        </div>
        <Terminal lines={lines} />
        {applied && <p className="mt-2 font-mono text-xs text-accent" data-testid="text-apply-result">State converged: {finalCount} x {targetSize}. {revert && s.aSize !== s.dSize ? `Note: ${change} instance(s) stopped and started during resize.` : ''}</p>}
      </Panel>
    </LabFrame>
  );
}
