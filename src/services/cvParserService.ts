import { 
  ProjectData, 
  InfrastructureSkill, 
  ExperienceNode, 
  OperatorMetadata, 
  SystemCategory, 
  SystemStatus 
} from '../types';
import { getGridCoordinatesForIndex, inferAccentColor } from './githubService';

export interface ParsedCVResult {
  operator: OperatorMetadata;
  projects: ProjectData[];
  skills: InfrastructureSkill[];
  experience: ExperienceNode[];
  rawText: string;
  sourceDocument: string;
}

export type ParsedCVSyncResult = ParsedCVResult;

export const SAMPLE_CV_TEXT = `# Alex Vance
Staff Systems & Distributed Infrastructure Architect
Email: alex.vance.systems@gmail.com
Location: Seattle, WA // UTC-8
GitHub: https://github.com/alexvance-sys
LinkedIn: https://linkedin.com/in/alexvance-arch

## Professional Summary
Over 9 years architecting high-throughput distributed state machines, edge consensus engines, and Kubernetes container infrastructure. Focused on mechanical sympathy, sub-millisecond p99 latency boundaries, and zero-downtime deployment invariants.

## Core Technical Skills
- Languages: Go, Rust, TypeScript, C++, Python
- Infrastructure: Kubernetes, Docker, Helm, eBPF, Linux Kernel, Terraform
- Databases & Queues: PostgreSQL, ClickHouse, Apache Kafka, Redis, SQLite
- Protocols & Architecture: Raft, CRDTs, gRPC, Protobuf, WebSockets, WebRTC

## Key Architectural Systems & Projects
### ChronoPulse Mesh
Distributed real-time streaming pipeline processing 450k events/sec with snappy WAL compression.
- Built zero-copy binary serialization protocol using Go and memory-mapped files.
- Reduced partition recovery healing time to under 15ms.

### KubeSentinel Daemon
Kernel-level eBPF socket telemetry probe monitoring container egress bottlenecks in real time.
- Integrated directly with Linux ring buffers to extract packet telemetry without user-space context switches.
- Deployed across 200+ Kubernetes nodes with <0.3% CPU overhead.

### VertexKV Vector Store
Embedded SIMD-accelerated vector database for nearest-neighbor embeddings queries.
- Implemented HNSW graph indexing in Rust with AVX-512 vectorization.
- Sub-5ms query latency for 10M+ high-dimensional vectors.

## Work Experience
### Principal Infrastructure Architect — CoreMesh Systems (2022 — Present)
- Architected the global multi-region edge mesh coordinating 80k concurrent nodes.
- Designed automatic split-brain partition recovery algorithms using Raft and vector clocks.
- Led the platform engineering guild and established automated chaos testing suites.

### Senior Distributed Backend Engineer — Streamline Data Corp (2019 — 2022)
- Engineered event-driven ingest pipelines processing 2.5B records daily.
- Optimized PostgreSQL and ClickHouse queries, reducing monthly cloud egress costs by $180k.
- Built canary deployment orchestration tools with automatic metric-based rollbacks.
`;

/**
 * Procedurally parse raw resume/CV text (or Markdown/PDF text) into structured System Cartography nodes
 */
export function parseCVText(text: string, sourceName?: string): ParsedCVResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // 1. Extract Name & Role
  let name = 'Technical Candidate';
  let role = 'Staff Systems Engineer / Full-Stack Architect';
  let email = 'operator@systems.dev';
  let location = 'San Francisco, CA // UTC-7';
  let github = 'https://github.com';
  let linkedin = 'https://linkedin.com';
  let summary = '';

  // Scan top lines for Name and Role
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^#+\s*/, '').replace(/[-–|].*$/, '').trim();
    if (firstLine && firstLine.length < 50) {
      name = firstLine;
    }
  }

  // Scan for emails and links
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) email = emailMatch[0];

  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  if (githubMatch) github = `https://github.com/${githubMatch[1]}`;

  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  if (linkedinMatch) linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;

  const locMatch = text.match(/(?:Location|Address|Based in):\s*([^\n]+)/i);
  if (locMatch) location = locMatch[1].trim();

  // Scan for role title
  const roleKeywords = [
    'Staff Systems Engineer', 'Senior Software Engineer', 'Lead Architect', 
    'Principal Engineer', 'Full-Stack Developer', 'DevOps Engineer', 
    'Platform Architect', 'Backend Engineer', 'Solutions Architect'
  ];
  for (const kw of roleKeywords) {
    if (new RegExp(kw, 'i').test(text)) {
      role = kw;
      break;
    }
  }

  // Summary extraction
  const summaryMatch = text.match(/(?:Summary|About|Profile|Objective)[:\n]+([\s\S]*?)(?=(?:Experience|Skills|Projects|Education|\n\n[A-Z]))/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim().replace(/\n+/g, ' ');
  } else {
    summary = `Architectural software practitioner specializing in robust distributed services, high-integrity data pipelines, and responsive frontend systems.`;
  }

  // 2. Extract Skills
  const knownTech = [
    { name: 'TypeScript', cat: 'fullstack' as SystemCategory, highlight: 'Type-level meta-programming and strict invariants' },
    { name: 'Go / Golang', cat: 'backend' as SystemCategory, highlight: 'High-throughput concurrency, channels, and goroutines' },
    { name: 'Rust', cat: 'backend' as SystemCategory, highlight: 'Zero-cost abstractions, memory safety, and low-level CLI binaries' },
    { name: 'React & Next.js', cat: 'frontend' as SystemCategory, highlight: 'Reactive state reconciliation and high-density technical UI' },
    { name: 'PostgreSQL', cat: 'infrastructure' as SystemCategory, highlight: 'Complex indexing, schema migrations, and relational algebra' },
    { name: 'Kubernetes & Docker', cat: 'infrastructure' as SystemCategory, highlight: 'Container orchestration, Helm charts, and service meshes' },
    { name: 'Python & PyTorch', cat: 'backend' as SystemCategory, highlight: 'Data processing, neural networks, and analytical services' },
    { name: 'Kafka & Event Streams', cat: 'infrastructure' as SystemCategory, highlight: 'Decoupled event streaming and distributed pub/sub pipelines' },
    { name: 'Redis & Caching', cat: 'infrastructure' as SystemCategory, highlight: 'Low-latency in-memory data structures and distributed rate limiters' },
    { name: 'GraphQL & REST', cat: 'backend' as SystemCategory, highlight: 'Strict API contracts, schema federation, and microservices' },
    { name: 'Linux & eBPF', cat: 'infrastructure' as SystemCategory, highlight: 'Kernel telemetry probes, socket filters, and performance profiling' },
    { name: 'Tailwind CSS', cat: 'frontend' as SystemCategory, highlight: 'Ergonomic utility design systems and responsive spatial layouts' }
  ];

  const detectedSkills = knownTech.filter(item => {
    const regex = new RegExp(`\\b${item.name.replace(/[+*]/g, '\\$&').split(' ')[0]}\\b`, 'i');
    return regex.test(text);
  });

  // If few skills detected, use core fallback set
  const skillsToUse = detectedSkills.length >= 4 ? detectedSkills : knownTech.slice(0, 6);

  // Layout Skills in balanced hexagonal ring
  const skillPlinths: InfrastructureSkill[] = skillsToUse.map((tech, idx) => {
    const angle = (idx / skillsToUse.length) * Math.PI * 2;
    const radius = 90;
    const gridX = Math.round((Math.cos(angle) * radius) / 20) * 20;
    const gridY = Math.round((Math.sin(angle) * (radius * 0.7)) / 20) * 20;

    return {
      id: `cv-infra-${idx + 1}`,
      code: `INF-${(idx + 1).toString().padStart(2, '0')}`,
      name: `${tech.name} & Systems Engineering`,
      category: tech.cat,
      yearsActive: 5 + (idx % 4),
      proficiencyScore: 88 + (idx * 2) % 12,
      gridPosition: { x: gridX, y: gridY },
      systemCount: 3 + (idx % 3),
      usedInProjects: [],
      primaryUseCases: [
        `Production implementation of ${tech.name} at scale`,
        `Resilient architecture design and performance optimization`,
        `Integration with continuous delivery and observability telemetry`
      ],
      technicalHighlights: [
        tech.highlight,
        `Zero-defect runtime reliability and defensive boundaries`,
        `Automated test harnesses with high regression coverage`
      ],
      samplePattern: `// Architectural specification for ${tech.name}\nexport interface SystemInvariants {\n  readonly state: 'STABLE';\n  verifyIntegrity(): Promise<boolean>;\n}`
    };
  });

  // 3. Extract Experience
  const experience: ExperienceNode[] = [];
  const expSectionMatch = text.match(/(?:Work Experience|Experience|Employment History|Professional Experience)[:\n]+([\s\S]*?)(?=(?:Skills|Projects|Education|Certifications|\n\n[A-Z]{3,}))/i);
  
  if (expSectionMatch) {
    const expText = expSectionMatch[1];
    const expBlocks = expText.split(/\n(?=[A-Z0-9#*-])/).filter(b => b.trim().length > 30);

    expBlocks.slice(0, 4).forEach((block, idx) => {
      const bLines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const titleLine = bLines[0] || `Role at Organization ${idx + 1}`;
      
      let org = 'Technology Organization';
      let jobRole = 'Senior Systems Architect';
      let yearRange = `${2024 - idx * 2} — ${idx === 0 ? 'PRESENT' : 2026 - idx * 2}`;

      const yearMatch = block.match(/(20\d\d)\s*[-–to]+\s*(20\d\d|Present|Current)/i);
      if (yearMatch) {
        yearRange = `${yearMatch[1]} — ${yearMatch[2].toUpperCase()}`;
      }

      if (titleLine.includes('—') || titleLine.includes('-') || titleLine.includes('|') || titleLine.includes(' at ')) {
        const parts = titleLine.split(/[—\-|]| at /);
        if (parts.length >= 2) {
          jobRole = parts[0].trim();
          org = parts[1].replace(/20\d\d.*$/, '').trim();
        }
      } else {
        jobRole = titleLine;
      }

      const bulletPoints = bLines.slice(1).filter(l => l.startsWith('•') || l.startsWith('-') || l.startsWith('*')).map(l => l.replace(/^[•\-*]\s*/, ''));
      const keyOutputs = bulletPoints.length > 0 ? bulletPoints.slice(0, 4) : [
        `Architected distributed service capabilities reducing system latency by 35%.`,
        `Led technical design reviews and established zero-regression CI/CD practices.`,
        `Engineered robust observability telemetry and fault-recovery protocols.`
      ];

      const expX = -280 + idx * 75;
      const expY = 160 + idx * 25;

      experience.push({
        id: `cv-exp-${idx + 1}`,
        code: `BUILD-${(idx + 1).toString().padStart(2, '0')}`,
        yearRange,
        role: jobRole,
        organization: org,
        location: location,
        systemDomain: 'Distributed Platforms // Core Architecture',
        keyOutputs,
        systemsArchitected: [`Platform Core v${idx + 1}`, `Data Dispatcher v${idx + 1}`],
        technologies: skillsToUse.slice(0, 4).map(s => s.name),
        gridPosition: { x: expX, y: expY }
      });
    });
  }

  // Fallback experience if none parsed
  if (experience.length === 0) {
    experience.push(
      {
        id: 'cv-exp-1',
        code: 'BUILD-01',
        yearRange: '2023 — PRESENT',
        role: role,
        organization: 'High-Scale Technology Lab',
        location: location,
        systemDomain: 'Distributed Systems // Full-Stack Architecture',
        keyOutputs: [
          'Engineered low-latency distributed state reconciliation services.',
          'Reduced API cold starts by 45% through optimized runtime compilation.',
          'Built high-density reactive engineering consoles with sub-millisecond interaction.'
        ],
        systemsArchitected: ['Consensus Engine', 'Spatial UI Console'],
        technologies: skillsToUse.slice(0, 4).map(s => s.name),
        gridPosition: { x: -260, y: 140 }
      },
      {
        id: 'cv-exp-2',
        code: 'BUILD-02',
        yearRange: '2021 — 2023',
        role: 'Senior Software Engineer',
        organization: 'Platform Infrastructure Co.',
        location: location,
        systemDomain: 'Cloud Infrastructure // Backend Services',
        keyOutputs: [
          'Designed event-driven streaming pipelines handling 50k events/sec.',
          'Implemented automated database migration harnesses and canary deployments.'
        ],
        systemsArchitected: ['Stream Ingestion Gateway', 'Telemetry Agent'],
        technologies: skillsToUse.slice(2, 6).map(s => s.name),
        gridPosition: { x: -190, y: 170 }
      }
    );
  }

  // 4. Extract Projects
  const projects: ProjectData[] = [];
  const projSectionMatch = text.match(/(?:Projects|Key Systems|Portfolio|Featured Work)[:\n]+([\s\S]*?)(?=(?:Experience|Skills|Education|\n\n[A-Z]{3,}))/i);
  
  if (projSectionMatch) {
    const projText = projSectionMatch[1];
    const projBlocks = projText.split(/\n(?=[A-Z0-9#*-])/).filter(b => b.trim().length > 25);

    projBlocks.slice(0, 6).forEach((block, idx) => {
      const bLines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const titleLine = bLines[0].replace(/^#+\s*/, '').replace(/^[•\-*]\s*/, '');
      const projName = titleLine.split(/[:—\-|]/)[0].trim() || `System ${idx + 1}`;
      const projTagline = bLines[1] || `High-performance architectural system engineered with modern stack.`;
      
      const pCategory: SystemCategory = idx % 2 === 0 ? 'infrastructure' : (idx % 3 === 0 ? 'backend' : 'fullstack');
      const pAccent = inferAccentColor(null, idx);
      const pTech = skillsToUse.slice(idx % 2, (idx % 2) + 3).map(s => s.name);

      const pDeps = skillPlinths.slice(0, 2).map(s => s.id);

      projects.push({
        id: `cv-proj-${idx + 1}`,
        code: `P${(idx + 1).toString().padStart(2, '0')}`,
        title: projName,
        tagline: projTagline,
        category: pCategory,
        status: 'PRODUCTION',
        year: `${2024 - Math.floor(idx / 2)}`,
        dimensions: { width: 100, height: 75, levels: 3 },
        gridPosition: getGridCoordinatesForIndex(idx, 6),
        accentColor: pAccent,
        summary: block.replace(/\n+/g, ' ').slice(0, 300),
        problem: `Traditional solutions lacked mechanical sympathy and exhibited high latency under partition failure.`,
        solution: `Implemented an idiomatic, modular decoupled architecture with zero-allocation memory pooling and strict failure domains.`,
        architectureNotes: `Multi-tier topology: Transport layer -> In-memory B-Tree store -> Write-Ahead Log.`,
        techStack: pTech,
        infrastructureDeps: pDeps,
        subsystems: [
          {
            id: `cv-p${idx + 1}-sub-1`,
            name: `${projName} Core Kernel`,
            category: 'backend',
            role: 'State engine and concurrency coordinator',
            description: 'Coordinates state mutations with atomic memory barriers.',
            tech: pTech,
            coordinates: { x: 0, y: 0, z: 40 },
            dimensions: { width: 60, height: 35, depth: 45 },
            metrics: [{ label: 'Throughput', value: '140k ops/s' }]
          },
          {
            id: `cv-p${idx + 1}-sub-2`,
            name: `Data Dispatcher`,
            category: 'database',
            role: 'Persistent storage and serialization',
            description: 'Durable state replication with automatic failover.',
            tech: ['WAL', 'Protobuf'],
            coordinates: { x: 35, y: 30, z: 20 },
            dimensions: { width: 50, height: 25, depth: 35 },
            metrics: [{ label: 'Latency', value: '<4.2ms' }]
          }
        ],
        metrics: [
          { label: 'Uptime Tier', value: '99.98%', note: 'SLA guarantee' },
          { label: 'P99 Latency', value: '<8.5ms', note: 'Global edge cluster' },
          { label: 'Codebase Rating', value: 'Zero-defect', note: 'Strict CI matrix' }
        ],
        keyDecisions: [
          {
            decision: 'Zero-Allocation Core Loop',
            rationale: 'Eliminates GC pressure in critical path',
            tradeoff: 'Requires explicit memory recycling'
          }
        ],
        resilienceTesting: 'Chaos engineering suite simulating network partitions and packet loss.',
        links: {
          github: github,
          caseStudy: true
        }
      });
    });
  }

  // Fallback projects if none parsed
  if (projects.length === 0) {
    projects.push(
      {
        id: 'cv-proj-1',
        code: 'P01',
        title: 'NexusStream',
        tagline: 'High-throughput event aggregation & distributed telemetry pipeline',
        category: 'infrastructure',
        status: 'PRODUCTION',
        year: '2024',
        dimensions: { width: 110, height: 85, levels: 4 },
        gridPosition: { x: -160, y: -90 },
        accentColor: '#8EA9DA',
        summary: `Production-grade distributed streaming engine built for extreme throughput and sub-millisecond p99 latency.`,
        problem: `High message volume caused excessive GC pauses and queue bottlenecks in legacy microservices.`,
        solution: `Designed a lockless circular ring buffer with zero-copy socket transfers and Snappy log compaction.`,
        architectureNotes: `Layered topology: Ingress socket -> Ring buffer -> Disk commit WAL -> Prometheus exporter.`,
        techStack: skillsToUse.slice(0, 3).map(s => s.name),
        infrastructureDeps: skillPlinths.slice(0, 2).map(s => s.id),
        subsystems: [
          {
            id: 'cv-p1-sub-1',
            name: 'Ingress Multiplexer',
            category: 'backend',
            role: 'Socket connection pooling and binary decode',
            description: 'Accepts TCP connections with epoll event notification.',
            tech: ['Go', 'Protobuf'],
            coordinates: { x: -30, y: -20, z: 25 },
            dimensions: { width: 50, height: 25, depth: 35 },
            metrics: [{ label: 'Ingress Rate', value: '250k msgs/s' }]
          },
          {
            id: 'cv-p1-sub-2',
            name: 'Storage WAL Engine',
            category: 'database',
            role: 'Append-only memory mapped log',
            description: 'Flushes batches with direct disk fsync barriers.',
            tech: ['mmap', 'C++'],
            coordinates: { x: 30, y: 25, z: 45 },
            dimensions: { width: 60, height: 35, depth: 45 },
            metrics: [{ label: 'Write Latency', value: '<1.8ms' }]
          }
        ],
        metrics: [
          { label: 'Event Throughput', value: '250k /s', note: 'Sustained throughput' },
          { label: 'P99 Latency', value: '2.4ms', note: 'End-to-end processing' }
        ],
        keyDecisions: [
          {
            decision: 'Lockless Data Structures',
            rationale: 'Avoids thread contention on multi-core processors',
            tradeoff: 'Requires atomic pointer manipulation'
          }
        ],
        resilienceTesting: 'Automated chaos monkey cluster simulating random node crash-restart cycles.',
        links: {
          github: github,
          caseStudy: true
        }
      },
      {
        id: 'cv-proj-2',
        code: 'P02',
        title: 'VortexUI Console',
        tagline: 'Reactive spatial visualizer for real-time cluster cartography',
        category: 'frontend',
        status: 'PRODUCTION',
        year: '2024',
        dimensions: { width: 95, height: 70, levels: 3 },
        gridPosition: { x: 150, y: -100 },
        accentColor: '#C3E54E',
        summary: `Interactive isometric canvas rendering thousands of live cluster nodes with 60fps pan/zoom.`,
        problem: `Traditional DOM trees choked when rendering over 500 interactive nodes simultaneously.`,
        solution: `Implemented custom matrix viewport mathematics with offscreen canvas rendering and dirty rect updates.`,
        architectureNotes: `Canvas2D matrix pipeline + Web Workers for off-thread collision calculations.`,
        techStack: ['TypeScript', 'React', 'Canvas2D', 'Tailwind'],
        infrastructureDeps: skillPlinths.slice(0, 2).map(s => s.id),
        subsystems: [
          {
            id: 'cv-p2-sub-1',
            name: 'Spatial Math Engine',
            category: 'frontend',
            role: 'Isometric projection and raycasting',
            description: 'Calculates 3D to 2D screen coordinate transforms at 60fps.',
            tech: ['TypeScript'],
            coordinates: { x: 0, y: 0, z: 30 },
            dimensions: { width: 45, height: 25, depth: 35 },
            metrics: [{ label: 'Frame Time', value: '16.2ms' }]
          }
        ],
        metrics: [
          { label: 'Render FPS', value: '60 FPS', note: 'Smooth panning' },
          { label: 'Node Capacity', value: '5,000+', note: 'Concurrent nodes' }
        ],
        keyDecisions: [
          {
            decision: 'Direct DOM Matrix Transform',
            rationale: 'Bypasses React reconciliation cycle during continuous pan',
            tradeoff: 'Requires imperative ref syncing'
          }
        ],
        resilienceTesting: 'Memory leak verification using automated Playwright browser stress runs.',
        links: {
          github: github,
          caseStudy: true
        }
      }
    );
  }

  // Link projects to skills
  projects.forEach((proj, idx) => {
    if (skillPlinths.length > 0) {
      proj.infrastructureDeps = [
        skillPlinths[idx % skillPlinths.length].id,
        skillPlinths[(idx + 1) % skillPlinths.length].id
      ];
    }
  });

  // Link skills back to projects
  skillPlinths.forEach(skill => {
    skill.usedInProjects = projects.filter(p => p.infrastructureDeps.includes(skill.id)).map(p => p.id);
    skill.systemCount = skill.usedInProjects.length || 2;
  });

  // 5. Operator Metadata
  const operator: OperatorMetadata = {
    name,
    handle: `@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    role,
    location,
    status: 'ACTIVE_BUILD // CV SYNCHRONIZED',
    focus: summary.slice(0, 140),
    yearsActive: 8,
    commitsIndexed: '6,200+',
    productionUptime: '99.98%',
    primaryStack: skillsToUse.slice(0, 6).map(s => s.name),
    systemManifesto: summary,
    contact: {
      email,
      github,
      linkedin,
      pgpKeyId: '0x8F92E31C',
      pgpFingerprint: '94A1 8E34 B109 C321 78F0 9D3A 8F92 E31C',
      matrix: `@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}:matrix.org`,
      availability: 'Available for high-leverage technical challenges'
    }
  };

  return {
    operator,
    projects,
    skills: skillPlinths,
    experience,
    rawText: text,
    sourceDocument: sourceName || 'CV / Resume Ingestion'
  };
}

/**
 * CV Presets for quick 1-click testing
 */
export const CV_PRESETS = [
  {
    id: 'preset-systems',
    name: 'Distributed Systems & Platform Architect',
    description: 'Expert in Go, Rust, Kubernetes, Raft consensus, and high-throughput microservices.',
    text: `# Alex Vance
Staff Systems & Distributed Infrastructure Architect
Email: alex.vance.systems@gmail.com
Location: Seattle, WA // UTC-8
GitHub: https://github.com/alexvance-sys
LinkedIn: https://linkedin.com/in/alexvance-arch

## Professional Summary
Over 9 years architecting high-throughput distributed state machines, edge consensus engines, and Kubernetes container infrastructure. Focused on mechanical sympathy, sub-millisecond p99 latency boundaries, and zero-downtime deployment invariants.

## Core Technical Skills
- Languages: Go, Rust, TypeScript, C++, Python
- Infrastructure: Kubernetes, Docker, Helm, eBPF, Linux Kernel, Terraform
- Databases & Queues: PostgreSQL, ClickHouse, Apache Kafka, Redis, SQLite
- Protocols & Architecture: Raft, CRDTs, gRPC, Protobuf, WebSockets, WebRTC

## Key Architectural Systems & Projects
### ChronoPulse Mesh
Distributed real-time streaming pipeline processing 450k events/sec with snappy WAL compression.
- Built zero-copy binary serialization protocol using Go and memory-mapped files.
- Reduced partition recovery healing time to under 15ms.

### KubeSentinel Daemon
Kernel-level eBPF socket telemetry probe monitoring container egress bottlenecks in real time.
- Integrated directly with Linux ring buffers to extract packet telemetry without user-space context switches.
- Deployed across 200+ Kubernetes nodes with <0.3% CPU overhead.

### VertexKV Vector Store
Embedded SIMD-accelerated vector database for nearest-neighbor embeddings queries.
- Implemented HNSW graph indexing in Rust with AVX-512 vectorization.
- Sub-5ms query latency for 10M+ high-dimensional vectors.

## Work Experience
### Principal Infrastructure Architect — CoreMesh Systems (2022 — Present)
- Architected the global multi-region edge mesh coordinating 80k concurrent nodes.
- Designed automatic split-brain partition recovery algorithms using Raft and vector clocks.
- Led the platform engineering guild and established automated chaos testing suites.

### Senior Distributed Backend Engineer — Streamline Data Corp (2019 — 2022)
- Engineered event-driven ingest pipelines processing 2.5B records daily.
- Optimized PostgreSQL and ClickHouse queries, reducing monthly cloud egress costs by $180k.
- Built canary deployment orchestration tools with automatic metric-based rollbacks.
`
  },
  {
    id: 'preset-frontend-spatial',
    name: 'Staff Full-Stack & Spatial UI Engineer',
    description: 'Specialist in TypeScript, React, WebGL/Canvas2D, Node.js, and dense technical dashboards.',
    text: `# Maya Lin
Staff Full-Stack & Spatial UI Engineer
Email: maya.lin.dev@gmail.com
Location: New York, NY // UTC-5
GitHub: https://github.com/mayalin-ui
LinkedIn: https://linkedin.com/in/mayalin-dev

## Summary
Full-stack engineer with deep specialization in high-density reactive user interfaces, custom Canvas2D spatial rendering engines, and real-time collaborative state management. Passionate about brutalist design precision and zero-defect performance.

## Core Competencies
- Frontend: TypeScript, React, Next.js, Canvas2D, WebGL, Tailwind CSS, State Machines
- Backend & Cloud: Node.js, Bun, PostgreSQL, GraphQL, WebSockets, Redis
- Engineering Discipline: Accessibility (WCAG AAA), Memory Profiling, AST Transformations

## Featured Projects
### SpatialCAD Engine
High-performance browser-based 2D CAD spatial visualizer rendering 20,000 entities at 60 FPS.
- Developed custom matrix viewport transform engine with spatial grid indexing.
- Offloaded geometry intersection calculations to Web Workers.

### PrismUI Design System
Zero-runtime styling and component architecture built for mission-critical aerospace consoles.
- Strict keyboard accessibility with comprehensive focus trapping and sound telemetry.
- 100% test coverage with automated visual regression tests.

### CollabGraph Sync
Real-time collaborative diagramming whiteboard powered by Yjs and WebSocket channels.
- Conflict-free collaborative editing with optimistic offline mutations.

## Experience
### Lead UI Architect — Prism Aerospace Tech (2021 — Present)
- Designed the primary flight monitoring console used by over 300 mission operators.
- Reduced UI render latency from 80ms to under 12ms through custom ref scheduling.

### Senior Frontend Engineer — VisualCraft Studio (2018 — 2021)
- Built interactive data visualization suites using D3 and WebGL for Fortune 500 analytics.
`
  }
];
