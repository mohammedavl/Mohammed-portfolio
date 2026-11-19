export type LabMeta = {
  slug: string;
  num: string;
  title: string;
  summary: string;
  kind: 'simulation' | 'tool';
  tech: string[];
  instructions: string[];
  explanation: string[];
  diagram: string;
  limitations: string[];
};

export const LABS: LabMeta[] = [
  {
    slug: 'aws-architecture-generator',
    num: '01',
    title: 'AWS Architecture Template Generator',
    summary: 'Pick a region, replica count and instance size; get a multi-AZ CloudFormation template and a live topology.',
    kind: 'tool',
    tech: ['AWS', 'CloudFormation', 'IaC'],
    instructions: [
      'Choose a region. Each region exposes a fixed list of Availability Zones in this tool.',
      'Set replicas and the number of AZs to spread across. Watch the topology redistribute instances round-robin.',
      'Toggle the database tier to add a Multi-AZ RDS instance and subnet group.',
      'Download template.yaml and validate it with `aws cloudformation validate-template` in your own account.',
    ],
    explanation: [
      'The generator emits a VPC with one public and one private subnet per selected AZ, an Application Load Balancer in the public subnets and an Auto Scaling Group in the private subnets. DesiredCapacity equals replicas; MinSize is set so that losing a single AZ still leaves at least one instance per remaining zone.',
      'CIDRs are carved deterministically from 10.20.0.0/16 (public 10.20.{n}.0/24, private 10.20.{100+n}.0/24) so re-generating never produces overlapping ranges. The AMI is resolved through the public SSM parameter for Amazon Linux 2023 instead of a hardcoded image ID, which keeps the template region-portable.',
    ],
    diagram: `           Internet
              |
        [ ALB  :80 ]  public subnets (1 per AZ)
         /    |    \\
   [AZ-a]  [AZ-b]  [AZ-c]   private subnets
    EC2     EC2     EC2     <- Auto Scaling Group (desired = replicas)
      \\      |      /
       [ RDS Multi-AZ ]     optional`,
    limitations: [
      'Nothing is deployed. The template is generated text; no AWS API is called.',
      'NAT gateways, TLS listeners and IAM instance profiles are omitted to keep the template readable.',
      'AZ lists are a static fixture and may differ from what your account sees.',
    ],
  },
  {
    slug: 'terraform-drift-comparator',
    num: '02',
    title: 'Terraform Drift Comparator',
    summary: 'Compare declared replicas and instance size against observed state and read the plan Terraform would produce.',
    kind: 'simulation',
    tech: ['Terraform', 'IaC', 'AWS'],
    instructions: [
      'Set the desired state as it appears in main.tf.',
      'Set the "actual" state as if someone changed resources in the console.',
      'Read the generated plan: count changes create or destroy, instance_type changes update in-place with a stop/start.',
      'Choose a remediation strategy: re-apply code, or import the drift back into code.',
    ],
    explanation: [
      'Drift is the difference between the state file refreshed against reality and the configuration. `terraform plan -refresh-only` surfaces it without proposing changes; a normal plan proposes reverting it.',
      'Changing `instance_type` on aws_instance is an in-place update that requires a stop/start, so it causes downtime per instance. Changing `count` destroys the highest indexes first, which is why for_each keyed by stable names is usually safer.',
    ],
    diagram: `  main.tf  ----\\
                 >-- terraform plan --> diff --> apply (revert drift)
  tfstate  ----/          ^
     ^                    |
     +--- refresh <--- real infrastructure (console edits)`,
    limitations: [
      'The plan output is synthesized by this page to mirror Terraform formatting; Terraform is not executed.',
      'Only two attributes are modelled. Real drift includes tags, security groups and out-of-band resources.',
    ],
  },
  {
    slug: 'kubernetes-troubleshooting',
    num: '03',
    title: 'Kubernetes Troubleshooting Bench',
    summary: 'Pick a broken pod scenario, gather evidence with kubectl, then apply the repair that actually fixes it.',
    kind: 'simulation',
    tech: ['Kubernetes', 'Debugging'],
    instructions: [
      'Select a failure scenario. The cluster panel shows what `kubectl get pods` would report.',
      'Run the diagnostic commands one at a time. Each reveals evidence.',
      'Choose a repair. Wrong repairs are rejected with an explanation of why they would not help.',
      'Download the runbook for the scenario you solved.',
    ],
    explanation: [
      'Pod status strings are symptoms, not causes. CrashLoopBackOff means the container exits; logs --previous show why. ImagePullBackOff is a registry, tag or credential issue visible in events. OOMKilled appears in lastState.terminated.reason with exit code 137. Pending pods are explained by scheduler events. A Running pod that never becomes Ready points at the readiness probe.',
      'The bench encodes the evidence-first workflow: describe, logs, events, then change one thing.',
    ],
    diagram: `  kubectl get pods  -> status
        |
  kubectl describe  -> events, lastState, probes
        |
  kubectl logs --previous -> application error
        |
  targeted fix -> rollout -> verify Ready`,
    limitations: [
      'No cluster exists; outputs are realistic fixtures per scenario.',
      'Five scenarios cover common failures but not networking/CNI or node-level faults.',
    ],
  },
  {
    slug: 'openshift-deployment',
    num: '04',
    title: 'OpenShift Deployment Builder',
    summary: 'Namespace, image and replicas in; validated Deployment, Service and edge-TLS Route YAML out.',
    kind: 'tool',
    tech: ['OpenShift', 'Kubernetes', 'YAML'],
    instructions: [
      'Enter a namespace and application name. Both are validated against DNS-1123 label rules.',
      'Provide a fully qualified image reference, replica count and container port.',
      'Toggle edge TLS termination and set an optional hostname.',
      'Download openshift.yaml and apply with `oc apply -f openshift.yaml`.',
    ],
    explanation: [
      'OpenShift runs containers with an arbitrary UID by default (restricted-v2 SCC), so the generated Deployment sets runAsNonRoot and drops all capabilities rather than pinning a UID. A Route targets a Service, not a Deployment, so the generator always emits the Service in between.',
      'Edge termination lets the router present the certificate and forward plain HTTP to the pod; insecureEdgeTerminationPolicy: Redirect upgrades port 80 traffic.',
    ],
    diagram: `  client --https--> [ Router / Route ] --http--> [ Service :port ]
                                                     |
                                    [ Deployment: N pods ]`,
    limitations: ['YAML is generated but not applied to any cluster.', 'Resource requests are fixed defaults; tune them for your workload.'],
  },
  {
    slug: 'cicd-pipeline',
    num: '05',
    title: 'CI/CD Pipeline Runner',
    summary: 'Run a five-stage pipeline, inject a failure at any stage, inspect logs and retry from the failed step.',
    kind: 'simulation',
    tech: ['CI/CD', 'GitHub Actions'],
    instructions: [
      'Select which stage should fail (or none) and whether the failure is transient.',
      'Run the pipeline. Stages execute sequentially; downstream stages are skipped after a failure.',
      'Retry from the failed stage. Transient failures pass on retry; deterministic failures fail again until you clear the injected fault.',
    ],
    explanation: [
      'Pipelines are DAGs where each stage gates the next. Fail-fast prevents publishing artifacts from broken commits. Retrying only from the failed stage reuses cached outputs of earlier stages, which is why build artifacts should be content-addressed.',
      'Distinguishing transient failures (registry timeouts) from deterministic ones (failing tests) is what makes automatic retries safe: retries should be limited and only for known-flaky classes.',
    ],
    diagram: `  lint -> test -> build -> scan -> deploy
    |       |       |        |        |
   fail => downstream marked SKIPPED, retry resumes here`,
    limitations: ['No runner executes code. Durations and logs are synthetic.', 'The workflow file is a real, valid starting point but references placeholder scripts.'],
  },
  {
    slug: 'gitops-reconciliation',
    num: '06',
    title: 'GitOps Reconciliation Loop',
    summary: 'Edit desired state in Git and live state in the cluster, watch drift, then sync.',
    kind: 'simulation',
    tech: ['GitOps', 'Argo CD', 'Kubernetes'],
    instructions: [
      'Change values on the Git (desired) side to simulate a commit.',
      'Change values on the Live side to simulate a manual kubectl edit.',
      'Observe the OutOfSync fields and the diff. Click Sync to reconcile, or enable self-heal to sync automatically.',
    ],
    explanation: [
      'A GitOps controller continuously compares rendered manifests from Git to live objects and reports Synced or OutOfSync. Sync applies Git to the cluster; Git always wins. Self-heal reverts manual edits without human action, and prune removes objects deleted from Git.',
      'This is why emergency kubectl edits must be followed by a commit, otherwise the controller silently reverts the hotfix.',
    ],
    diagram: `  git commit -> [ repo ] <-- poll/webhook -- [ controller ]
                                               |  diff
                                               v
                                         [ cluster live ]`,
    limitations: ['No controller or cluster exists; reconciliation is a local state machine.'],
  },
  {
    slug: 'canary-rollout',
    num: '07',
    title: 'Canary Rollout Controller',
    summary: 'Shift traffic in steps, compare canary error rate to a threshold, and promote or roll back.',
    kind: 'simulation',
    tech: ['Progressive Delivery', 'Argo Rollouts', 'Kubernetes'],
    instructions: [
      'Set the error-rate threshold and the observed canary error rate.',
      'Advance through traffic steps. At each step analysis compares canary errors to the threshold.',
      'If analysis fails the rollout aborts automatically. You can also promote fully or roll back manually.',
    ],
    explanation: [
      'Canary releases expose a small share of traffic to the new version and gate progress on metrics. A failed analysis aborts and returns 100 percent of traffic to stable. Comparing against an absolute threshold is simple; comparing to the stable baseline is more robust to background noise.',
      'Low traffic steps need enough requests to be statistically meaningful, which is why real analyses set a minimum sample count.',
    ],
    diagram: `            [ ingress ]
           /           \\
   100-w %             w %
   [ stable v1 ]   [ canary v2 ] --> metrics --> analysis --> promote | abort`,
    limitations: ['Error rates are entered by you, not measured.', 'The YAML targets Argo Rollouts but analysis queries are placeholders.'],
  },
  {
    slug: 'observability-incident',
    num: '08',
    title: 'Observability Incident Dashboard',
    summary: 'Choose a synthetic incident, correlate latency, error and saturation charts with logs, and name the cause.',
    kind: 'simulation',
    tech: ['Observability', 'Prometheus', 'Logging'],
    instructions: [
      'Pick an incident. Charts and logs regenerate from a deterministic fixture.',
      'Correlate: find when the signals change and which logs coincide.',
      'Filter logs by level, then submit your root-cause hypothesis.',
    ],
    explanation: [
      'The four golden signals (latency, traffic, errors, saturation) usually tell you where to look; logs tell you why. Sequence matters: saturation rising before latency suggests resource exhaustion, while errors stepping up exactly at a deploy marker suggests a bad release.',
      'Alert rules in the download use multi-window burn-rate style conditions instead of raw thresholds to reduce paging noise.',
    ],
    diagram: `  app --metrics--> Prometheus --> alert rules --> pager
   |
   +----logs-----> log store  --> correlation by timestamp`,
    limitations: ['All metrics and logs are synthetic fixtures. No telemetry is collected.'],
  },
  {
    slug: 'slo-error-budget',
    num: '09',
    title: 'SLO and Error Budget Calculator',
    summary: 'Availability target plus request and error counts become a budget, burn rate and release decision.',
    kind: 'tool',
    tech: ['SRE', 'SLO'],
    instructions: [
      'Enter the SLO target, the window length and how far into the window you are.',
      'Enter total requests and failed requests so far.',
      'Read budget consumed, burn rate and the policy recommendation. Download the Sloth-format SLO spec.',
    ],
    explanation: [
      'Error budget = (1 - target) x requests. Burn rate = observed error ratio / allowed error ratio; a burn rate of 1 exhausts the budget exactly at window end. The tool projects consumption linearly to the end of the window.',
      'A common policy: freeze risky releases when more than the elapsed fraction of budget is spent, page when the short-window burn exceeds 14.4 (2 percent of a 30-day budget in one hour).',
    ],
    diagram: `  requests, errors --> error ratio --> / allowed ratio --> burn rate
                                         --> budget remaining --> policy`,
    limitations: ['Calculations are exact; inputs are yours. It does not query any metrics source.'],
  },
  {
    slug: 'cloud-cost-calculator',
    num: '10',
    title: 'Cloud Cost Calculator',
    summary: 'Editable unit rates for compute, storage and egress produce a monthly estimate and CSV.',
    kind: 'tool',
    tech: ['FinOps', 'AWS'],
    instructions: [
      'All rates are illustrative defaults. Replace them with your provider list price or negotiated rate.',
      'Enter instance count, hours, storage and egress.',
      'Compare on-demand with a committed-use discount and download the CSV.',
    ],
    explanation: [
      'Monthly compute = instances x hours x hourly rate. Running 24x7 is about 730 hours a month; scheduling non-production to business hours (about 217 hours) cuts compute by roughly 70 percent. Egress is frequently the surprise line item.',
    ],
    diagram: `  rates x usage --> line items --> subtotal --> discount --> monthly / annual`,
    limitations: ['Default rates are illustrative and are not current published prices for any provider.', 'Taxes, support plans and tiered pricing are not modelled.'],
  },
  {
    slug: 'container-security-explorer',
    num: '11',
    title: 'Container Security Findings Explorer',
    summary: 'Triage a fixture vulnerability report: filter by severity, read remediation, track fixes and risk.',
    kind: 'simulation',
    tech: ['Security', 'Containers', 'Docker'],
    instructions: [
      'Filter findings by severity and show or hide those marked fixed.',
      'Select a finding to read its remediation and the Dockerfile change it implies.',
      'Mark findings remediated and watch the gate decision change. Download the hardened Dockerfile.',
    ],
    explanation: [
      'Scanners match installed packages against advisories. Most findings disappear by rebasing onto a smaller, patched base image; the rest require package upgrades or configuration fixes (running as root, secrets in layers).',
      'A CI gate commonly fails the build on any unfixed critical or high with an available fix, rather than on every finding.',
    ],
    diagram: `  image --> scanner --> findings --> triage --> fix --> rebuild --> gate`,
    limitations: ['Findings are fixtures labelled FIX-xxxx. Nothing is scanned and they do not reference real advisories.'],
  },
  {
    slug: 'rbac-playground',
    num: '12',
    title: 'Kubernetes RBAC Playground',
    summary: 'Evaluate whether a role can perform a verb on a resource in a namespace, with the matching rule shown.',
    kind: 'tool',
    tech: ['Kubernetes', 'Security', 'RBAC'],
    instructions: [
      'Choose a subject role, verb, resource and namespace.',
      'Read the allow or deny decision and which rule matched.',
      'Download the policy YAML defining all roles and bindings.',
    ],
    explanation: [
      'Kubernetes RBAC is additive and deny-by-default: a request is allowed if any bound rule matches apiGroup, resource and verb. Roles are namespaced; ClusterRoles bound via ClusterRoleBinding apply everywhere. There are no deny rules.',
      'The evaluator implements this matching including wildcard verbs and resources, mirroring `kubectl auth can-i`.',
    ],
    diagram: `  subject --binding--> role --rules--> (apiGroup, resource, verb)
  request ---------------------------------> any match? allow : deny`,
    limitations: ['Role definitions are fixtures. Aggregated ClusterRoles and subresources are simplified.'],
  },
  {
    slug: 'disaster-recovery-drill',
    num: '13',
    title: 'Disaster Recovery Drill',
    summary: 'Backup age and restore duration measured against RPO and RTO yield a pass or fail with a timeline.',
    kind: 'tool',
    tech: ['DR', 'SRE', 'Backups'],
    instructions: [
      'Set RPO and RTO objectives in minutes.',
      'Set the backup interval and the time since the last successful backup when disaster strikes.',
      'Set detection time and restore duration. Read the timeline and verdict.',
    ],
    explanation: [
      'Data loss equals the age of the newest restorable backup at failure. Worst case is one full backup interval plus backup duration, so RPO must be at least the interval. Downtime equals detection + decision + restore + validation, which must fit inside RTO.',
    ],
    diagram: `  last backup ---- data loss ---- FAILURE ---- detect ---- restore ---- service up
                  (vs RPO)                 |-------- downtime (vs RTO) --------|`,
    limitations: ['This calculates a drill; it does not restore anything.'],
  },
  {
    slug: 'developer-portal',
    num: '14',
    title: 'Developer Portal Service Catalog',
    summary: 'Create, edit and delete service entries saved in your browser and generate Backstage catalog manifests.',
    kind: 'tool',
    tech: ['Platform Engineering', 'Backstage'],
    instructions: [
      'Add a service with owner, tier, lifecycle and dependencies.',
      'Select an entry to see its catalog-info.yaml. Edit or delete it at any time.',
      'Entries persist in localStorage on this device only.',
    ],
    explanation: [
      'A service catalog gives each component an owner and metadata so on-call, scorecards and docs can be found. Backstage reads catalog-info.yaml from each repository; dependsOn relations build the dependency graph.',
    ],
    diagram: `  repo/catalog-info.yaml --> catalog ingestion --> portal entity page
                                              --> dependency graph`,
    limitations: ['Storage is browser-local; nothing is shared or synced.'],
  },
  {
    slug: 'incident-response-assistant',
    num: '15',
    title: 'Incident Response Log Triage',
    summary: 'Rule-based pattern matching over sample logs produces likely causes and next commands. Not AI.',
    kind: 'tool',
    tech: ['Incident Response', 'Logging', 'SRE'],
    instructions: [
      'Load a sample log or paste your own text.',
      'Run triage. Each rule is a regular expression with a severity and next steps.',
      'Review matched lines and download the triage report.',
    ],
    explanation: [
      'Deterministic rules are transparent and auditable: every finding links to the exact regex and line that triggered it. This is how many log alerting systems work. It cannot reason about novel failures, which is the trade-off against opaque models.',
    ],
    diagram: `  log text --> split lines --> rule set (regex) --> findings ranked by severity --> report`,
    limitations: ['This is NOT live AI and not connected to any model or service. It only knows the rules shown.', 'Text you paste never leaves the browser.'],
  },
];

export const ALL_TECH = Array.from(new Set(LABS.flatMap((l) => l.tech))).sort();
export const getLab = (slug: string) => LABS.find((l) => l.slug === slug);
