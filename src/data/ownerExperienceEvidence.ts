import { OwnerExperienceEvidence } from '../types';

/**
 * PERSISTENT OWNER-CURATED PROFESSIONAL EVIDENCE OVERLAY.
 *
 * Fork owners curate their engineering evidence here.
 * This file is PERSISTENT and is NOT modified when running `npm run setup -- <linkedin.pdf>`.
 *
 * Provenance Classes:
 * - VERIFIED: demonstrably supported by repository source, configs, documentation, tests, or schema.
 * - CURATED: explicitly supplied/confirmed by the portfolio owner (e.g. professional attribution, production schedule).
 * - DERIVED: safely inferred from supporting evidence.
 * - UNAVAILABLE: insufficient evidence.
 */
export const OWNER_EXPERIENCE_EVIDENCE: OwnerExperienceEvidence[] = [
  {
    organizationId: 'codefier',
    organizationName: 'CodeFier',
    provenance: 'CURATED',
    gridPosition: { x: -140, y: -40 },
    technologies: [
      'TypeScript',
      'JavaScript',
      'Python',
      'PHP',
      'React',
      'React Native',
      'Next.js',
      'NestJS',
      'Express',
      'Node.js',
      'PostgreSQL',
      'MySQL',
      'Prisma',
      'Socket.IO',
      'BullMQ',
      'Redis',
      'Expo Router',
      'Tailwind CSS'
    ],

    // 1. SYSTEMS ARCHITECTED (High Evidentiary Bar)
    architectedSystems: [
      {
        id: 'arch-towerdesk-multi-tenant',
        name: 'Multi-Tenant Property Operations Modular Monolith (TowerDesk)',
        description: 'Modular monolith architecture separating core API REST controllers, Prisma data access, BullMQ background queue workers, and Socket.IO realtime event gateway with organization (orgId), building, role template, and permission override boundaries.',
        architecturalScope: [
          'Modular Monolith Architecture (API & BullMQ Worker Separation)',
          'Multi-Tenant Organization (orgId) & Building Boundary Isolation',
          'Fine-Grained RBAC with Role Templates & Permission Overrides',
          'Relational Multi-Tenant Data Layer (PostgreSQL / Prisma)',
          'WebSocket Realtime Notification Gateway (/notifications namespace)'
        ],
        linkedProjectId: 'towerdesk-backend-clean',
        technologies: ['NestJS', 'TypeScript', 'Prisma', 'PostgreSQL', 'Socket.IO', 'BullMQ', 'Redis'],
        provenance: 'VERIFIED'
      },
      {
        id: 'arch-worthy-crm-pipeline',
        name: 'Role-Enforced Sales CRM & Evidence Ingress Architecture (Worthy CRM)',
        description: 'Transaction-safe real estate CRM architecture enforcing strict 3-role isolation (Admin, CEO, Agent), atomic multi-row lead creation, sequential follow-up workflows, mandatory screenshot proof verification, and structured audit logging.',
        architecturalScope: [
          'Strict 3-Role Isolation (ADMIN, CEO, AGENT) with Assigned Lead Scoping',
          'Atomic Multi-Row Lead Creation with Rollback Safety',
          'Sequential Follow-Up Attempt State Constraints with Call/WhatsApp Proof',
          'Structured Audit Logging for Operational Mutations (audit_logs table)',
          'Automated Cron Notification & Escalation Engine with Deduplication Keys'
        ],
        linkedProjectId: 'worthy-crm',
        technologies: ['PHP 8', 'MySQL', 'PDO', 'JSON', 'Cron'],
        provenance: 'VERIFIED'
      },
      {
        id: 'arch-remapp-sync-pipeline',
        name: 'External Property Data Ingestion & Gateway Service (Remapp)',
        description: 'Resilient data ingestion architecture directly consuming Remapp JSON API endpoints with bearer authentication, retry backoff (MAX_RETRIES=5), 429 rate-limit recovery, incremental JSONL caching, and an API-key protected downstream distribution server.',
        architecturalScope: [
          'Direct REST API Ingestion (List & Detail Endpoints with Auto-Login)',
          'Resilient Network Layer with Exponential Backoff & 429 Rate-Limit Handling',
          'Incremental State & JSONL Cache Engine Preventing Redundant Fetches',
          'API-Key Protected Distribution Server (/projects, /refresh, /refresh/status)',
          'Disk-Cached Downstream Ingestion for CRM Operational Isolation'
        ],
        linkedProjectId: 'remapp-scraper',
        technologies: ['Python', 'Requests', 'Node.js', 'Express', 'JSONL'],
        provenance: 'VERIFIED'
      }
    ],

    // 2. PROFESSIONAL SYSTEMS DELIVERED
    systemsDelivered: [
      {
        id: 'sys-towerdesk-platform',
        name: 'TowerDesk Platform',
        tagline: 'Multi-tenant property management, concierge workflows, and realtime tenant communication platform.',
        status: 'FRONTEND SHOWCASE // ORIGINAL BACKEND RETIRED',
        description: 'Multi-surface property management platform comprising a modular NestJS API, role-scoped Next.js admin dashboard, and cross-platform Expo mobile client.',
        surfaces: [
          {
            name: 'Backend Platform',
            role: 'Modular monolith API with guarded REST endpoints, multi-tenant authorization, Prisma data layer, BullMQ worker runtime, and Socket.IO realtime gateway.',
            tech: ['NestJS', 'TypeScript', 'Prisma', 'PostgreSQL', 'Socket.IO', 'Passport JWT', 'Argon2', 'BullMQ', 'Redis'],
            status: 'ORIGINAL BACKEND RETIRED',
            linkedProjectId: 'towerdesk-backend-clean',
            repositoryUrl: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
            provenance: 'VERIFIED'
          },
          {
            name: 'Web / Admin Dashboard',
            role: 'Role-scoped operational dashboard for platform superadmins, organization admins, building managers, service providers, and unit owners.',
            tech: ['Next.js App Router', 'React 19', 'TypeScript', 'TanStack Query', 'Zustand', 'Socket.IO Client', 'Tailwind CSS'],
            status: 'FRONTEND SHOWCASE',
            linkedProjectId: 'tower-desk-clean',
            repositoryUrl: 'https://github.com/SalAkBuK/tower-desk-clean',
            provenance: 'VERIFIED'
          },
          {
            name: 'Mobile Application',
            role: 'Cross-platform concierge app for residents, owners, management, and staff with secure token storage, notifications, and modular maturity (API-backed auth/requests, hybrid visitors, mock amenities).',
            tech: ['React Native', 'Expo Router', 'TypeScript', 'Expo SecureStore', 'Expo Notifications', 'AsyncStorage'],
            status: 'SHOWCASE REPOSITORY',
            linkedProjectId: 'towerdesk-mobile-showcase',
            repositoryUrl: 'https://github.com/SalAkBuK/towerdesk-mobile-showcase',
            provenance: 'VERIFIED'
          }
        ],
        linkedProjectIds: [
          'towerdesk-backend-clean',
          'tower-desk-clean',
          'towerdesk-mobile-showcase'
        ],
        technologies: [
          'NestJS',
          'Next.js',
          'React Native',
          'Expo Router',
          'PostgreSQL',
          'Prisma',
          'Socket.IO',
          'BullMQ',
          'TypeScript'
        ],
        provenance: 'VERIFIED'
      },
      {
        id: 'sys-worthy-crm',
        name: 'Worthy Real Estate CRM Platform',
        tagline: 'Operational CRM coordinating lead lifecycles, agent follow-up integrity, evidence verification, and property records.',
        status: 'OPERATIONAL CRM PLATFORM',
        description: 'Internal management platform built to coordinate real estate operations, customer leads, assigned agent follow-up sequences with mandatory screenshot proof, and disk-cached property catalogue views.',
        capabilities: [
          'Authentication & 3-Role Isolation (ADMIN, CEO, AGENT) with Brute-Force Protection',
          'Transaction-Safe Bulk Lead Entry & Assignment (All-or-Nothing Rollback)',
          'Sequential Agent Follow-up Workflows (Minimum 50-char Notes & Stage Validation)',
          'Mandatory Call Screenshot & Conditional WhatsApp Media Proof Uploads',
          'Structured Operational & Security Mutation Audit Logging (audit_logs table)',
          'Automated Cron Notification & Escalation Processing with Deduplication Keys (dedup_key)',
          'HTTP & Disk Cache-Backed External Property Catalogue Integration'
        ],
        linkedProjectIds: ['worthy-crm'],
        technologies: ['PHP 8', 'MySQL', 'PDO', 'Bootstrap', 'JavaScript', 'REST APIs'],
        provenance: 'VERIFIED'
      },
      {
        id: 'sys-remapp-ingestion',
        name: 'Remapp Property Data Ingestion & Synchronization Service',
        tagline: 'Automated data ingestion service pulling external Remapp API listings into a normalized cache for CRM operations.',
        status: 'AUTOMATED INGESTION SERVICE',
        description: 'Automated integration service fetching external Remapp API listings via resilient Python batch worker with retry backoff and incremental JSONL caching, served through a protected Node.js API to the CRM.',
        dataFlow: 'Remapp API (Direct Endpoints) → Python Ingestion Worker (Retry Backoff & Incremental JSONL) → Protected Node.js API Server → Downstream Disk Cache (Worthy CRM)',
        capabilities: [
          'Direct Remapp JSON API Ingestion (List & Detail Endpoints with Auto-Login)',
          'Exponential Retry Backoff (MAX_RETRIES=5) & Rate-Limit (429) Handling',
          'Incremental State & JSONL Cache Engine to Prevent Redundant Fetches',
          'API-Key Protected Downstream Distribution Server (/projects, /refresh, /refresh/status)',
          'Price & Handover Key Normalization for Downstream CRM Sorting'
        ],
        linkedProjectIds: ['remapp-scraper'],
        technologies: ['Python', 'Requests', 'Node.js', 'Express', 'JSONL', 'REST APIs'],
        provenance: 'VERIFIED'
      }
    ],

    // 3. MAJOR ENGINEERING CONTRIBUTIONS
    engineeringContributions: [
      {
        title: 'Cross-Surface Full-Stack Engineering (TowerDesk)',
        description: 'Engineered role-based client workflows in Next.js and Expo Router; implemented guarded REST endpoints, Prisma data layer, and Socket.IO realtime event listeners across web and mobile surfaces.',
        impactArea: 'Multi-tenant Property Operations',
        technologies: ['NestJS', 'Next.js', 'React Native', 'Socket.IO', 'Prisma'],
        provenance: 'VERIFIED'
      },
      {
        title: 'Role-Enforced CRM & Evidence Verification Engine (Worthy CRM)',
        description: 'Built core CRM architecture with 3-role boundary enforcement, atomic bulk lead creation, sequential follow-up validation, mandatory call/WhatsApp screenshot uploads, and structured audit logging.',
        impactArea: 'Internal Operational CRM & Evidence Ingress',
        technologies: ['PHP 8', 'MySQL', 'PDO', 'RBAC', 'Audit Logging'],
        provenance: 'VERIFIED'
      },
      {
        title: 'Resilient External Property Ingestion Pipeline (Remapp)',
        description: 'Developed Python batch ingestion runner with exponential retry backoff, 429 recovery, incremental JSONL caching, and protected Node.js API server for downstream property distribution.',
        impactArea: 'External Property API Ingestion',
        technologies: ['Python', 'Requests', 'Node.js', 'Express', 'JSONL'],
        provenance: 'VERIFIED'
      },
      {
        title: 'Sanitized Showcase Preparation & Audit',
        description: 'Curated and validated public showcase repositories removing production credentials, real contracts, and sensitive tenant data while maintaining full architectural fidelity and test coverage.',
        impactArea: 'Public Showcase Verification',
        technologies: ['Vitest', 'Jest', 'Playwright', 'TypeScript'],
        provenance: 'VERIFIED'
      }
    ],

    // 4. INFRASTRUCTURE & OPERATIONS
    infrastructureOperations: [
      {
        area: 'Cloud Infrastructure Lifecycle',
        details: 'Original backend AWS infrastructure (EC2, RDS, SES) was retired following AWS account decommission; public presence is preserved through sanitized repositories and frontend showcase builds.',
        status: 'ORIGINAL BACKEND RETIRED // AWS DECOMMISSIONED',
        provenance: 'CURATED'
      },
      {
        area: 'Showcase Hosting & Client Builds',
        details: 'Configured and maintained frontend showcase builds on Netlify and mobile application builds with EAS Expo.',
        status: 'SHOWCASE ACTIVE',
        provenance: 'CURATED'
      },
      {
        area: 'Scheduled Ingestion Automation',
        details: 'Configured scheduled execution in production environment for external Remapp property data synchronization.',
        status: 'SCHEDULED SERVICE // NIGHTLY CADENCE (CURATED)',
        provenance: 'CURATED'
      }
    ],

    // 5. EVIDENCE LINKS
    evidenceLinks: [
      {
        label: 'TowerDesk Backend (Showcase)',
        type: 'repository',
        projectId: 'towerdesk-backend-clean',
        url: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
        note: 'Sanitized showcase of guarded NestJS / Prisma modular monolith API'
      },
      {
        label: 'TowerDesk Web Application (Showcase)',
        type: 'repository',
        projectId: 'tower-desk-clean',
        url: 'https://github.com/SalAkBuK/tower-desk-clean',
        note: 'Next.js App Router dashboard with role-based operational workspaces'
      },
      {
        label: 'TowerDesk Mobile (Showcase)',
        type: 'repository',
        projectId: 'towerdesk-mobile-showcase',
        url: 'https://github.com/SalAkBuK/towerdesk-mobile-showcase',
        note: 'Expo Router mobile client with multi-role concierge workspaces'
      },
      {
        label: 'Worthy CRM (Repository Evidence)',
        type: 'repository',
        projectId: 'worthy-crm',
        url: 'https://github.com/SalAkBuK/worthy-crm',
        note: 'Role-enforced CRM with atomic lead transactions, screenshot evidence, and audit logging'
      },
      {
        label: 'Remapp Ingestion Service (Repository Evidence)',
        type: 'repository',
        projectId: 'remapp-scraper',
        url: 'https://github.com/SalAkBuK/remapp-scraper',
        note: 'Direct Remapp API ingestion worker with retry backoff, incremental cache, and gateway API'
      }
    ]
  }
];

export function getOwnerExperienceEvidence(identifier: string): OwnerExperienceEvidence | null {
  const target = (identifier || '').toLowerCase().trim();
  return (
    OWNER_EXPERIENCE_EVIDENCE.find(
      e =>
        e.organizationId.toLowerCase() === target ||
        (e.organizationName && e.organizationName.toLowerCase() === target)
    ) || null
  );
}
