import { useState } from 'react';
import { LabFrame, Panel, Field, Stat, Pill } from '@/components/lab-kit';

const D = { rpo: 60, rto: 120, interval: 60, age: 47, detect: 12, decide: 15, restore: 70, validate: 18 };

export default function DrDrill() {
  const [s, setS] = useState(D);
  const downtime = s.detect + s.decide + s.restore + s.validate;
  const rpoOk = s.age <= s.rpo;
  const rtoOk = downtime <= s.rto;
  const worst = s.interval;
  const num = (k: keyof typeof D, label: string) => (
    <Field label={label}><input type="number" min={0} className="lab-input" value={s[k]} onChange={(e) => setS({ ...s, [k]: Math.max(0, +e.target.value) })} data-testid={`input-${k}`} /></Field>
  );
  const total = s.age + downtime || 1;
  const segs: [string, number, string][] = [['data loss', s.age, 'bg-destructive/70'], ['detect', s.detect, 'bg-[hsl(42_85%_48%)]'], ['decide', s.decide, 'bg-[hsl(32_80%_45%)]'], ['restore', s.restore, 'bg-primary'], ['validate', s.validate, 'bg-accent']];
  const runbook = `# DR Drill Runbook - orders-db (PostgreSQL)

Objectives: RPO ${s.rpo} min, RTO ${s.rto} min
Backup interval: ${s.interval} min (worst-case data loss ${worst} min -> ${worst <= s.rpo ? 'meets' : 'VIOLATES'} RPO)

## Drill result
- Backup age at failure: ${s.age} min -> RPO ${rpoOk ? 'PASS' : 'FAIL'}
- Downtime: ${downtime} min (detect ${s.detect} + decide ${s.decide} + restore ${s.restore} + validate ${s.validate}) -> RTO ${rtoOk ? 'PASS' : 'FAIL'}

## Procedure
1. Declare incident, assign incident commander. Freeze writes at the app tier.
2. Identify newest restorable backup:
   aws rds describe-db-snapshots --db-instance-identifier orders-db --query 'reverse(sort_by(DBSnapshots,&SnapshotCreateTime))[0]'
3. Restore to a new instance (never overwrite the failed one; keep it for forensics):
   aws rds restore-db-instance-from-db-snapshot --db-instance-identifier orders-db-restore --db-snapshot-identifier <id>
4. Validate: row counts on orders/payments vs last known checkpoint, run smoke tests.
5. Repoint the application secret/DNS to the restored endpoint. Unfreeze writes.
6. Record actual timings and update this runbook.

## Improvements
${!rpoOk || worst > s.rpo ? '- Shorten backup interval or enable continuous WAL archiving / point-in-time recovery.\n' : ''}${!rtoOk ? '- Pre-provision a warm standby or automate restore; detection and decision time dominate more often than expected.\n' : ''}${rpoOk && rtoOk && worst <= s.rpo ? '- Objectives met. Re-run quarterly and with a different operator.\n' : ''}`;
  return (
    <LabFrame mode="tool" onReset={() => setS(D)} files={[{ name: 'dr-runbook.md', content: runbook }]}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
        <Panel title="Objectives and backups"><div className="space-y-3">{num('rpo', 'RPO (min)')}{num('rto', 'RTO (min)')}{num('interval', 'Backup interval (min)')}{num('age', 'Backup age at failure (min)')}</div></Panel>
        <Panel title="Recovery timings"><div className="space-y-3">{num('detect', 'Detection (min)')}{num('decide', 'Decision (min)')}{num('restore', 'Restore duration (min)')}{num('validate', 'Validation (min)')}</div></Panel>
        <Panel title="Verdict" aside={rpoOk && rtoOk ? <Pill tone="ok">drill passed</Pill> : <Pill tone="bad">drill failed</Pill>}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={`Data loss vs RPO ${s.rpo}`} value={`${s.age}m ${rpoOk ? 'PASS' : 'FAIL'}`} tone={rpoOk ? 'ok' : 'bad'} />
            <Stat label={`Downtime vs RTO ${s.rto}`} value={`${downtime}m ${rtoOk ? 'PASS' : 'FAIL'}`} tone={rtoOk ? 'ok' : 'bad'} />
          </div>
          {worst > s.rpo && <p className="mt-3 text-xs text-destructive">Worst case: interval {worst}m exceeds RPO even if this drill passed.</p>}
          <div className="mt-5 flex h-9 overflow-hidden border border-foreground">
            {segs.map(([l, v, c]) => <div key={l} className={`${c} transition-all duration-500`} style={{ width: `${(v / total) * 100}%` }} title={`${l} ${v}m`} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
            {segs.map(([l, v, c]) => <span key={l} className="flex items-center gap-1"><span className={`h-2 w-2 ${c}`} />{l} {v}m</span>)}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">failure occurs after the red segment</div>
        </Panel>
      </div>
    </LabFrame>
  );
}
