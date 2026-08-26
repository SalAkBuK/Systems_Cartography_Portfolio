export type SystemCategory = 'frontend' | 'backend' | 'fullstack' | 'infrastructure' | 'tooling';

export type SystemStatus = 'PRODUCTION' | 'ACTIVE' | 'EXPERIMENTAL' | 'ARCHIVED';

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
}

export interface ProjectData {
  id: string;
  code: string; // e.g. 'P01'
  title: string;
  tagline: string;
  category: SystemCategory;
  status: SystemStatus;
  year: string;
  dimensions: {
    width: number;  // scope
    height: number; // depth/complexity
    levels: number; // stacked tiers
  };
  gridPosition: { x: number; y: number }; // isometric coordinates
  accentColor: string;
  summary: string;
  problem: string;
  solution: string;
  architectureNotes: string;
  techStack: string[];
  infrastructureDeps: string[]; // IDs of connected skills/infra
  subsystems: SubsystemNode[];
  metrics: { label: string; value: string; note?: string }[];
  keyDecisions: {
    decision: string;
    rationale: string;
    tradeoff: string;
  }[];
  resilienceTesting: string;
  links: {
    demo?: string;
    github?: string;
    docs?: string;
    caseStudy?: boolean;
  };
}

export interface InfrastructureSkill {
  id: string;
  code: string; // e.g. 'INF-01'
  name: string;
  category: SystemCategory;
  yearsActive: number;
  proficiencyScore: number; // 1-100
  gridPosition: { x: number; y: number };
  systemCount: number;
  usedInProjects: string[]; // Project IDs
  primaryUseCases: string[];
  technicalHighlights: string[];
  samplePattern: string;
}

export interface ExperienceNode {
  id: string;
  code: string; // e.g. 'EXP-01'
  yearRange: string;
  role: string;
  organization: string;
  location: string;
  systemDomain: string;
  keyOutputs: string[];
  systemsArchitected: string[];
  technologies: string[];
  gridPosition: { x: number; y: number };
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
