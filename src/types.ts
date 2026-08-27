export type SystemCategory = 'frontend' | 'backend' | 'fullstack' | 'infrastructure' | 'tooling';

export type SystemStatus = 'PRODUCTION' | 'ACTIVE' | 'EXPERIMENTAL' | 'ARCHIVED';

export type EvidenceProvenance = 'VERIFIED' | 'DERIVED' | 'CURATED' | 'UNAVAILABLE';

export interface EvidenceSource {
  sourceType: 'repository_file' | 'repository_structure' | 'github_metadata' | 'curated_override' | 'inferred';
  path?: string;
  section?: string;
  field?: string;
  details?: string;
}

export interface SubsystemNode {
  id: string;
  name: string;
  category: 'frontend' | 'backend' | 'database' | 'queue' | 'auth' | 'telemetry' | 'worker';
  role: string;
  protocol?: string;
  description: string;
  tech: string[];
  metrics?: { label: string; value: string }[];
  coordinates: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  provenance?: EvidenceProvenance;
  evidenceSource?: EvidenceSource;
}

export interface KeyDecision {
  decision: string;
  rationale: string;
  tradeoff: string;
  provenance?: EvidenceProvenance;
  evidenceSource?: EvidenceSource;
}

export interface ValidationEvidence {
  testFrameworks: string[];
  ciWorkflows: string[];
  e2eHarnesses: string[];
  lintersAndFormatters: string[];
  buildTools: string[];
  hasDocker: boolean;
  hasMigrations: boolean;
  testFilesDetected?: number;
  summary: string;
  provenance?: EvidenceProvenance;
}

export interface PerformanceEvidence {
  claimed: boolean;
  metrics?: { label: string; value: string; note?: string }[];
  notes?: string;
  provenance?: EvidenceProvenance;
}

export interface ProjectProvenanceMap {
  summary?: EvidenceProvenance;
  problem?: EvidenceProvenance;
  solution?: EvidenceProvenance;
  architectureNotes?: EvidenceProvenance;
  subsystems?: EvidenceProvenance;
  keyDecisions?: EvidenceProvenance;
  resilienceTesting?: EvidenceProvenance;
  metrics?: EvidenceProvenance;
}

export interface ProjectData {
  id: string;
  code: string;
  title: string;
  tagline: string;
  category: SystemCategory;
  classifications?: SystemCategory[];
  status: SystemStatus;
  year: string;
  dimensions: {
    width: number;
    height: number;
    levels: number;
  };
  gridPosition: { x: number; y: number };
  accentColor: string;
  summary: string;
  problem: string;
  solution: string;
  architectureNotes: string;
  techStack: string[];
  infrastructureDeps: string[];
  subsystems: SubsystemNode[];
  metrics: { label: string; value: string; note?: string; provenance?: EvidenceProvenance }[];
  keyDecisions: KeyDecision[];
  resilienceTesting: string;
  provenance?: ProjectProvenanceMap;
  validationEvidence?: ValidationEvidence;
  performanceEvidence?: PerformanceEvidence;
  links: {
    demo?: string;
    github?: string;
    docs?: string;
    caseStudy?: boolean;
  };
}

export interface InfrastructureSkill {
  id: string;
  code: string;
  name: string;
  category: SystemCategory;
  yearsActive: number;
  proficiencyScore: number;
  gridPosition: { x: number; y: number };
  systemCount: number;
  usedInProjects: string[];
  primaryUseCases: string[];
  technicalHighlights: string[];
  samplePattern: string;
}

export interface ArchitectedSystem {
  id?: string;
  name: string;
  description: string;
  architecturalScope: string[];
  linkedProjectId?: string;
  technologies?: string[];
  provenance?: EvidenceProvenance;
}

export interface SystemSurface {
  name: string; // e.g. 'Backend', 'Admin / Web', 'Mobile'
  role: string;
  tech: string[];
  status?: string; // e.g. 'ORIGINAL BACKEND RETIRED', 'FRONTEND SHOWCASE', 'ACTIVE'
  linkedProjectId?: string;
  repositoryUrl?: string;
  showcaseUrl?: string;
  provenance?: EvidenceProvenance;
}

export interface DeliveredSystem {
  id?: string;
  name: string; // e.g. 'TowerDesk Platform', 'Internal CRM Platform', 'Property Data Ingestion Service'
  tagline: string;
  status?: string; // e.g. 'FRONTEND SHOWCASE // ORIGINAL BACKEND RETIRED'
  surfaces?: SystemSurface[];
  description: string;
  capabilities?: string[];
  dataFlow?: string;
  linkedProjectIds?: string[];
  technologies: string[];
  provenance?: EvidenceProvenance;
}

export interface EngineeringContribution {
  title: string;
  description: string;
  impactArea?: string;
  technologies?: string[];
  provenance?: EvidenceProvenance;
}

export interface InfrastructureOperation {
  area: string;
  details: string;
  status?: string;
  provenance?: EvidenceProvenance;
}

export interface ExperienceEvidenceLink {
  label: string;
  type: 'repository' | 'showcase' | 'case_study' | 'documentation' | 'external';
  url?: string;
  projectId?: string;
  note?: string;
}

export interface OwnerExperienceEvidence {
  organizationId: string; // matches organization name, slug, or progressionGroup
  organizationName?: string;
  architectedSystems?: ArchitectedSystem[];
  systemsDelivered?: DeliveredSystem[];
  engineeringContributions?: EngineeringContribution[];
  infrastructureOperations?: InfrastructureOperation[];
  evidenceLinks?: ExperienceEvidenceLink[];
  technologies?: string[];
  gridPosition?: { x: number; y: number };
  provenance?: EvidenceProvenance;
}

export interface ExperienceNode {
  id: string;
  code: string;
  yearRange: string;
  role: string;
  organization: string;
  location: string;
  systemDomain: string;
  keyOutputs: string[];
  systemsArchitected: string[];
  technologies: string[];
  gridPosition: { x: number; y: number };
  provenance?: EvidenceProvenance;
  /** ISO YYYY-MM chronology emitted by the one-time profile importer. */
  startDate?: string;
  /** Null means the role is current. */
  endDate?: string | null;
  /** Shared slug for consecutive roles at the same organization. */
  progressionGroup?: string;
  /** Oldest role is 1; later promotions increment within the same organization. */
  progressionOrder?: number;
  promotionNote?: string;

  // Curated Professional Evidence Overlay fields
  architectedSystemsDetails?: ArchitectedSystem[];
  systemsDelivered?: DeliveredSystem[];
  engineeringContributions?: EngineeringContribution[];
  infrastructureOperations?: InfrastructureOperation[];
  evidenceLinks?: ExperienceEvidenceLink[];
  progressionRoles?: ExperienceNode[];
}

export interface GeneratedOwnerProfile {
  source: {
    kind: 'linkedin_pdf';
    importedAt: string;
    reviewed: boolean;
    warnings: string[];
  };
  /** Normally inferred from the fork's git remote during setup. */
  githubTarget: string;
  operator: {
    name: string;
    role: string;
    location: string;
    focus: string;
    primaryStack: string[];
    systemManifesto: string;
    contact: {
      email: string;
      linkedin: string;
    };
  };
  experience: ExperienceNode[];
  skills: string[];
  certifications: string[];
  /** Kept raw when LinkedIn's PDF does not provide enough structure to merge safely. */
  education: { raw: string }[];
}

export interface ArchitecturePrinciple {
  id: string;
  number: string;
  title: string;
  summary: string;
  elaboration: string;
  appliedIn: string[];
}

export interface OperatorMetadata {
  name: string;
  handle: string;
  role: string;
  location: string;
  status: string;
  focus: string;
  yearsActive: number;
  commitsIndexed: string;
  productionUptime: string;
  primaryStack: string[];
  systemManifesto: string;
  contact: {
    email: string;
    github: string;
    linkedin: string;
    pgpKeyId: string;
    pgpFingerprint: string;
    matrix: string;
    availability: string;
  };
}

export type ActiveView = 
  | 'system_overview'
  | 'identity'
  | 'projects'
  | 'experience'
  | 'infrastructure'
  | 'process'
  | 'contact';

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}
