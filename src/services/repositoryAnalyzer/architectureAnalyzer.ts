import { EvidenceProvenance, SubsystemNode, SystemCategory } from '../../types';
import { 
  AnalyzedArchitecture, 
  AnalyzedDependencies, 
  AnalyzedDocumentation, 
  RawRepositoryInspection 
} from './types';

/**
 * Helper to construct a subsystem node with 3D bounds
 */
function createSubsystemNode(
  id: string,
  name: string,
  category: SubsystemNode['category'],
  role: string,
  description: string,
  tech: string[],
  x: number,
  y: number,
  protocol?: string,
  provenance: EvidenceProvenance = 'VERIFIED'
): SubsystemNode {
  return {
    id,
    name,
    category,
    role,
    protocol,
    description,
    tech,
    coordinates: { x, y, z: 28 },
    dimensions: { width: 48, height: 26, depth: 34 },
    provenance
  };
}

/**
 * Coordinate layout presets for 1 to 6 subsystems to prevent visual overlapping on the isometric canvas
 */
const COORDINATE_PRESETS: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: 0, y: 0 }],
  2: [{ x: -40, y: -20 }, { x: 40, y: 20 }],
  3: [{ x: -50, y: -25 }, { x: 40, y: -25 }, { x: 0, y: 35 }],
  4: [{ x: -52, y: -28 }, { x: 42, y: -30 }, { x: 0, y: 10 }, { x: -15, y: 42 }],
  5: [{ x: -58, y: -28 }, { x: 0, y: -38 }, { x: 58, y: -20 }, { x: -35, y: 35 }, { x: 34, y: 38 }],
  6: [{ x: -60, y: -30 }, { x: 0, y: -35 }, { x: 60, y: -25 }, { x: -45, y: 30 }, { x: 10, y: 35 }, { x: 55, y: 30 }]
};

export function analyzeArchitecture(
  inspection: RawRepositoryInspection,
  documentation: AnalyzedDocumentation,
  dependencies: AnalyzedDependencies
): AnalyzedArchitecture {
  const discoveredSubsystems: SubsystemNode[] = [];
  const detectedLayers: string[] = [];
  const repoName = inspection.repoName || 'repo';
  const repoSlug = repoName.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  const feFrameworks = dependencies.frameworks.frontend;
  const beFrameworks = dependencies.frameworks.backend;
  const dbFrameworks = dependencies.frameworks.database;
  const testFrameworks = dependencies.frameworks.testing;
  const devopsFrameworks = dependencies.frameworks.devops;

  // Determine Category and multi-classifications from semantic purpose, documentation, topics, and frameworks
  const purposeText = `${repoName} ${inspection.description || ''} ${documentation.challenge?.text || ''} ${documentation.solution?.text || ''} ${(inspection.topics || []).join(' ')}`.toLowerCase();

  const strongToolingTopics = [
    'cli', 'devtools', 'developer-tools', 'linter', 'compiler', 'parser',
    'generator', 'fuzzer', 'test-runner', 'resilience-testing', 'workbench',
    'testing-tool', 'benchmarking'
  ];

  const strongToolingPhrases = [
    'testing workbench', 'resilience-testing', 'resilience testing',
    'chaos engineering', 'developer tool', 'developer tooling', 'devtools',
    'dev tool', 'cli tool', 'cli utility', 'command line tool', 'command-line interface',
    'code generator', 'code generation', 'scaffolding tool', 'compiler',
    'transpiler', 'linter', 'parser', 'ast parser', 'fuzzer', 'profiler',
    'test runner', 'benchmarking harness'
  ];

  const hasToolingTopic = (inspection.topics || []).some(t => strongToolingTopics.includes(t.toLowerCase()));
  const hasToolingPhrase = strongToolingPhrases.some(phrase => purposeText.includes(phrase));
  const isToolingLang = ['shell', 'bash', 'makefile', 'nix', 'lua', 'powershell', 'dockerfile'].includes((inspection.language || '').toLowerCase());
  
  const isToolingPurpose = hasToolingTopic || hasToolingPhrase || (isToolingLang && !feFrameworks.length && !beFrameworks.length);

  const strongInfraTopics = ['k8s', 'kubernetes', 'docker', 'terraform', 'ansible', 'helm', 'infrastructure', 'cloud-native', 'service-mesh'];
  const strongInfraPhrases = ['infrastructure as code', 'kubernetes operator', 'cloud infrastructure', 'cluster orchestration', 'service mesh'];
  const hasInfraTopic = (inspection.topics || []).some(t => strongInfraTopics.includes(t.toLowerCase()));
  const hasInfraPhrase = strongInfraPhrases.some(phrase => purposeText.includes(phrase));
  const isInfraPurpose = hasInfraTopic || hasInfraPhrase;

  const frontendMarkers = ['react', 'vue', 'svelte', 'ui', 'frontend', 'nextjs', 'next.js', 'remix', 'astro', 'tailwind'];
  const hasFrontend = feFrameworks.length > 0 || (inspection.topics || []).some(t => frontendMarkers.includes(t.toLowerCase())) || purposeText.includes('dashboard') || purposeText.includes('frontend');

  const backendMarkers = ['api', 'backend', 'server', 'fastify', 'express', 'nestjs', 'django', 'flask', 'gin', 'actix', 'spring'];
  const hasBackend = beFrameworks.length > 0 || (inspection.topics || []).some(t => backendMarkers.includes(t.toLowerCase())) || purposeText.includes('backend') || purposeText.includes('server') || purposeText.includes('microservice');

  const hasDatabase = dbFrameworks.length > 0 || (inspection.topics || []).some(t => ['prisma', 'postgres', 'sqlite', 'redis', 'db', 'mysql', 'mongodb'].includes(t.toLowerCase()));
  const hasInfra = isInfraPurpose || devopsFrameworks.includes('Docker') || hasInfraTopic;

  const matchingClassifications: SystemCategory[] = [];
  if (isToolingPurpose) matchingClassifications.push('tooling');
  if (hasInfra) matchingClassifications.push('infrastructure');
  if (hasFrontend) matchingClassifications.push('frontend');
  if (hasBackend || hasDatabase) matchingClassifications.push('backend');
  if (hasFrontend && (hasBackend || hasDatabase)) matchingClassifications.push('fullstack');

  // Determine Primary Category
  let category: SystemCategory = 'fullstack';
  if (isToolingPurpose) {
    category = 'tooling';
  } else if (isInfraPurpose) {
    category = 'infrastructure';
  } else if (hasFrontend && (hasBackend || hasDatabase)) {
    category = 'fullstack';
  } else if (hasFrontend) {
    category = 'frontend';
  } else if (hasBackend || hasDatabase) {
    category = 'backend';
  } else {
    // Weak language fallback
    const lang = (inspection.language || '').toLowerCase();
    if (['go', 'rust', 'python', 'java', 'c#', 'php'].includes(lang)) category = 'backend';
    else if (['html', 'css', 'vue', 'svelte', 'dart'].includes(lang)) category = 'frontend';
    else if (['shell', 'bash', 'makefile', 'nix', 'lua', 'powershell', 'dockerfile'].includes(lang)) category = 'tooling';
    else category = 'fullstack';
  }

  const classifications: SystemCategory[] = Array.from(new Set([category, ...matchingClassifications]));

  // --- STRATEGY 1: EXPLICIT DOCUMENTATION COMPONENTS (Highest Fidelity) ---
  if (documentation.explicitComponents.length > 0) {
    const rawComps = documentation.explicitComponents.slice(0, 6);
    const coords = COORDINATE_PRESETS[rawComps.length] || COORDINATE_PRESETS[4];

    rawComps.forEach((comp, idx) => {
      let subCat: SubsystemNode['category'] = 'backend';
      const text = `${comp.name} ${comp.role || ''} ${comp.description || ''} ${comp.path || ''}`.toLowerCase();
      
      if (text.includes('dashboard') || text.includes('ui') || text.includes('client') || text.includes('frontend') || text.includes('checkout')) {
        subCat = 'frontend';
      } else if (text.includes('store') || text.includes('database') || text.includes('sqlite') || text.includes('postgres') || text.includes('db')) {
        subCat = 'database';
      } else if (text.includes('runner') || text.includes('worker') || text.includes('playwright') || text.includes('queue') || text.includes('job')) {
        subCat = 'worker';
      } else if (text.includes('auth') || text.includes('identity')) {
        subCat = 'auth';
      } else if (text.includes('telemetry') || text.includes('test') || text.includes('contract') || text.includes('config')) {
        subCat = 'telemetry';
      }

      const pos = coords[idx] || { x: (idx - 2) * 35, y: (idx % 2 === 0 ? -25 : 30) };

      discoveredSubsystems.push(
        createSubsystemNode(
          `${repoSlug}-${idx + 1}-${comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          comp.name,
          subCat,
          comp.role || comp.description || 'System component',
          comp.description || `Module responsible for ${comp.name.toLowerCase()} operations.`,
          comp.tech && comp.tech.length > 0 ? comp.tech : (inspection.language ? [inspection.language] : ['TypeScript']),
          pos.x,
          pos.y,
          comp.protocol,
          'VERIFIED'
        )
      );
    });

    if (discoveredSubsystems.length > 0) {
      return {
        subsystems: discoveredSubsystems,
        category,
        classifications,
        detectedLayers: discoveredSubsystems.map(s => s.name),
        provenance: 'VERIFIED',
        architectureSummary: documentation.solution?.text || `${discoveredSubsystems.length} modular subsystems discovered from repository structure and documentation.`
      };
    }
  }

  // --- STRATEGY 2: MONOREPO WORKSPACES / DIRECTORY STRUCTURE ---
  if (inspection.treeFiles && inspection.treeFiles.length > 0) {
    const files = inspection.treeFiles;
    const apps = Array.from(new Set(
      files.filter(f => f.startsWith('apps/')).map(f => f.split('/')[1]).filter(Boolean)
    ));
    const packages = Array.from(new Set(
      files.filter(f => f.startsWith('packages/')).map(f => f.split('/')[1]).filter(Boolean)
    ));
    const services = Array.from(new Set(
      files.filter(f => f.startsWith('services/')).map(f => f.split('/')[1]).filter(Boolean)
    ));

    const discoveredModules: Array<{ name: string; category: SubsystemNode['category']; role: string; tech: string[]; protocol?: string }> = [];

    apps.forEach(app => {
      const cleanName = app.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      const isUi = /dashboard|web|client|ui|frontend|app/i.test(app);
      const isServer = /server|api|backend|gateway/i.test(app);
      
      discoveredModules.push({
        name: `${cleanName} App`,
        category: isUi ? 'frontend' : (isServer ? 'backend' : 'worker'),
        role: isUi ? 'Client presentation interface' : (isServer ? 'Core application server' : 'Application workload service'),
        tech: isUi ? (feFrameworks.length > 0 ? feFrameworks : ['React / TypeScript']) : (beFrameworks.length > 0 ? beFrameworks : ['Node.js / TypeScript']),
        protocol: isServer ? 'HTTPS / REST' : undefined
      });
    });

    services.forEach(srv => {
      const cleanName = srv.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      discoveredModules.push({
        name: `${cleanName} Service`,
        category: 'backend',
        role: 'Distributed domain service',
        tech: beFrameworks.length > 0 ? beFrameworks : ['Backend Service'],
        protocol: 'HTTPS / REST'
      });
    });

    packages.forEach(pkg => {
      const cleanName = pkg.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      discoveredModules.push({
        name: `Shared ${cleanName}`,
        category: 'telemetry',
        role: 'Shared contracts, utilities, and configuration',
        tech: ['TypeScript Package']
      });
    });

    if (discoveredModules.length > 0) {
      const selected = discoveredModules.slice(0, 6);
      const coords = COORDINATE_PRESETS[selected.length] || COORDINATE_PRESETS[4];

      selected.forEach((mod, idx) => {
        const pos = coords[idx] || { x: (idx - 2) * 35, y: (idx % 2 === 0 ? -25 : 30) };
        discoveredSubsystems.push(
          createSubsystemNode(
            `${repoSlug}-mono-${idx + 1}`,
            mod.name,
            mod.category,
            mod.role,
            `Monorepo workspace package providing ${mod.name.toLowerCase()} capabilities.`,
            mod.tech,
            pos.x,
            pos.y,
            mod.protocol,
            'VERIFIED'
          )
        );
      });

      return {
        subsystems: discoveredSubsystems,
        category: 'fullstack',
        classifications: Array.from(new Set(['fullstack', ...classifications])),
        detectedLayers: discoveredSubsystems.map(s => s.name),
        provenance: 'VERIFIED',
        architectureSummary: `${discoveredSubsystems.length} monorepo workspaces and shared packages detected across apps/ and packages/.`
      };
    }
  }

  // --- STRATEGY 3: VERIFIED FRAMEWORKS & ECOSYSTEM (Derived from package.json & codebase signals) ---
  const dynamicNodes: Array<{ name: string; category: SubsystemNode['category']; role: string; tech: string[]; protocol?: string }> = [];

  if (feFrameworks.length > 0) {
    dynamicNodes.push({
      name: `${feFrameworks[0]} Client Surface`,
      category: 'frontend',
      role: 'Client rendering, UI components, and state synchronization',
      tech: feFrameworks,
      protocol: undefined
    });
  }

  if (beFrameworks.length > 0) {
    const proto = beFrameworks.includes('Socket.IO') ? 'WebSocket' : 'HTTPS / REST';
    dynamicNodes.push({
      name: `${beFrameworks[0]} Backend Service`,
      category: 'backend',
      role: 'Business transactions, routing, and workflow orchestration',
      tech: beFrameworks,
      protocol: proto
    });
  }

  if (dbFrameworks.length > 0) {
    const proto = dbFrameworks.includes('SQLite') || dbFrameworks.includes('better-sqlite3') ? 'SQLite' : (dbFrameworks.includes('Prisma') || dbFrameworks.includes('PostgreSQL') ? 'PostgreSQL' : undefined);
    dynamicNodes.push({
      name: `${dbFrameworks[0]} Schema Store`,
      category: 'database',
      role: 'Persistent storage, schema invariants, and data models',
      tech: dbFrameworks,
      protocol: proto
    });
  }

  if (devopsFrameworks.includes('Docker') || devopsFrameworks.includes('GitHub Actions')) {
    dynamicNodes.push({
      name: 'Deployment & CI Matrix',
      category: 'telemetry',
      role: 'Continuous integration, container runtime, and build pipelines',
      tech: devopsFrameworks,
      protocol: 'GitHub Actions'
    });
  }

  if (dynamicNodes.length > 0) {
    const coords = COORDINATE_PRESETS[dynamicNodes.length] || COORDINATE_PRESETS[3];
    dynamicNodes.forEach((node, idx) => {
      const pos = coords[idx] || { x: (idx - 1) * 45, y: 0 };
      discoveredSubsystems.push(
        createSubsystemNode(
          `${repoSlug}-layer-${idx + 1}`,
          node.name,
          node.category,
          node.role,
          `Architectural tier derived from verified ${node.tech.join(', ')} configuration.`,
          node.tech,
          pos.x,
          pos.y,
          node.protocol,
          'DERIVED'
        )
      );
    });

    return {
      subsystems: discoveredSubsystems,
      category,
      classifications,
      detectedLayers: discoveredSubsystems.map(s => s.name),
      provenance: 'DERIVED',
      architectureSummary: `Layered architecture decomposed into ${discoveredSubsystems.map(s => s.name).join(', ')}.`
    };
  }

  // --- STRATEGY 4: SPARSE / SINGLE PURPOSE CODEBASE (Truthful Unavailable or Minimal) ---
  const primaryLang = inspection.language || 'Codebase';
  if (inspection.sizeKb && inspection.sizeKb > 0) {
    // If it's a real repo with size, create single focused root module rather than fake multi-tier architecture
    discoveredSubsystems.push(
      createSubsystemNode(
        `${repoSlug}-core`,
        `${repoName} Core Module`,
        category === 'frontend' ? 'frontend' : (category === 'backend' ? 'backend' : 'worker'),
        `Primary ${primaryLang} codebase implementation`,
        `Single-tier codebase in ${primaryLang}. No separate distributed sub-services detected.`,
        [primaryLang],
        0,
        0,
        undefined,
        'VERIFIED'
      )
    );

    return {
      subsystems: discoveredSubsystems,
      category,
      classifications,
      detectedLayers: [`${primaryLang} Implementation`],
      provenance: 'VERIFIED',
      architectureSummary: `Single-tier ${primaryLang} codebase without distributed microservice boundaries.`
    };
  }

  return {
    subsystems: [],
    category,
    classifications,
    detectedLayers: [],
    provenance: 'UNAVAILABLE',
    architectureSummary: 'Architecture not established from available repository evidence.'
  };
}
