import type { ComponentType } from 'react';
import AwsArchitecture from './aws-architecture';
import TerraformDrift from './terraform-drift';
import K8sTroubleshoot from './k8s-troubleshoot';
import OpenshiftDeploy from './openshift-deploy';
import CicdPipeline from './cicd-pipeline';
import GitopsReconcile from './gitops-reconcile';
import CanaryRollout from './canary-rollout';
import Observability from './observability';
import SloCalculator from './slo-calculator';
import CostCalculator from './cost-calculator';
import ContainerSecurity from './container-security';
import RbacPlayground from './rbac-playground';
import DrDrill from './dr-drill';
import DeveloperPortal from './developer-portal';
import IncidentAssistant from './incident-assistant';

export const LAB_COMPONENTS: Record<string, ComponentType> = {
  'aws-architecture-generator': AwsArchitecture,
  'terraform-drift-comparator': TerraformDrift,
  'kubernetes-troubleshooting': K8sTroubleshoot,
  'openshift-deployment': OpenshiftDeploy,
  'cicd-pipeline': CicdPipeline,
  'gitops-reconciliation': GitopsReconcile,
  'canary-rollout': CanaryRollout,
  'observability-incident': Observability,
  'slo-error-budget': SloCalculator,
  'cloud-cost-calculator': CostCalculator,
  'container-security-explorer': ContainerSecurity,
  'rbac-playground': RbacPlayground,
  'disaster-recovery-drill': DrDrill,
  'developer-portal': DeveloperPortal,
  'incident-response-assistant': IncidentAssistant,
};
