# DevOps Engineering Lab

An interactive public portfolio spanning DevOps, infrastructure, platform engineering, AWS, Kubernetes, and OpenShift.

## Running the portfolio

Use the configured **artifacts/devops-lab: web** workflow. The application is served at the root preview path. Its source is in `artifacts/devops-lab`.

## Demo boundaries

The website runs its educational labs in the visitor's browser. It does not require cloud credentials and must never request them from public visitors.

- Simulated infrastructure, incidents, pipeline executions, vulnerabilities, and restore exercises are not observations of a live environment.
- Calculators compute results from the visitor's input. Cost rates are illustrative, not a provider quote.
- Generated configuration files are examples for review and adaptation, not proof of a tested cloud deployment.
- Browser-local bookmarks, completion state, or service catalog entries are not shared across devices.
- The incident assistant uses deterministic rules, not a hosted language model.

## Demonstrating the portfolio

1. Open a project and explain its problem and architecture.
2. Change inputs or select an incident.
3. Show how the output changes and explain the engineering tradeoffs.
4. Show the configuration or runbook and download it.
5. Reset the lab so the next visitor can try independently.

## Before enabling real infrastructure

Use a separate sandbox account or cluster, least-privilege credentials, resource limits, spending alerts, isolation between visitors, automatic cleanup, and an explicit authorization boundary. Never connect unrestricted public controls to a production cloud account.

Publishing the portfolio website does not deploy AWS, Kubernetes, or OpenShift resources.
