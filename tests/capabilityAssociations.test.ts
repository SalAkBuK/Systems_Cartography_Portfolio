import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeTechnologyName,
  getTechnologyFamilies,
  getCapabilityCoreTechnology,
  getProjectTechnologyEvidence,
  projectUsesCapability,
  getCapabilityProfessionalHistory,
  formatRolePeriod
} from '../src/utils/capabilityAssociations.ts';
import { generateGitHubProfileDetails, transformGitHubRepoToProject } from '../src/services/githubService.ts';
import { ExperienceNode, InfrastructureSkill, ProjectData } from '../src/types.ts';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated.ts';
import { resolveProfessionalExperience } from '../src/services/experienceResolver.ts';

test('1. NestJS project -> Node.js capability = TRUE', () => {
  const mockProject: Partial<ProjectData> = {
    id: 'proj-nestjs',
    title: 'Nest Service',
    techStack: ['NestJS', 'TypeScript']
  };

  assert.equal(projectUsesCapability(mockProject, 'Node.js'), true);
  assert.equal(projectUsesCapability(mockProject, 'Node.js & Application Architecture'), true);
});

test('2. Express project -> Node.js capability = TRUE', () => {
  const mockProject: Partial<ProjectData> = {
    id: 'proj-express',
    title: 'Express API',
    techStack: ['Express', 'JavaScript']
  };

  assert.equal(projectUsesCapability(mockProject, 'Node.js'), true);
});

test('3. TypeScript-only project -> Node.js capability = FALSE', () => {
  const mockProject: Partial<ProjectData> = {
    id: 'proj-ts',
    title: 'Pure TS Library',
    techStack: ['TypeScript']
  };

  assert.equal(projectUsesCapability(mockProject, 'Node.js'), false, 'TypeScript alone must not imply Node.js runtime');
});

test('4. PHP 8 -> PHP capability = TRUE', () => {
  const mockProject: Partial<ProjectData> = {
    id: 'proj-php',
    title: 'Legacy Portal',
    techStack: ['PHP 8']
  };

  assert.equal(projectUsesCapability(mockProject, 'PHP'), true);
  assert.equal(projectUsesCapability(mockProject, 'PHP & Web Application Architecture'), true);
});

test('5. MySQL2 -> MySQL capability = TRUE', () => {
  const mockProject: Partial<ProjectData> = {
    id: 'proj-mysql2',
    title: 'Database Gateway',
    techStack: ['MySQL2']
  };

  assert.equal(projectUsesCapability(mockProject, 'MySQL'), true);
});

test('6. PostgreSQL (pg) -> PostgreSQL capability = TRUE', () => {
  const mockProject: Partial<ProjectData> = {
    id: 'proj-pg',
    title: 'Data Store',
    techStack: ['PostgreSQL (pg)']
  };

  assert.equal(projectUsesCapability(mockProject, 'PostgreSQL'), true);
});

test('7. Unrelated technology -> capability = FALSE', () => {
  const mockProject: Partial<ProjectData> = {
    id: 'proj-rust',
    title: 'Wasm Tool',
    techStack: ['Rust', 'WebAssembly']
  };

  assert.equal(projectUsesCapability(mockProject, 'Node.js'), false);
  assert.equal(projectUsesCapability(mockProject, 'React'), false);
  assert.equal(projectUsesCapability(mockProject, 'PHP'), false);
});

test('8. systemCount is exactly usedInProjects.length and zero associations stay zero', () => {
  const mockProjects: Partial<ProjectData>[] = [
    {
      id: 'proj-1',
      title: 'App 1',
      techStack: ['PHP 8', 'MySQL']
    },
    {
      id: 'proj-2',
      title: 'App 2',
      techStack: ['PHP 8']
    },
    {
      id: 'proj-unmatched',
      title: 'Unmatched App',
      techStack: ['Haskell', 'Cabal']
    }
  ];

  const profile = generateGitHubProfileDetails(mockProjects as ProjectData[], null, 'testuser');

  for (const skill of profile.skills) {
    // Exact count verification (0 is 0, length matches systemCount exactly)
    assert.equal(skill.systemCount, skill.usedInProjects.length, `Skill ${skill.name} systemCount must match usedInProjects.length`);
  }

  // Verify unmatched project has empty infrastructureDeps
  const unmatched = mockProjects.find(p => p.id === 'proj-unmatched')!;
  assert.deepEqual(unmatched.infrastructureDeps, [], 'Unmatched project must have 0 infrastructure dependencies');

  // Verify no skill falsely includes proj-unmatched
  assert.ok(
    profile.skills.every(s => !s.usedInProjects.includes('proj-unmatched')),
    'No skill must contain proj-unmatched in usedInProjects'
  );
});

test('9. worthy-crm receives appropriate associations from its structured reviewed technology evidence', () => {
  const repoRaw = {
    id: 101,
    name: 'worthy-crm',
    full_name: 'SalAkBuK/worthy-crm',
    description: 'Internal CRM platform',
    html_url: 'https://github.com/SalAkBuK/worthy-crm',
    homepage: null,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    language: 'PHP',
    topics: [],
    size: 2000,
    archived: false,
    default_branch: 'main',
    license: null,
    owner: { login: 'SalAkBuK' }
  };

  const project = transformGitHubRepoToProject(repoRaw as any, 0, 1);

  // Verify structured subsystem evidence was extracted
  const evidence = getProjectTechnologyEvidence(project);
  assert.ok(evidence.includes('PHP 8') || evidence.includes('PHP'), 'Evidence must include PHP');
  assert.ok(evidence.includes('MySQL'), 'Evidence must include MySQL');
  assert.ok(evidence.includes('PDO'), 'Evidence must include PDO');

  // Verify capability matches
  assert.equal(projectUsesCapability(project, 'PHP'), true);
  assert.equal(projectUsesCapability(project, 'MySQL'), true);

  // Must NOT create fake associations for Node.js, React, PostgreSQL
  assert.equal(projectUsesCapability(project, 'Node.js'), false, 'Worthy CRM must not match Node.js');
  assert.equal(projectUsesCapability(project, 'React'), false, 'Worthy CRM must not match React');
  assert.equal(projectUsesCapability(project, 'PostgreSQL'), false, 'Worthy CRM must not match PostgreSQL');
});

test('10. TowerDesk backend is associated with Node.js through generic technology-family logic, NOT repository-name special casing', () => {
  // Generic test with arbitrary repository name having NestJS stack
  const genericNestRepo = {
    id: 202,
    name: 'arbitrary-company-service',
    full_name: 'acme/arbitrary-company-service',
    description: 'Modular property service',
    html_url: 'https://github.com/acme/arbitrary-company-service',
    homepage: null,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    language: 'TypeScript',
    topics: ['nestjs', 'prisma', 'postgresql'],
    size: 1500,
    archived: false,
    default_branch: 'main',
    license: null,
    owner: { login: 'acme' }
  };

  const project = transformGitHubRepoToProject(genericNestRepo as any, 0, 1);

  assert.equal(projectUsesCapability(project, 'Node.js'), true, 'Generic NestJS repository must associate with Node.js');
  assert.equal(projectUsesCapability(project, 'PostgreSQL'), true, 'Generic PostgreSQL repository must associate with PostgreSQL');
  assert.equal(projectUsesCapability(project, 'Prisma'), true, 'Generic Prisma repository must associate with Prisma');
});

test('11. TowerDesk backend (actual portfolio repository) associates with Node.js, PostgreSQL, and Prisma', () => {
  const towerdeskRepo = {
    id: 303,
    name: 'towerdesk-backend-clean',
    full_name: 'SalAkBuK/towerdesk-backend-clean',
    description: 'Multi-tenant property management backend',
    html_url: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
    homepage: null,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    language: 'TypeScript',
    topics: ['nestjs', 'prisma', 'postgresql'],
    size: 2500,
    archived: false,
    default_branch: 'main',
    license: null,
    owner: { login: 'SalAkBuK' }
  };

  const project = transformGitHubRepoToProject(towerdeskRepo as any, 0, 1);

  assert.equal(projectUsesCapability(project, 'Node.js'), true);
  assert.equal(projectUsesCapability(project, 'PostgreSQL'), true);
  assert.equal(projectUsesCapability(project, 'Prisma'), true);
});

test('12. Full portfolio sync generates capabilities and associates Worthy CRM and TowerDesk symmetrically', () => {
  const mockRepos = [
    {
      id: 1,
      name: 'towerdesk-backend-clean',
      full_name: 'SalAkBuK/towerdesk-backend-clean',
      description: 'Backend platform',
      html_url: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
      homepage: null,
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      language: 'TypeScript',
      topics: ['nestjs', 'prisma', 'postgresql'],
      size: 1000,
      archived: false,
      default_branch: 'main',
      license: null,
      owner: { login: 'SalAkBuK' }
    },
    {
      id: 2,
      name: 'worthy-crm',
      full_name: 'SalAkBuK/worthy-crm',
      description: 'PHP CRM',
      html_url: 'https://github.com/SalAkBuK/worthy-crm',
      homepage: null,
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      language: 'PHP',
      topics: [],
      size: 1000,
      archived: false,
      default_branch: 'main',
      license: null,
      owner: { login: 'SalAkBuK' }
    }
  ];

  const projects = mockRepos.map((r, i) => transformGitHubRepoToProject(r as any, i, mockRepos.length));
  const { skills } = generateGitHubProfileDetails(projects, null, 'SalAkBuK');

  const nodeSkill = skills.find(s => s.name.includes('Node.js'));
  assert.ok(nodeSkill, 'Node.js capability must be generated');
  assert.ok(nodeSkill.usedInProjects.includes('gh-1'), 'Node.js capability must include towerdesk-backend-clean');
  assert.ok(!nodeSkill.usedInProjects.includes('gh-2'), 'Node.js capability must not include worthy-crm');

  const phpSkill = skills.find(s => s.name.includes('PHP'));
  assert.ok(phpSkill, 'PHP capability must be generated');
  assert.ok(phpSkill.usedInProjects.includes('gh-2'), 'PHP capability must include worthy-crm');
  assert.ok(!phpSkill.usedInProjects.includes('gh-1'), 'PHP capability must not include towerdesk-backend-clean');

  const towerdeskProj = projects.find(p => p.id === 'gh-1')!;
  assert.ok(towerdeskProj.infrastructureDeps.includes(nodeSkill.id), 'TowerDesk infrastructureDeps must contain Node.js skill ID');

  const worthyProj = projects.find(p => p.id === 'gh-2')!;
  assert.ok(worthyProj.infrastructureDeps.includes(phpSkill.id), 'Worthy CRM infrastructureDeps must contain PHP skill ID');
});

test('13. Hono + TypeScript alone does NOT imply Node.js runtime', () => {
  const honoProject: Partial<ProjectData> = {
    id: 'proj-hono',
    title: 'Hono Edge Worker',
    techStack: ['Hono', 'TypeScript']
  };

  assert.equal(projectUsesCapability(honoProject, 'Node.js'), false, 'Hono alone must not infer Node.js runtime');
});

test('14. Hono + explicit Node.js DOES associate with Node.js', () => {
  const honoNodeProject: Partial<ProjectData> = {
    id: 'proj-hono-node',
    title: 'Hono Node Service',
    techStack: ['Hono', 'Node.js', 'TypeScript']
  };

  assert.equal(projectUsesCapability(honoNodeProject, 'Node.js'), true, 'Explicit Node.js must associate normally');
});

test('15. null endDate means explicitly current / PRESENT', () => {
  const currentRole: ExperienceNode = {
    id: 'exp-current',
    code: 'EXP-01',
    role: 'Lead Engineer',
    organization: 'Acme Corp',
    location: 'Remote',
    yearRange: 'December 2025 - Present',
    startDate: '2025-12',
    endDate: null,
    systemDomain: 'Core Platform',
    keyOutputs: [],
    systemsArchitected: [],
    technologies: ['Node.js'],
    gridPosition: { x: 0, y: 0 }
  };

  const formatted = formatRolePeriod(currentRole);
  assert.equal(formatted, 'DEC 2025 → PRESENT');
});

test('16. undefined endDate does NOT synthesize PRESENT', () => {
  const undatedEndRole: ExperienceNode = {
    id: 'exp-undated-end',
    code: 'EXP-02',
    role: 'Consultant',
    organization: 'Past Org',
    location: 'Remote',
    yearRange: 'January 2024 - April 2024',
    startDate: '2024-01',
    endDate: undefined,
    systemDomain: 'Consulting',
    keyOutputs: [],
    systemsArchitected: [],
    technologies: ['Node.js'],
    gridPosition: { x: 0, y: 0 }
  };

  const formatted = formatRolePeriod(undatedEndRole);
  assert.equal(formatted, 'JANUARY 2024 → APRIL 2024');
  assert.ok(!formatted.includes('PRESENT'), 'Undefined endDate must not synthesize PRESENT');

  // Case with no yearRange fallback
  const noYearRangeRole: ExperienceNode = {
    ...undatedEndRole,
    yearRange: ''
  };
  const formattedNoYearRange = formatRolePeriod(noYearRangeRole);
  assert.equal(formattedNoYearRange, 'JAN 2024');
  assert.ok(!formattedNoYearRange.includes('PRESENT'));
});

test('17. Discontinuous career periods remain separate and do NOT collapse into one span', () => {
  const discontinuousRoles: ExperienceNode[] = [
    {
      id: 'exp-role-1',
      code: 'EXP-01',
      role: 'Web Development Intern (MERN Stack)',
      organization: 'Devinity Solutions',
      location: 'Islamabad, Pakistan',
      yearRange: 'July 2024 - September 2024',
      startDate: '2024-07',
      endDate: '2024-09',
      systemDomain: 'Full-Stack Systems',
      keyOutputs: [],
      systemsArchitected: [],
      technologies: ['Node.js', 'Express.js', 'React', 'MongoDB'],
      gridPosition: { x: 140, y: -40 }
    },
    {
      id: 'exp-role-2',
      code: 'EXP-02',
      role: 'Full Stack Engineer',
      organization: 'CodeFier',
      location: 'Islāmābād, Pakistan',
      yearRange: 'December 2025 - Present',
      startDate: '2025-12',
      endDate: null,
      systemDomain: 'Full-Stack Systems',
      keyOutputs: [],
      systemsArchitected: [],
      technologies: ['Next.js', 'React', 'PostgreSQL', 'Node.js'],
      gridPosition: { x: -140, y: -40 }
    }
  ];

  const nodeHistory = getCapabilityProfessionalHistory('Node.js & Application Architecture', discontinuousRoles);

  assert.equal(nodeHistory.hasEvidence, true);
  assert.equal(nodeHistory.roleCount, 2);
  assert.equal(nodeHistory.periodCount, 2);

  // Must NOT produce "JUL 2024 → PRESENT"
  assert.notEqual(nodeHistory.timeSpan, 'JUL 2024 → PRESENT', 'Discontinuous periods must not collapse into continuous range');

  // Must represent both distinct periods
  assert.equal(nodeHistory.timeSpan, 'JUL 2024 → SEP 2024 · DEC 2025 → PRESENT');
  assert.equal(nodeHistory.periods.length, 2);
  assert.equal(nodeHistory.periods[0].formattedPeriod, 'JUL 2024 → SEP 2024');
  assert.equal(nodeHistory.periods[1].formattedPeriod, 'DEC 2025 → PRESENT');
});

test('18. Resolved portfolio career produces separate periods for Node.js', () => {
  const resolvedExperience = resolveProfessionalExperience();
  const nodeHistory = getCapabilityProfessionalHistory('Node.js & Application Architecture', resolvedExperience);

  assert.equal(nodeHistory.hasEvidence, true);
  assert.equal(nodeHistory.provenance, 'DERIVED');
  assert.equal(nodeHistory.roleCount, 2);
  assert.equal(nodeHistory.periodCount, 2);
  assert.equal(nodeHistory.timeSpan, 'JUL 2024 → SEP 2024 · DEC 2025 → PRESENT');

  // Test Go capability (not in career history)
  const goHistory = getCapabilityProfessionalHistory('Go & Systems Architecture', resolvedExperience);
  assert.equal(goHistory.hasEvidence, false);
  assert.equal(goHistory.timeSpan, 'UNAVAILABLE');
  assert.equal(goHistory.roleCount, 0);
  assert.equal(goHistory.provenance, 'UNAVAILABLE');
});
