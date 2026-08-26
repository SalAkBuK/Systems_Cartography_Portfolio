import { ArchitecturePrinciple, ExperienceNode, InfrastructureSkill, OperatorMetadata, ProjectData, SystemCategory } from '../types';
import { getRepositoryEvidence } from './repositoryEvidence';

export const VERIFIED_OPERATOR_METADATA: OperatorMetadata = {
  name: 'Salih Mohammad Bukhari',
  handle: '@SalAkBuK',
  role: 'Full-Stack Developer',
  location: 'Rawalpindi, Pakistan',
  status: 'CV VERIFIED // GITHUB LINKED',
  focus: 'Product-oriented web and mobile systems spanning frontend, mobile, backend APIs, and data flows.',
  yearsActive: 0,
  commitsIndexed: 'Not indexed',
  productionUptime: 'Not claimed',
  primaryStack: ['JavaScript / TypeScript', 'React', 'React Native', 'Node.js', 'NestJS', 'PostgreSQL'],
  systemManifesto: 'Hands-on developer building modern web and mobile products with React, React Native, Node.js, and NestJS, with a focus on end-to-end product delivery, API design, and scalable backend architecture.',
  contact: {
    email: 'bukharian1776@gmail.com',
    github: 'https://github.com/SalAkBuK',
    linkedin: '',
    pgpKeyId: '',
    pgpFingerprint: '',
    matrix: '',
    availability: 'Contact for current availability'
  }
};

type VerifiedProjectInput = {
  id: string;
  title: string;
  tagline: string;
  category: SystemCategory;
  techStack: string[];
  summary: string;
  solution: string;
  demo?: string;
  repository?: string;
  docs?: string;
};

function verifiedProject(input: VerifiedProjectInput, index: number): ProjectData {
  const positions = [
    { x: -160, y: -90 },
    { x: 140, y: -110 },
    { x: -210, y: 120 },
    { x: 160, y: 100 },
    { x: 0, y: 190 }
  ];
  const colors = ['#8EA9DA', '#C3E54E', '#CA885C', '#8CD1C8', '#A78BFA'];
  const project: ProjectData = {
    id: input.id,
    code: `P${String(index + 1).padStart(2, '0')}`,
    title: input.title,
    tagline: input.tagline,
    category: input.category,
    status: 'ACTIVE',
    year: 'CV listed',
    dimensions: { width: 95, height: 68, levels: 2 },
    gridPosition: positions[index],
    accentColor: colors[index],
    summary: input.summary,
    problem: 'Product context is summarized from the supplied CV; no additional problem statement was claimed.',
    solution: input.solution,
    architectureNotes: 'Architecture details require owner verification or repository evidence before publication.',
    techStack: input.techStack,
    infrastructureDeps: [],
    subsystems: [],
    metrics: [{ label: 'Evidence', value: input.repository ? 'CV + Repo' : 'CV', note: input.repository ? 'Supplied résumé and public repository README' : 'Supplied résumé' }],
    keyDecisions: [],
    resilienceTesting: 'Not specified in the supplied CV.',
    links: {
      github: input.repository ? `https://github.com/SalAkBuK/${input.repository}` : 'https://github.com/SalAkBuK',
      demo: input.demo,
      docs: input.docs,
      caseStudy: false
    }
  };

  const evidence = input.repository ? getRepositoryEvidence(input.repository) : null;
  return evidence ? { ...project, ...evidence, links: project.links } : project;
}

export const VERIFIED_PROJECTS: ProjectData[] = [
  verifiedProject({
    id: 'verified-towerdesk-platform',
    title: 'TowerDesk Platform',
    tagline: 'Property and workspace management across web, backend, and mobile',
    category: 'fullstack',
    techStack: ['NestJS', 'Prisma', 'PostgreSQL', 'Web', 'Mobile'],
    summary: 'Full-stack property and workspace management platform spanning web, backend, and mobile components.',
    solution: 'Built NestJS, Prisma, and PostgreSQL backend services with authentication, role-aware API workflows, operations flows, management actions, and multi-user access.',
    repository: 'towerdesk-backend-clean',
    docs: 'https://github.com/SalAkBuK/tower-desk-clean'
  }, 0),
  verifiedProject({
    id: 'verified-towerdesk-app',
    title: 'TowerDesk App',
    tagline: 'Concierge mobile app for tenant, management, and staff portals',
    category: 'frontend',
    techStack: ['React Native', 'Expo Router'],
    summary: 'Concierge mobile application with tenant, management, and staff portals.',
    solution: 'Implemented notifications, messaging, and service-request workflows connected to backend APIs.',
    repository: 'towerdesk-mobile-showcase'
  }, 1),
  verifiedProject({
    id: 'verified-pillcheck',
    title: 'PillCheck',
    tagline: 'Medication management with reminders, inventory, and caregiver support',
    category: 'fullstack',
    techStack: ['React Native', 'Node.js', 'PostgreSQL'],
    summary: 'Medication management app with reminders, inventory monitoring, and caregiver support features.',
    solution: 'Created backend workflows for scheduling, user data handling, and prescription tracking.',
    repository: 'pillcheck-public'
  }, 2),
  verifiedProject({
    id: 'verified-aok-health',
    title: 'AOK Health Solutions',
    tagline: 'Responsive healthcare website',
    category: 'frontend',
    techStack: ['Responsive Frontend', 'UI / UX'],
    summary: 'Responsive healthcare website focused on clean structure, polished UI, and performance.',
    solution: 'Designed and deployed the responsive frontend.',
    demo: 'https://aokhealthsolutions.com'
  }, 3),
  verifiedProject({
    id: 'verified-psych-websites',
    title: 'Psych Websites',
    tagline: 'Modular multi-frontend web experiences',
    category: 'frontend',
    techStack: ['React', 'Next.js', 'Vite'],
    summary: 'Multi-frontend web experiences with responsive layouts and modular component structure.',
    solution: 'Built responsive interfaces across React, Next.js, and Vite.'
  }, 4)
];

const skillNames: Array<[string, SystemCategory]> = [
  ['JavaScript / TypeScript', 'fullstack'],
  ['React / Next.js / Vite', 'frontend'],
  ['React Native / Expo', 'frontend'],
  ['Node.js / NestJS / Express', 'backend'],
  ['PostgreSQL / MongoDB / Prisma', 'infrastructure'],
  ['Python / Playwright', 'tooling']
];

export const VERIFIED_SKILLS: InfrastructureSkill[] = skillNames.map(([name, category], index) => ({
  id: `verified-skill-${index + 1}`,
  code: `INF-${String(index + 1).padStart(2, '0')}`,
  name,
  category,
  yearsActive: 0,
  proficiencyScore: 0,
  gridPosition: { x: (index % 3 - 1) * 90, y: (Math.floor(index / 3) * 2 - 1) * 55 },
  systemCount: VERIFIED_PROJECTS.filter(project => project.techStack.some(tech => name.includes(tech) || tech.includes(name.split(' / ')[0]))).length,
  usedInProjects: VERIFIED_PROJECTS.filter(project => project.techStack.some(tech => name.includes(tech) || tech.includes(name.split(' / ')[0]))).map(project => project.id),
  primaryUseCases: ['Listed in the supplied CV'],
  technicalHighlights: ['No proficiency percentage or years inferred'],
  samplePattern: '// Evidence source: supplied CV'
}));

export const VERIFIED_EXPERIENCE: ExperienceNode[] = [
  {
    id: 'verified-exp-projects',
    code: 'CV-01',
    yearRange: 'SELECTED PROJECTS',
    role: 'Full-Stack Developer',
    organization: 'Project Portfolio',
    location: 'Rawalpindi, Pakistan',
    systemDomain: 'Web, Mobile, Backend APIs, and Data',
    keyOutputs: [
      'Built product-oriented web and mobile systems.',
      'Implemented authentication, role-aware workflows, notifications, messaging, scheduling, and data handling.',
      'Designed responsive interfaces and modular frontend structures.'
    ],
    systemsArchitected: VERIFIED_PROJECTS.map(project => project.title),
    technologies: VERIFIED_OPERATOR_METADATA.primaryStack,
    gridPosition: { x: -240, y: 140 }
  },
  {
    id: 'verified-exp-additional',
    code: 'CV-02',
    yearRange: 'ADDITIONAL EXPERIENCE',
    role: 'Developer and Volunteer Teacher',
    organization: 'Independent / Anjuman Faizul Islam Orphanage',
    location: 'Pakistan',
    systemDomain: 'Automation, Data Analysis, Smart Contracts, and Teaching',
    keyOutputs: [
      'Developed Python and Playwright browser-automation scripts.',
      'Built Python preprocessing, visualization, and analysis workflows.',
      'Developed and deployed an ERC-721 NFT smart contract using Solidity and Remix IDE.'
    ],
    systemsArchitected: ['Automation workflows', 'Data-analysis workflows', 'ERC-721 smart contract'],
    technologies: ['Python', 'Playwright', 'Solidity', 'Remix IDE'],
    gridPosition: { x: -170, y: 175 }
  }
];

export const VERIFIED_ARCHITECTURE_PRINCIPLES: ArchitecturePrinciple[] = [
  {
    id: 'verified-principle-01',
    number: '01',
    title: 'Scope Access Before Data Mutation',
    summary: 'Resolve identity, tenant, building, and role boundaries before returning or changing records.',
    elaboration: 'Documented in the TowerDesk backend repository as the core multi-tenant boundary, supported by JWT, organization, building, permission, owner, and provider guards.',
    appliedIn: ['verified-towerdesk-platform']
  },
  {
    id: 'verified-principle-02',
    number: '02',
    title: 'Separate Interactive and Background Work',
    summary: 'Keep HTTP request handling distinct from scheduled or delivery workloads.',
    elaboration: 'TowerDesk documents separate API and worker bootstraps; PillCheck documents a worker for dose generation, overdue checks, and refill checks.',
    appliedIn: ['verified-towerdesk-platform', 'verified-pillcheck']
  },
  {
    id: 'verified-principle-03',
    number: '03',
    title: 'Keep Secrets at the Server Boundary',
    summary: 'Proxy privileged operations through server-owned routes and publish sanitized portfolio snapshots.',
    elaboration: 'The TowerDesk web repository keeps platform-key calls in Next.js server routes, while the web and mobile showcases explicitly exclude production credentials and private contracts.',
    appliedIn: ['verified-towerdesk-platform', 'verified-towerdesk-app']
  },
  {
    id: 'verified-principle-04',
    number: '04',
    title: 'Publish Verifiable Claims',
    summary: 'Use CV statements, repository documentation, code, and test configuration as evidence; leave business outcomes unclaimed until supplied.',
    elaboration: 'This portfolio distinguishes verified repository structure and GitHub metadata from owner-confirmed dates, production metrics, and private contact channels.',
    appliedIn: VERIFIED_PROJECTS.map(project => project.id)
  }
];

export const VERIFIED_TOPOLOGY_ZONES = [
  {
    id: 'verified-zone-fullstack',
    name: 'ZONE A // FULL-STACK PRODUCT SYSTEMS',
    bounds: { x: -220, y: -140, width: 170, height: 160 },
    code: 'SRC-01',
    description: 'CV-listed systems spanning client applications, APIs, persistence, and background work'
  },
  {
    id: 'verified-zone-interface',
    name: 'ZONE B // WEB & MOBILE INTERFACES',
    bounds: { x: 0, y: -160, width: 190, height: 160 },
    code: 'SRC-02',
    description: 'Responsive React, Next.js, Vite, React Native, and Expo interfaces'
  },
  {
    id: 'verified-zone-service',
    name: 'ZONE C // API & DATA SERVICES',
    bounds: { x: -220, y: 30, width: 180, height: 160 },
    code: 'SRC-03',
    description: 'NestJS and Node.js workflows backed by PostgreSQL, MongoDB, and Prisma'
  },
  {
    id: 'verified-zone-tools',
    name: 'ZONE D // AUTOMATION & PUBLIC REPOS',
    bounds: { x: 0, y: 30, width: 190, height: 160 },
    code: 'SRC-04',
    description: 'Python, Playwright, data-analysis, smart-contract, and linked GitHub work'
  }
];
