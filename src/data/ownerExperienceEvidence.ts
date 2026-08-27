import { OwnerExperienceEvidence } from '../types';

/**
 * PERSISTENT OWNER-CURATED PROFESSIONAL EVIDENCE OVERLAY.
 *
 * Fork owners curate their engineering evidence here.
 * This file is PERSISTENT and is NOT modified when running `npm run setup -- <linkedin.pdf>`.
 *
 * Provenance Classes:
 * - VERIFIED: demonstrably supported by repository code, tests, configs, or documentation.
 * - CURATED: explicitly supplied/confirmed by the portfolio owner (e.g. internal / closed-source platforms).
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
      'React',
      'React Native',
      'Node.js',
      'NestJS',
      'Next.js',
      'PostgreSQL',
      'Prisma',
      'Socket.IO',
      'Expo',
      'Tailwind CSS'
    ],

    // 1. SYSTEMS ARCHITECTED (High Evidentiary Bar)
    architectedSystems: [
      {
        id: 'arch-towerdesk-multi-tenant',
        name: 'Multi-Tenant Property Management Architecture (TowerDesk)',
        description: 'Modular service architecture separating guarded REST workflows, Prisma data access, background queue workers, and Socket.IO realtime event gateway with organization, building, and role boundaries.',
        architecturalScope: [
          'Tenant & Building Boundary Isolation',
          'Modular HTTP REST & Worker Process Separation',
          'Relational Multi-Tenant Data Layer',
          'WebSocket Realtime Notification Gateway'
        ],
        linkedProjectId: 'towerdesk-backend-clean',
        technologies: ['NestJS', 'Prisma', 'PostgreSQL', 'Socket.IO', 'TypeScript'],
        provenance: 'VERIFIED'
      },
      {
        id: 'arch-remapp-sync-pipeline',
        name: 'External Property Data Ingestion Service',
        description: 'Integration pipeline consuming external Remapp Estate API property/project data and synchronizing records into the CRM database on a nightly schedule for agent operational readiness.',
        architecturalScope: [
          'External Property API Integration',
          'Scheduled Nightly Ingestion Service',
          'CRM Database Property Record Ingestion'
        ],
        technologies: ['Node.js', 'TypeScript', 'PostgreSQL', 'Scheduler'],
        provenance: 'CURATED'
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
            name: 'Backend Service',
            role: 'Guarded REST API, multi-tenant authorization, Prisma data layer, and Socket.IO realtime gateway.',
            tech: ['NestJS', 'TypeScript', 'Prisma', 'PostgreSQL', 'Socket.IO', 'JWT', 'Argon2', 'BullMQ'],
            status: 'ORIGINAL BACKEND RETIRED',
            linkedProjectId: 'towerdesk-backend-clean',
            repositoryUrl: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
            provenance: 'VERIFIED'
          },
          {
            name: 'Admin / Web Application',
            role: 'Role-based operational dashboard for platform admins, building managers, and unit owners.',
            tech: ['Next.js App Router', 'React', 'TypeScript', 'TanStack Query', 'Zustand', 'Socket.IO Client', 'Tailwind CSS'],
            status: 'FRONTEND SHOWCASE',
            linkedProjectId: 'tower-desk-clean',
            repositoryUrl: 'https://github.com/SalAkBuK/tower-desk-clean',
            provenance: 'VERIFIED'
          },
          {
            name: 'Mobile Application',
            role: 'Cross-platform mobile client for residents, owners, and building staff with push notifications and secure storage.',
            tech: ['React Native', 'Expo Router', 'TypeScript', 'Expo SecureStore', 'Expo Notifications', 'Axios'],
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
          'TypeScript'
        ],
        provenance: 'VERIFIED'
      },
      {
        id: 'sys-internal-crm',
        name: 'Internal Real Estate CRM Platform',
        tagline: 'Operational CRM coordinating lead lifecycles, project inventories, agent assignments, and image verification evidence.',
        status: 'INTERNAL OPERATIONAL PLATFORM',
        description: 'Internal management platform built to coordinate real estate operations, property/project listings, customer leads, and agent transaction workflows with image/media proof validation.',
        capabilities: [
          'Authentication & Role-Based Access Control (RBAC)',
          'Agent & Admin Workflows',
          'Lead Management & Assignment',
          'Projects & Property Records Management',
          'Evidence Ingress: Agent Image & WhatsApp Screenshot Uploads'
        ],
        technologies: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs'],
        provenance: 'CURATED'
      },
      {
        id: 'sys-remapp-ingestion',
        name: 'Property Data Ingestion & Synchronization Pipeline',
        tagline: 'Automated data ingestion pipeline synchronizing external real estate listings with internal CRM database.',
        status: 'INTERNAL AUTOMATION SERVICE',
        description: 'Automated integration service fetching external Remapp Estate API listings into the CRM database via scheduled nightly execution, ensuring agents work with refreshed property records daily.',
        dataFlow: 'Remapp Estate API → Scheduled Nightly Ingestion → CRM Database Updates → Refreshed Agent Information',
        capabilities: [
          'External Property Data Ingestion via API',
          'Scheduled Nightly Execution',
          'CRM Database Property Record Ingestion',
          'Refreshed Information Available for Agents the Following Day'
        ],
        technologies: ['Node.js', 'TypeScript', 'Scheduled Execution', 'REST APIs', 'PostgreSQL'],
        provenance: 'CURATED'
      }
    ],

    // 3. MAJOR ENGINEERING CONTRIBUTIONS
    engineeringContributions: [
      {
        title: 'Cross-Surface Full-Stack Engineering (TowerDesk)',
        description: 'Engineered role-based client workflows in Next.js and Expo Router; implemented guarded REST endpoints and Socket.IO realtime event listeners across web and mobile surfaces.',
        impactArea: 'Multi-tenant Property Management',
        technologies: ['NestJS', 'Next.js', 'React Native', 'Socket.IO', 'Prisma'],
        provenance: 'VERIFIED'
      },
      {
        title: 'Internal CRM Platform Development & Scope Expansion',
        description: 'Built and expanded core CRM workflows including authentication, RBAC boundaries, lead tracking, project records, and agent evidence image/WhatsApp screenshot uploads.',
        impactArea: 'Internal Operational CRM & Evidence Ingress',
        technologies: ['React', 'Node.js', 'PostgreSQL', 'RBAC'],
        provenance: 'CURATED'
      },
      {
        title: 'Nightly Property Data Synchronization Integration',
        description: 'Configured and maintained scheduled nightly execution fetching Remapp Estate property data into the CRM database so agents have refreshed listings the following day.',
        impactArea: 'External Property Data Integration',
        technologies: ['Node.js', 'TypeScript', 'Scheduler', 'PostgreSQL'],
        provenance: 'CURATED'
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
        details: 'Configured and maintained frontend showcase builds on Netlify and mobile application builds with Expo.',
        status: 'SHOWCASE ACTIVE',
        provenance: 'CURATED'
      },
      {
        area: 'Scheduled Ingestion Automation',
        details: 'Configured scheduled nightly execution for external Remapp property data synchronization.',
        status: 'INTERNAL SERVICE',
        provenance: 'CURATED'
      }
    ],

    // 5. EVIDENCE LINKS
    evidenceLinks: [
      {
        label: 'TowerDesk Backend Repository',
        type: 'repository',
        projectId: 'towerdesk-backend-clean',
        url: 'https://github.com/SalAkBuK/towerdesk-backend-clean',
        note: 'Guarded NestJS / Prisma REST API and realtime notification gateway'
      },
      {
        label: 'TowerDesk Web Application',
        type: 'repository',
        projectId: 'tower-desk-clean',
        url: 'https://github.com/SalAkBuK/tower-desk-clean',
        note: 'Next.js App Router dashboard with role-based workspaces'
      },
      {
        label: 'TowerDesk Mobile Showcase',
        type: 'repository',
        projectId: 'towerdesk-mobile-showcase',
        url: 'https://github.com/SalAkBuK/towerdesk-mobile-showcase',
        note: 'Expo Router mobile client for residents and building staff'
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
