// Pure game engine for "Incident Commander". No React, no DOM, no path aliases:
// safe to import from Node for unit checks (e.g. via tsx or after transpiling).

export type Quality = 'best' | 'partial' | 'harmful';

export type Choice = {
  id: string;
  label: string;
  quality: Quality;
  consequence: string;
};

export type Scenario = {
  id: string;
  code: string;
  title: string;
  service: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
  brief: string;
  signals: string[];
  hint: string;
  choices: Choice[];
  lesson: string;
  labs: string[]; // real portfolio lab slugs
};

export const LAB_SLUGS = [
  'aws-architecture-generator', 'terraform-drift-comparator', 'kubernetes-troubleshooting', 'openshift-deployment',
  'cicd-pipeline', 'gitops-reconciliation', 'canary-rollout', 'observability-incident', 'slo-error-budget',
  'cloud-cost-calculator', 'container-security-explorer', 'rbac-playground', 'disaster-recovery-drill',
  'developer-portal', 'incident-response-assistant',
] as const;

export const MAX_HEALTH = 100;
export const START_HEALTH = 100;
export const HINT_PENALTY = 25;
export const STREAK_BONUS = 10;
export const BASE_POINTS: Record<Quality, number> = { best: 100, partial: 40, harmful: 0 };
export const HEALTH_DELTA: Record<Quality, number> = { best: 5, partial: -15, harmful: -35 };
export const BEST_SCORE_KEY = 'devops-lab:incident-commander:best';

export const SCENARIOS: Scenario[] = [
  {
    id: 'crashloop', code: 'INC-0412', title: 'Checkout pods keep restarting', service: 'checkout-api', severity: 'SEV1',
    brief: 'Right after a config change, every checkout pod shows CrashLoopBackOff. Customers cannot pay.',
    signals: ['pods: 0/6 Ready, restarts climbing', 'status: CrashLoopBackOff', 'last change: new env var DB_URL'],
    hint: 'A pod in CrashLoopBackOff starts, crashes, and is restarted again. The crash reason was printed by the previous attempt, so read its logs before changing anything.',
    choices: [
      { id: 'logs', label: 'Read logs from the previous crashed container', quality: 'best', consequence: 'The logs show "invalid DB_URL scheme". You fix the typo, pods go Ready within a minute. Evidence first, one change.' },
      { id: 'scale', label: 'Scale replicas from 6 to 20', quality: 'harmful', consequence: 'Twenty pods now crash instead of six. Scaling multiplies a broken config; it never repairs it.' },
      { id: 'restart', label: 'Delete all pods to force a restart', quality: 'partial', consequence: 'New pods crash the same way. You lost a few minutes, but you also confirmed the fault is in the config, not a stuck node.' },
    ],
    lesson: 'Pod status is a symptom. describe, logs --previous and events reveal the cause; then change exactly one thing.',
    labs: ['kubernetes-troubleshooting', 'openshift-deployment'],
  },
  {
    id: 'pipeline', code: 'INC-0413', title: 'The release pipeline is red', service: 'release-pipeline', severity: 'SEV3',
    brief: 'A security fix must ship today, but the pipeline fails at the scan stage on a critical finding in the base image.',
    signals: ['lint ok, test ok, build ok', 'scan: 1 critical with fix available', 'deploy: skipped'],
    hint: 'The scanner blocks images with known, fixable vulnerabilities. The safe path removes the vulnerability instead of removing the check.',
    choices: [
      { id: 'skip', label: 'Disable the scan stage just for this release', quality: 'harmful', consequence: 'It ships, along with a known critical vulnerability. The gate existed for exactly this moment.' },
      { id: 'rebase', label: 'Rebase onto the patched base image and retry from build', quality: 'best', consequence: 'The rebuilt image scans clean, earlier stages are reused, deploy runs green. Fix the cause, keep the gate.' },
      { id: 'rerun', label: 'Re-run the whole pipeline in case it is flaky', quality: 'partial', consequence: 'Same failure. A scan finding is deterministic, not transient; retries only help with flaky classes like registry timeouts.' },
    ],
    lesson: 'Pipelines fail fast so broken artifacts never ship. Separate transient from deterministic failures and fix the latter at the source.',
    labs: ['cicd-pipeline', 'container-security-explorer'],
  },
  {
    id: 'canary', code: 'INC-0414', title: 'The new version is erroring at 10 percent', service: 'search-web', severity: 'SEV2',
    brief: 'A canary of v2.8 receives 10 percent of traffic. Its error rate is 4.1 percent against a 1 percent threshold. Half the monthly error budget is already spent.',
    signals: ['canary errors: 4.1%', 'stable errors: 0.3%', 'error budget remaining: 48.6%'],
    hint: 'A canary is a small test group of real users. If the test group is clearly unhappy, stop the experiment and send everyone back to the version that works.',
    choices: [
      { id: 'promote', label: 'Promote to 100 percent, the dashboards are probably noisy', quality: 'harmful', consequence: 'Every user now sees 4 percent errors. The budget burns at roughly 40x and is gone in under a day.' },
      { id: 'abort', label: 'Abort the rollout and return traffic to stable', quality: 'best', consequence: 'Errors drop to baseline in seconds. Only 10 percent of users were briefly affected, which is the whole point of a canary.' },
      { id: 'hold', label: 'Pause at 10 percent and keep watching', quality: 'partial', consequence: 'No more users are exposed, but one in ten keeps failing while you wait. The data was already conclusive.' },
    ],
    lesson: 'Progressive delivery limits blast radius. Gate on metrics and let the error budget decide how much risk you can still afford.',
    labs: ['canary-rollout', 'slo-error-budget'],
  },
  {
    id: 'gitops', code: 'INC-0415', title: 'Last night\'s hotfix vanished', service: 'payments-worker', severity: 'SEV2',
    brief: 'At 02:00 someone raised memory limits with a direct cluster edit. By 02:05 the change was gone and OOM errors were back. Separately, the database instance size in the cloud console no longer matches the Terraform code.',
    signals: ['controller: OutOfSync -> Synced (self-heal)', 'memory limit reverted to 256Mi', 'terraform plan: 1 to change'],
    hint: 'In GitOps the Git repository is the source of truth. Anything changed by hand in the live system gets put back to match Git, so lasting fixes must go through Git.',
    choices: [
      { id: 'commit', label: 'Commit the limit to Git and update Terraform configuration for the approved database size', quality: 'best', consequence: 'The controller syncs the new limit and keeps it. Review the Terraform plan after updating the configuration to retain the approved size. Import is for resources not already managed, not for accepting attribute drift.' },
      { id: 'disable', label: 'Turn off self-heal so manual edits stick', quality: 'harmful', consequence: 'The hotfix survives, but now nobody knows what is really running. Drift accumulates until a future sync surprises everyone.' },
      { id: 'reedit', label: 'Re-apply the manual edit every time it reverts', quality: 'partial', consequence: 'It works for five minutes at a time. You become the reconciliation loop, and you need sleep.' },
    ],
    lesson: 'Desired state lives in code. Reconcile drift by bringing code and reality back together, never by bypassing the controller.',
    labs: ['gitops-reconciliation', 'terraform-drift-comparator'],
  },
  {
    id: 'latency', code: 'INC-0416', title: 'Everything is slow, nobody knows why', service: 'api-gateway', severity: 'SEV2',
    brief: 'p99 latency jumped from 180ms to 2.4s. No deploy happened. Thousands of log lines per minute.',
    signals: ['latency p99: 2.4s', 'CPU saturation rose 6 min before latency', 'logs: repeating "connection pool exhausted"'],
    hint: 'Look at which signal changed first. When resource usage climbs before things get slow, the system is running out of something, and the logs usually name it.',
    choices: [
      { id: 'correlate', label: 'Correlate the golden signals with log patterns by timestamp', quality: 'best', consequence: 'Saturation led latency, and the pool-exhausted pattern started at the same minute. You raise the pool size and add a fix ticket for the slow query behind it.' },
      { id: 'rollback', label: 'Roll back the last deploy', quality: 'partial', consequence: 'The last deploy was three days ago. Nothing changes. Rolling back is good when errors line up with a deploy marker; here they do not.' },
      { id: 'mute', label: 'Silence the alert until morning', quality: 'harmful', consequence: 'The pager is quiet. Customers are not. Latency becomes timeouts by 04:00.' },
    ],
    lesson: 'Latency, traffic, errors and saturation tell you where; logs tell you why. Sequence and timestamps separate cause from effect.',
    labs: ['observability-incident', 'incident-response-assistant'],
  },
  {
    id: 'dr', code: 'INC-0417', title: 'The primary zone is gone', service: 'orders-db', severity: 'SEV1',
    brief: 'One availability zone failed and took the primary database with it. Objectives: lose at most 15 minutes of data (RPO), be back within 60 minutes (RTO).',
    signals: ['AZ-a: unreachable', 'last backup: 9 min ago, verified', 'standby replica in AZ-b: healthy'],
    hint: 'RPO is how much recent data you can afford to lose; RTO is how long you can be down. Pick the option that meets both, using copies that already exist elsewhere.',
    choices: [
      { id: 'wait', label: 'Wait for the zone to come back', quality: 'harmful', consequence: 'The provider estimates 3 hours. RTO is blown long before then.' },
      { id: 'failover', label: 'Fail over to the standby in the healthy zone, then verify', quality: 'best', consequence: 'Downtime is 11 minutes and data loss is near zero. Spreading across zones paid off.' },
      { id: 'restore', label: 'Restore last night\'s full backup into a new instance', quality: 'partial', consequence: 'It works, but a nightly backup loses up to 24 hours of orders and the restore takes 70 minutes. Both objectives missed when a better option existed.' },
    ],
    lesson: 'Architecture decides recovery. Multi-AZ designs and tested drills turn a disaster into a routine failover measured against RPO and RTO.',
    labs: ['disaster-recovery-drill', 'aws-architecture-generator'],
  },
  {
    id: 'rbac', code: 'INC-0418', title: 'A CI token deleted production secrets', service: 'cluster-access', severity: 'SEV1',
    brief: 'A build job meant to read config ran a cleanup script and deleted secrets in the production namespace. Its service account is bound to cluster-admin.',
    signals: ['subject: ci-runner (service account)', 'binding: cluster-admin', 'verb: delete secrets in prod'],
    hint: 'Least privilege means every account gets only the permissions its job needs. A build job that reads config should not be able to delete anything.',
    choices: [
      { id: 'scope', label: 'Restore secrets, then bind the token to a namespaced read-only role', quality: 'best', consequence: 'Service is restored and the same script now gets "forbidden". Kubernetes RBAC is deny-by-default once you stop granting everything.' },
      { id: 'rotate', label: 'Rotate the token but keep the same role', quality: 'partial', consequence: 'Good hygiene, wrong problem. The new token is just as powerful as the old one.' },
      { id: 'share', label: 'Give the CI job a human admin\'s credentials instead', quality: 'harmful', consequence: 'Now the blast radius is a person, with no audit trail separating automation from humans.' },
    ],
    lesson: 'Permissions are additive and should be scoped to namespace, resource and verb. Least privilege limits what any single mistake can destroy.',
    labs: ['rbac-playground', 'container-security-explorer'],
  },
  {
    id: 'cost', code: 'INC-0419', title: 'The cloud bill tripled', service: 'finance-alert', severity: 'SEV3',
    brief: 'The monthly forecast jumped from $4,180 to $12,740. Finance wants an answer before noon.',
    signals: ['staging: 18 large instances running 24x7', 'egress up 6.3x', 'prod usage: flat'],
    hint: 'Cost is usage multiplied by price. Find what is running more than it needs to, such as test environments that run all night when nobody uses them.',
    choices: [
      { id: 'schedule', label: 'Schedule staging to business hours and right-size it', quality: 'best', consequence: 'About 217 instead of 730 hours a month cuts staging compute by roughly 70 percent. Production is untouched.' },
      { id: 'prod', label: 'Downsize production instances across the board', quality: 'harmful', consequence: 'Production was not the problem. Latency spikes at the next peak and the saving is tiny.' },
      { id: 'commit', label: 'Buy a 3-year commitment to get a discount', quality: 'partial', consequence: 'You get a discount on waste. Commit after removing idle capacity, not before.' },
    ],
    lesson: 'FinOps starts with visibility: break the bill into line items, remove idle usage, then optimise rates.',
    labs: ['cloud-cost-calculator', 'aws-architecture-generator'],
  },
  {
    id: 'owner', code: 'INC-0420', title: 'Who owns this service?', service: 'legacy-notifier', severity: 'SEV2',
    brief: 'A service nobody recognises is flooding logs with errors and paging the wrong team. There is no README and the original author left.',
    signals: ['logs: "SMTP 421 rate limited" x 3,200/min', 'pager: routed to platform-team by default', 'catalog entry: missing'],
    hint: 'A service catalog records who owns each service and what it depends on. When something is unowned, find or create that record so the right people get the page.',
    choices: [
      { id: 'catalog', label: 'Triage the logs, find the owner via dependencies, add it to the catalog', quality: 'best', consequence: 'Rule-based triage flags the rate-limit pattern; the dependency graph shows marketing-api calls it. Its team takes the page, and the next incident routes correctly.' },
      { id: 'kill', label: 'Shut the service down since nobody claims it', quality: 'harmful', consequence: 'Password reset emails stop. Unowned is not the same as unused.' },
      { id: 'slack', label: 'Post in a big chat channel asking who owns it', quality: 'partial', consequence: 'Someone answers after 40 minutes. It works this time, but nothing prevents it next time.' },
    ],
    lesson: 'Ownership metadata and transparent log rules shorten every future incident. Platform engineering makes the right answer the easy one.',
    labs: ['developer-portal', 'incident-response-assistant'],
  },
];

export type Answer = { scenarioId: string; choiceId: string; quality: Quality; points: number; hintUsed: boolean; healthAfter: number };

export type Status = 'intro' | 'playing' | 'answered' | 'won' | 'lost';

export type GameState = {
  status: Status;
  index: number;
  health: number;
  score: number;
  streak: number;
  bestStreak: number;
  hintShown: boolean;
  answers: Answer[];
};

export function createInitialState(): GameState {
  return { status: 'intro', index: 0, health: START_HEALTH, score: 0, streak: 0, bestStreak: 0, hintShown: false, answers: [] };
}

export function startGame(): GameState {
  return { ...createInitialState(), status: 'playing' };
}

export const resetGame = createInitialState;

export function getCurrentScenario(s: GameState, list: Scenario[] = SCENARIOS): Scenario | undefined {
  return list[s.index];
}

export function scoreFor(quality: Quality, streakBefore: number, hintUsed: boolean): number {
  const base = BASE_POINTS[quality];
  if (base === 0) return 0;
  const bonus = quality === 'best' ? streakBefore * STREAK_BONUS : 0;
  return Math.max(0, base + bonus - (hintUsed ? HINT_PENALTY : 0));
}

export function clampHealth(h: number): number {
  return Math.max(0, Math.min(MAX_HEALTH, h));
}

export function showHint(s: GameState): GameState {
  if (s.status !== 'playing' || s.hintShown) return s;
  return { ...s, hintShown: true };
}

/** Idempotent: only scores while status is 'playing'. Repeated calls return the same state. */
export function chooseOption(s: GameState, choiceId: string, list: Scenario[] = SCENARIOS): GameState {
  if (s.status !== 'playing') return s;
  const sc = list[s.index];
  const choice = sc?.choices.find((c) => c.id === choiceId);
  if (!sc || !choice) return s;
  const points = scoreFor(choice.quality, s.streak, s.hintShown);
  const health = clampHealth(s.health + HEALTH_DELTA[choice.quality]);
  const streak = choice.quality === 'best' ? s.streak + 1 : 0;
  return {
    ...s,
    status: 'answered',
    score: s.score + points,
    health,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    answers: [...s.answers, { scenarioId: sc.id, choiceId, quality: choice.quality, points, hintUsed: s.hintShown, healthAfter: health }],
  };
}

export function nextIncident(s: GameState, list: Scenario[] = SCENARIOS): GameState {
  if (s.status !== 'answered') return s;
  if (s.health <= 0) return { ...s, status: 'lost' };
  if (s.index + 1 >= list.length) return { ...s, status: 'won' };
  return { ...s, status: 'playing', index: s.index + 1, hintShown: false };
}

export function lastAnswer(s: GameState): Answer | undefined {
  return s.answers[s.answers.length - 1];
}

export function discoveredSlugs(s: GameState, list: Scenario[] = SCENARIOS): string[] {
  const seen = new Set<string>();
  for (const a of s.answers) list.find((x) => x.id === a.scenarioId)?.labs.forEach((l) => seen.add(l));
  return LAB_SLUGS.filter((l) => seen.has(l));
}

export function maxPossibleScore(list: Scenario[] = SCENARIOS): number {
  let t = 0;
  for (let i = 0; i < list.length; i++) t += scoreFor('best', i, false);
  return t;
}

export function rankFor(score: number, list: Scenario[] = SCENARIOS): string {
  const r = score / maxPossibleScore(list);
  if (r >= 0.9) return 'Incident Commander';
  if (r >= 0.65) return 'Senior On-Call';
  if (r >= 0.4) return 'Steady Responder';
  return 'Pager Apprentice';
}

/** Returns a list of problems; empty means scenario data is valid and covers all labs. */
export function validateScenarios(list: Scenario[] = SCENARIOS): string[] {
  const errs: string[] = [];
  const valid = new Set<string>(LAB_SLUGS);
  const covered = new Set<string>();
  const ids = new Set<string>();
  for (const s of list) {
    if (ids.has(s.id)) errs.push(`duplicate scenario ${s.id}`);
    ids.add(s.id);
    if (s.choices.filter((c) => c.quality === 'best').length !== 1) errs.push(`${s.id}: needs exactly one best choice`);
    for (const l of s.labs) { if (!valid.has(l)) errs.push(`${s.id}: unknown lab ${l}`); covered.add(l); }
  }
  for (const l of LAB_SLUGS) if (!covered.has(l)) errs.push(`lab not covered: ${l}`);
  if (list.length < 8) errs.push('fewer than 8 scenarios');
  return errs;
}

type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };

function defaultStorage(): StorageLike | null {
  try { return typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? (globalThis as { localStorage: StorageLike }).localStorage : null; } catch { return null; }
}

export function loadBestScore(storage: StorageLike | null = defaultStorage()): number {
  try {
    const n = Number.parseInt(storage?.getItem(BEST_SCORE_KEY) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

/** Saves only if higher. Never throws. Returns the resulting best. */
export function saveBestScore(score: number, storage: StorageLike | null = defaultStorage()): number {
  const prev = loadBestScore(storage);
  if (!Number.isFinite(score) || score <= prev) return prev;
  try { storage?.setItem(BEST_SCORE_KEY, String(Math.floor(score))); } catch { /* storage unavailable: play continues */ }
  return Math.floor(score);
}
