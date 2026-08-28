import { 
  EvidenceProvenance, 
  EvidenceSource, 
  KeyDecision, 
  ProjectData, 
  ProjectProvenanceMap, 
  SubsystemNode, 
  SystemCategory, 
  ValidationEvidence, 
  PerformanceEvidence 
} from '../../types';

export interface RawRepositoryInspection {
  repoName?: string;
  owner?: string;
  defaultBranch?: string;
  language?: string | null;
  topics?: string[];
  description?: string | null;
  sizeKb?: number;
  stargazersCount?: number;
  forksCount?: number;
  openIssuesCount?: number;
  licenseSpdx?: string | null;
  treeFiles?: string[];
  readmeContent?: string | null;
  packageJsonContent?: string | null;
  manifestContents?: Record<string, string>;
  pnpmWorkspaceYaml?: string | null;
  turboJson?: string | null;
  dockerFiles?: string[];
  workflowFiles?: string[];
  docsFiles?: string[];
  testFiles?: string[];
  configFiles?: string[];
}

export interface AnalyzedDocumentation {
  challenge: { text: string; provenance: EvidenceProvenance; source: EvidenceSource } | null;
  solution: { text: string; provenance: EvidenceProvenance; source: EvidenceSource } | null;
  architectureNotes: { text: string; provenance: EvidenceProvenance; source: EvidenceSource } | null;
  explicitComponents: Array<{
    name: string;
    path?: string;
    role?: string;
    tech?: string[];
    protocol?: string;
    description?: string;
  }>;
  explicitDecisions: Array<{
    decision: string;
    rationale: string;
    tradeoff: string;
    source: EvidenceSource;
  }>;
  testingNotes: string | null;
  performanceNotes: string | null;
}

export interface AnalyzedDependencies {
  frameworks: {
    frontend: string[];
    backend: string[];
    database: string[];
    devops: string[];
    testing: string[];
    tools: string[];
  };
  workspaces: string[];
  packageScripts: Record<string, string>;
  isMonorepo: boolean;
  primaryEcosystem: string;
}

export interface AnalyzedTesting {
  testFrameworks: string[];
  ciWorkflows: string[];
  e2eHarnesses: string[];
  lintersAndFormatters: string[];
  buildTools: string[];
  hasDocker: boolean;
  hasMigrations: boolean;
  testFilesDetected: number;
  testingSummary: string;
  provenance: EvidenceProvenance;
}

export interface AnalyzedArchitecture {
  subsystems: SubsystemNode[];
  category: SystemCategory;
  classifications?: SystemCategory[];
  detectedLayers: string[];
  provenance: EvidenceProvenance;
  architectureSummary: string;
}

export interface UnifiedRepositoryAnalysis {
  problem: string;
  problemProvenance: EvidenceProvenance;
  problemSource?: EvidenceSource;
  
  solution: string;
  solutionProvenance: EvidenceProvenance;
  solutionSource?: EvidenceSource;
  
  architectureNotes: string;
  architectureProvenance: EvidenceProvenance;
  architectureSource?: EvidenceSource;
  
  subsystems: SubsystemNode[];
  subsystemsProvenance: EvidenceProvenance;
  
  keyDecisions: KeyDecision[];
  keyDecisionsProvenance: EvidenceProvenance;
  
  resilienceTesting: string;
  resilienceTestingProvenance: EvidenceProvenance;
  
  validationEvidence: ValidationEvidence;
  performanceEvidence: PerformanceEvidence;
  
  techStack: string[];
  category: SystemCategory;
  classifications?: SystemCategory[];
  provenanceMap: ProjectProvenanceMap;
}
