import { 
  EvidenceProvenance, 
  KeyDecision, 
  ProjectData, 
  ProjectProvenanceMap, 
  SubsystemNode, 
  SystemCategory,
  SystemStatus 
} from '../../types';
import { getRepositoryEvidence } from '../../data/repositoryEvidence';
import { PORTFOLIO_CONFIG } from '../../config/portfolioConfig';
import { resolveDeploymentLink } from '../../utils/portfolioUtils';
import { 
  AnalyzedArchitecture, 
  AnalyzedDependencies, 
  AnalyzedDocumentation, 
  AnalyzedTesting, 
  RawRepositoryInspection 
} from './types';
import { getGridCoordinatesForIndex, inferAccentColor } from '../githubService';

interface MergeParams {
  repo: {
    id: number;
    name: string;
    description: string | null;
    html_url: string;
    homepage: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string | null;
    topics: string[];
    size: number;
    archived: boolean;
    default_branch: string;
    license: { spdx_id?: string; name?: string } | null;
    owner: { login: string };
    pushed_at?: string;
  };
  index: number;
  total: number;
  inspection: RawRepositoryInspection;
  documentation: AnalyzedDocumentation;
  dependencies: AnalyzedDependencies;
  architecture: AnalyzedArchitecture;
  testing: AnalyzedTesting;
}

export function mergeRepositoryEvidence(params: MergeParams): ProjectData {
  const { repo, index, total, inspection, documentation, dependencies, architecture, testing } = params;

  const code = `GH-${(index + 1).toString().padStart(2, '0')}`;
  const accentColor = inferAccentColor(repo.language, index);
  const year = repo.pushed_at ? new Date(repo.pushed_at).getFullYear().toString() : new Date().getFullYear().toString();
  const status: SystemStatus = repo.archived ? 'ARCHIVED' : 'ACTIVE';

  // 3D Building Dimensions
  const sizeFactor = Math.min(Math.max(repo.size / 1000, 1), 10);
  const starFactor = Math.min(Math.max(Math.log10(repo.stargazers_count + 1) * 1.5, 1), 4);
  const width = Math.round(85 + Math.min(sizeFactor * 4, 35));
  const height = Math.round(65 + Math.min(starFactor * 12, 45));
  const levels = Math.min(Math.max(Math.round(starFactor + 1), 2), 5);

  // Tech stack aggregation
  const techStack: string[] = [];
  if (repo.language) techStack.push(repo.language);
  
  // Add all detected frameworks
  Object.values(dependencies.frameworks).flat().forEach(fw => {
    if (!techStack.includes(fw)) techStack.push(fw);
  });

  if (repo.topics && repo.topics.length > 0) {
    repo.topics.forEach(t => {
      const formatted = t.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      if (!techStack.includes(formatted)) techStack.push(formatted);
    });
  }

  if (techStack.length === 0) techStack.push('Codebase');

  // Format numbers
  const formatNumber = (num: number) => (num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num.toString());

  // Repository Signals (GitHub Metadata)
  const metrics = [
    { label: 'Stargazers', value: `${formatNumber(repo.stargazers_count)} ★`, note: 'GitHub community stars', provenance: 'VERIFIED' as EvidenceProvenance },
    { label: 'Forks', value: `${formatNumber(repo.forks_count)} ⑂`, note: 'Public downstream forks', provenance: 'VERIFIED' as EvidenceProvenance },
    { label: 'Repo Footprint', value: `${(repo.size / 1024).toFixed(1)} MB`, note: 'Source code & assets', provenance: 'VERIFIED' as EvidenceProvenance },
    { label: 'Open Issues', value: `${repo.open_issues_count} open`, note: 'Issue tracker backlog', provenance: 'VERIFIED' as EvidenceProvenance },
    { label: 'Primary Language', value: repo.language || 'Mixed Stack', note: 'Dominant language', provenance: 'VERIFIED' as EvidenceProvenance },
    { label: 'License Spec', value: repo.license?.spdx_id || 'Not reported', note: 'GitHub repository metadata', provenance: 'VERIFIED' as EvidenceProvenance }
  ];

  // Check optional curated override
  const curated = getRepositoryEvidence(repo.name);
  const hasInspectionEvidence = Boolean(inspection.readmeContent || inspection.packageJsonContent || (inspection.treeFiles && inspection.treeFiles.length > 0));

  // 1. Engineering Challenge
  let problem = 'Not established by GitHub repository metadata.';
  let problemProvenance: EvidenceProvenance = 'UNAVAILABLE';
  if (curated?.problem) {
    problem = curated.problem;
    problemProvenance = 'CURATED';
  } else if (documentation.challenge) {
    problem = documentation.challenge.text;
    problemProvenance = documentation.challenge.provenance;
  } else if (hasInspectionEvidence && repo.description && repo.description.length > 20) {
    problem = repo.description;
    problemProvenance = 'DERIVED';
  }

  // 2. Architectural Solution
  let solution = 'Inspect the repository and owner-approved case study before publishing implementation claims.';
  let solutionProvenance: EvidenceProvenance = 'UNAVAILABLE';
  if (curated?.solution) {
    solution = curated.solution;
    solutionProvenance = 'CURATED';
  } else if (documentation.solution) {
    solution = documentation.solution.text;
    solutionProvenance = documentation.solution.provenance;
  } else if (hasInspectionEvidence && architecture.subsystems.length > 0) {
    solution = architecture.architectureSummary;
    solutionProvenance = architecture.provenance;
  }

  // 3. Architecture Notes
  let architectureNotes = `Verified metadata only: primary language ${repo.language || 'not reported'}, default branch ${repo.default_branch || 'main'}, license ${repo.license?.spdx_id || 'not reported'}.`;
  let architectureProvenance: EvidenceProvenance = 'VERIFIED';
  if (curated?.architectureNotes) {
    architectureNotes = `${curated.architectureNotes} GitHub metadata: primary language ${repo.language || 'not reported'}, default branch ${repo.default_branch || 'main'}, license ${repo.license?.spdx_id || 'not reported'}.`;
    architectureProvenance = 'CURATED';
  } else if (documentation.architectureNotes) {
    architectureNotes = `${documentation.architectureNotes.text} GitHub metadata: primary language ${repo.language || 'not reported'}, default branch ${repo.default_branch || 'main'}, license ${repo.license?.spdx_id || 'not reported'}.`;
    architectureProvenance = documentation.architectureNotes.provenance;
  }

  // 4. Subsystems Decomposition
  let subsystems: SubsystemNode[] = [];
  let subsystemsProvenance: EvidenceProvenance = 'UNAVAILABLE';
  if (curated?.subsystems && curated.subsystems.length > 0) {
    subsystems = curated.subsystems.map(sub => ({
      ...sub,
      provenance: 'CURATED' as EvidenceProvenance
    }));
    subsystemsProvenance = 'CURATED';
  } else if (hasInspectionEvidence && architecture.subsystems.length > 0) {
    subsystems = architecture.subsystems;
    subsystemsProvenance = architecture.provenance;
  }

  // 5. Key Decisions & Trade-offs
  let keyDecisions: KeyDecision[] = [];
  let keyDecisionsProvenance: EvidenceProvenance = 'UNAVAILABLE';
  if (curated?.keyDecisions && curated.keyDecisions.length > 0) {
    keyDecisions = curated.keyDecisions.map(kd => ({
      ...kd,
      provenance: 'CURATED' as EvidenceProvenance
    }));
    keyDecisionsProvenance = 'CURATED';
  } else if (documentation.explicitDecisions.length > 0) {
    keyDecisions = documentation.explicitDecisions.map(d => ({
      decision: d.decision,
      rationale: d.rationale,
      tradeoff: d.tradeoff,
      provenance: 'VERIFIED' as EvidenceProvenance,
      evidenceSource: d.source
    }));
    keyDecisionsProvenance = 'VERIFIED';
  }

  // 6. Validation & Test Evidence
  let resilienceTesting = hasInspectionEvidence ? testing.testingSummary : 'Not established by GitHub repository metadata.';
  let resilienceTestingProvenance: EvidenceProvenance = hasInspectionEvidence ? testing.provenance : 'UNAVAILABLE';
  if (curated?.resilienceTesting) {
    resilienceTesting = curated.resilienceTesting;
    resilienceTestingProvenance = 'CURATED';
  }

  // Performance Telemetry Evidence (Strictly honest, never fabricated)
  const performanceEvidence = {
    claimed: documentation.performanceNotes !== null,
    notes: documentation.performanceNotes || 'No runtime benchmarks or production telemetry claimed in repository.'
  };

  const provenanceMap: ProjectProvenanceMap = {
    summary: 'VERIFIED',
    problem: problemProvenance,
    solution: solutionProvenance,
    architectureNotes: architectureProvenance,
    subsystems: subsystemsProvenance,
    keyDecisions: keyDecisionsProvenance,
    resilienceTesting: resilienceTestingProvenance,
    metrics: 'VERIFIED'
  };

  // Aggregate classifications from architecture analysis and curated subsystem evidence
  const finalClassifications = new Set<SystemCategory>(architecture.classifications || [architecture.category]);
  if (curated?.subsystems && curated.subsystems.length > 0) {
    const hasCuratedFe = curated.subsystems.some(s => s.category === 'frontend');
    const hasCuratedBe = curated.subsystems.some(s => s.category === 'backend' || s.category === 'auth');
    const hasCuratedDb = curated.subsystems.some(s => s.category === 'database');
    if (hasCuratedFe) finalClassifications.add('frontend');
    if (hasCuratedBe || hasCuratedDb) finalClassifications.add('backend');
    if (hasCuratedFe && (hasCuratedBe || hasCuratedDb)) finalClassifications.add('fullstack');
  }

  const summary = repo.description
    ? `${repo.description} GitHub reports ${repo.stargazers_count} stars, ${repo.forks_count} forks, and ${repo.open_issues_count} open issues.`
    : `Public repository owned by ${repo.owner.login}. Primary language: ${repo.language || 'unreported'}.`;

  return {
    id: `gh-${repo.id}`,
    code,
    title: repo.name,
    tagline: repo.description || `Public ${architecture.category} repository; no description supplied on GitHub.`,
    category: architecture.category,
    classifications: Array.from(finalClassifications),
    status,
    year,
    dimensions: { width, height, levels },
    gridPosition: getGridCoordinatesForIndex(index, total),
    accentColor,
    summary,
    problem,
    solution,
    architectureNotes,
    techStack,
    infrastructureDeps: [], // populated during profile generation
    subsystems,
    metrics,
    keyDecisions,
    resilienceTesting,
    provenance: provenanceMap,
    validationEvidence: {
      testFrameworks: testing.testFrameworks,
      ciWorkflows: testing.ciWorkflows,
      e2eHarnesses: testing.e2eHarnesses,
      lintersAndFormatters: testing.lintersAndFormatters,
      buildTools: testing.buildTools,
      hasDocker: testing.hasDocker,
      hasMigrations: testing.hasMigrations,
      testFilesDetected: testing.testFilesDetected,
      summary: testing.testingSummary,
      provenance: testing.provenance
    },
    performanceEvidence,
    links: {
      github: repo.html_url,
      demo: resolveDeploymentLink(repo.name, repo.homepage, PORTFOLIO_CONFIG.projectLinks),
      caseStudy: false
    }
  };
}
