import { ExperienceNode, InfrastructureSkill, OperatorMetadata, ProjectData, SystemCategory } from '../types';

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
  return {
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
    metrics: [{ label: 'Evidence', value: 'CV', note: 'Supplied résumé' }],
    keyDecisions: [],
    resilienceTesting: 'Not specified in the supplied CV.',
    links: {
      github: 'https://github.com/SalAkBuK',
      demo: input.demo,
      caseStudy: false
    }
  };
}

export const VERIFIED_PROJECTS: ProjectData[] = [
  verifiedProject({
    id: 'verified-towerdesk-platform',
    title: 'TowerDesk Platform',
    tagline: 'Property and workspace management across web, backend, and mobile',
    category: 'fullstack',
    techStack: ['NestJS', 'Prisma', 'PostgreSQL', 'Web', 'Mobile'],
    summary: 'Full-stack property and workspace management platform spanning web, backend, and mobile components.',
    solution: 'Built NestJS, Prisma, and PostgreSQL backend services with authentication, role-aware API workflows, operations flows, management actions, and multi-user access.'
  }, 0),
  verifiedProject({
    id: 'verified-towerdesk-app',
    title: 'TowerDesk App',
    tagline: 'Concierge mobile app for tenant, management, and staff portals',
    category: 'frontend',
    techStack: ['React Native', 'Expo Router'],
    summary: 'Concierge mobile application with tenant, management, and staff portals.',
    solution: 'Implemented notifications, messaging, and service-request workflows connected to backend APIs.'
  }, 1),
  verifiedProject({
    id: 'verified-pillcheck',
    title: 'PillCheck',
    tagline: 'Medication management with reminders, inventory, and caregiver support',
    category: 'fullstack',
    techStack: ['React Native', 'Node.js', 'PostgreSQL'],
    summary: 'Medication management app with reminders, inventory monitoring, and caregiver support features.',
    solution: 'Created backend workflows for scheduling, user data handling, and prescription tracking.'
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
