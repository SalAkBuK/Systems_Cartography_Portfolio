import { ArchitecturePrinciple, ExperienceNode, InfrastructureSkill, OperatorMetadata, ProjectData } from '../types';
import { PORTFOLIO_CONFIG } from '../config/portfolioConfig';

export const VERIFIED_OPERATOR_METADATA: OperatorMetadata = PORTFOLIO_CONFIG.operator;

// Public projects, skills, and the repository snapshot are populated from the
// configured GitHub target. Empty defaults prevent one fork owner from leaking
// another owner's checked-in résumé content when GitHub is unavailable.
export const VERIFIED_PROJECTS: ProjectData[] = [];
export const VERIFIED_SKILLS: InfrastructureSkill[] = [];
export const VERIFIED_EXPERIENCE: ExperienceNode[] = [];

export const VERIFIED_ARCHITECTURE_PRINCIPLES: ArchitecturePrinciple[] = [
  {
    id: 'evidence-principle-01',
    number: '01',
    title: 'Repository Evidence Before Claims',
    summary: 'Publish architecture and validation details only when a public repository supports them.',
    elaboration: 'GitHub metadata can establish repository facts. Architecture descriptions require reviewed documentation or code; production outcomes require owner-supplied evidence.',
    appliedIn: []
  },
  {
    id: 'evidence-principle-02',
    number: '02',
    title: 'Keep Identity Explicit',
    summary: 'Name, role, contact details, and availability belong to owner configuration.',
    elaboration: 'GitHub may provide a display name or bio, but the site owner controls the public identity and contact channels in portfolioConfig.ts.',
    appliedIn: []
  },
  {
    id: 'evidence-principle-03',
    number: '03',
    title: 'Public Viewer, Private Configuration',
    summary: 'Visitors inspect a portfolio; they do not mutate its source data.',
    elaboration: 'Fork owners configure the deployment in source control. The published interface contains no résumé upload or repository replacement controls.',
    appliedIn: []
  },
  {
    id: 'evidence-principle-04',
    number: '04',
    title: 'Show Unknowns Honestly',
    summary: 'An explicit evidence gap is preferable to a polished invented metric.',
    elaboration: 'Career duration, proficiency percentages, uptime, latency, SLAs, and business outcomes remain unclaimed unless a trustworthy source supplies them.',
    appliedIn: []
  }
];

export const VERIFIED_TOPOLOGY_ZONES = [
  {
    id: 'zone-fullstack',
    name: 'ZONE A // FULL-STACK SYSTEMS',
    bounds: { x: -220, y: -140, width: 170, height: 160 },
    code: 'SRC-01',
    description: 'Repositories spanning interfaces, services, persistence, and background work'
  },
  {
    id: 'zone-interface',
    name: 'ZONE B // WEB & MOBILE INTERFACES',
    bounds: { x: 0, y: -160, width: 190, height: 160 },
    code: 'SRC-02',
    description: 'Public frontend and mobile application repositories'
  },
  {
    id: 'zone-service',
    name: 'ZONE C // API & DATA SERVICES',
    bounds: { x: -220, y: 30, width: 180, height: 160 },
    code: 'SRC-03',
    description: 'Public API, backend, database, and infrastructure repositories'
  },
  {
    id: 'zone-tools',
    name: 'ZONE D // TOOLS & EXPERIMENTS',
    bounds: { x: 0, y: 30, width: 190, height: 160 },
    code: 'SRC-04',
    description: 'Automation, testing, developer tools, and public experiments'
  }
];
