import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { LabFrame, Panel, Field, Pill, Btn } from '@/components/lab-kit';

type Svc = { id: string; name: string; owner: string; tier: string; lifecycle: string; description: string; deps: string };
const KEY = 'devops-lab:catalog:v1';
const SEED: Svc[] = [
  { id: 's1', name: 'orders-api', owner: 'team-fulfilment', tier: 'tier-1', lifecycle: 'production', description: 'Order intake and state machine', deps: 'orders-db, payments-api' },
  { id: 's2', name: 'payments-api', owner: 'team-payments', tier: 'tier-1', lifecycle: 'production', description: 'Card authorisation facade', deps: '' },
  { id: 's3', name: 'recs-worker', owner: 'team-discovery', tier: 'tier-3', lifecycle: 'experimental', description: 'Batch recommendation scorer', deps: 'orders-api' },
];
const EMPTY: Omit<Svc, 'id'> = { name: '', owner: '', tier: 'tier-2', lifecycle: 'production', description: '', deps: '' };
const load = (): Svc[] => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : SEED; } catch { return SEED; } };

export default function DeveloperPortal() {
  const [items, setItems] = useState<Svc[]>(load);
  const [sel, setSel] = useState<string | null>(items[0]?.id ?? null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);
  const err = !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(form.name) ? 'name: lowercase letters, digits, hyphens' : !form.owner ? 'owner is required' : items.some((i) => i.name === form.name && i.id !== editing) ? 'name already exists' : '';
  const save = () => {
    if (err) return;
    if (editing) setItems(items.map((i) => (i.id === editing ? { ...form, id: editing } : i)));
    else { const id = 's' + Date.now(); setItems([...items, { ...form, id }]); setSel(id); }
    setForm(EMPTY); setEditing(null);
  };
  const cur = items.find((i) => i.id === sel);
  const manifest = cur ? `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${cur.name}
  description: ${JSON.stringify(cur.description || cur.name)}
  tags: [${cur.tier}]
  annotations:
    backstage.io/techdocs-ref: dir:.
spec:
  type: service
  lifecycle: ${cur.lifecycle}
  owner: group:${cur.owner}
${cur.deps.trim() ? `  dependsOn:\n${cur.deps.split(',').map((d) => d.trim()).filter(Boolean).map((d) => `    - component:${d}`).join('\n')}\n` : ''}` : '# select or create a service';
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <LabFrame mode="tool" onReset={() => { setItems(SEED); setSel('s1'); setForm(EMPTY); setEditing(null); setConfirm(null); }} files={[{ name: 'catalog-info.yaml', content: manifest }, { name: 'catalog-export.json', content: JSON.stringify(items, null, 2) }]}>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel title={`Catalog (${items.length})`} aside={<Pill>saved in this browser</Pill>}>
          {items.length === 0 && <div className="border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Catalog is empty. Register your first service on the right.</div>}
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} onClick={() => setSel(i.id)} data-testid={`card-service-${i.id}`} className={`cursor-pointer border p-3 transition-colors ${sel === i.id ? 'border-foreground bg-card' : 'border-border hover:border-foreground/50'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{i.name}</span>
                  <Pill tone={i.tier === 'tier-1' ? 'bad' : i.tier === 'tier-2' ? 'warn' : 'info'}>{i.tier}</Pill>
                  <Pill tone={i.lifecycle === 'production' ? 'ok' : 'info'}>{i.lifecycle}</Pill>
                  <div className="ml-auto flex gap-1">
                    <button className="p-1 hover:text-primary" onClick={(e) => { e.stopPropagation(); setEditing(i.id); setForm({ name: i.name, owner: i.owner, tier: i.tier, lifecycle: i.lifecycle, description: i.description, deps: i.deps }); }} data-testid={`button-edit-${i.id}`} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    {confirm === i.id ? (
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        delete?
                        <button className="text-destructive underline" onClick={(e) => { e.stopPropagation(); setItems(items.filter((x) => x.id !== i.id)); setConfirm(null); if (sel === i.id) setSel(null); }} data-testid={`button-confirm-delete-${i.id}`}>yes</button>
                        <button className="underline" onClick={(e) => { e.stopPropagation(); setConfirm(null); }} data-testid={`button-cancel-delete-${i.id}`}>no</button>
                      </span>
                    ) : (
                      <button className="p-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setConfirm(i.id); }} data-testid={`button-delete-${i.id}`} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{i.owner} - {i.description}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={editing ? 'Edit service' : 'Register service'}>
          <div className="space-y-3">
            <Field label="Name"><input className="lab-input" value={form.name} onChange={set('name')} placeholder="inventory-api" data-testid="input-svc-name" /></Field>
            <Field label="Owner group"><input className="lab-input" value={form.owner} onChange={set('owner')} placeholder="team-inventory" data-testid="input-svc-owner" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tier"><select className="lab-input" value={form.tier} onChange={set('tier')} data-testid="select-svc-tier">{['tier-1', 'tier-2', 'tier-3'].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Lifecycle"><select className="lab-input" value={form.lifecycle} onChange={set('lifecycle')} data-testid="select-svc-lifecycle">{['experimental', 'production', 'deprecated'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            </div>
            <Field label="Description"><input className="lab-input" value={form.description} onChange={set('description')} data-testid="input-svc-description" /></Field>
            <Field label="Depends on (comma separated)"><input className="lab-input" value={form.deps} onChange={set('deps')} data-testid="input-svc-deps" /></Field>
            {form.name && err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex gap-2">
              <Btn onClick={save} disabled={!!err} data-testid="button-save-service"><Plus className="h-3.5 w-3.5" />{editing ? 'Save changes' : 'Add service'}</Btn>
              {editing && <Btn variant="ghost" onClick={() => { setEditing(null); setForm(EMPTY); }} data-testid="button-cancel-edit">Cancel</Btn>}
            </div>
          </div>
        </Panel>
      </div>
    </LabFrame>
  );
}
