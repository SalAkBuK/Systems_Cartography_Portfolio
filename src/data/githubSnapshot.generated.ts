// THIS IS A GENERATED FILE. DO NOT EDIT DIRECTLY.
// Run "npm run sync:github" to regenerate against the configured GitHub target.

import type { GitHubSnapshotMetadata } from '../types';
import type { GitHubSyncResult } from '../services/githubService';

export const GITHUB_SNAPSHOT_METADATA: GitHubSnapshotMetadata = {
  "schemaVersion": 1,
  "generatedAt": "2026-09-03T15:59:47.197Z",
  "githubTarget": "https://github.com/SalAkBuK",
  "sourceIdentifier": "SalAkBuK",
  "rawRepositoryCount": 18,
  "canonicalRepositoryCount": 17,
  "inspectedRepositoryCount": 17,
  "inspectionWarnings": []
};

export const GITHUB_SNAPSHOT: GitHubSyncResult = {
  "sourceType": "user",
  "sourceIdentifier": "SalAkBuK",
  "user": {
    "login": "SalAkBuK",
    "name": null,
    "avatar_url": "https://avatars.githubusercontent.com/u/119301846?v=4",
    "bio": null,
    "html_url": "https://github.com/SalAkBuK",
    "public_repos": 18,
    "followers": 26,
    "following": 39,
    "company": null,
    "location": null,
    "blog": null
  },
  "projects": [
    {
      "id": "gh-1347309405",
      "code": "GH-01",
      "title": "Systems_Cartography_Portfolio",
      "tagline": "Interactive developer portfolio that transforms GitHub repositories, projects, skills, and experience into an explorable brutalist systems cartography interface.",
      "category": "frontend",
      "classifications": [
        "frontend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 101,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -160,
        "y": -90
      },
      "accentColor": "#8EA9DA",
      "summary": "Interactive developer portfolio that transforms GitHub repositories, projects, skills, and experience into an explorable brutalist systems cartography interface. GitHub reports 0 stars, 1 forks, and 0 open issues.",
      "problem": "Point the importer at a LinkedIn \"Save to PDF\" export (or any CV PDF with a comparable layout). It is parsed **locally, in memory** — the PDF is never uploaded or committed — to populate identity, location, education, and an employment history with promotion/progression detection. Ambiguous fields are surfaced as review warnings rather than...",
      "solution": "The architecture tab renders sub-service decomposition, protocols, and key architectural decisions for repositories that have a reviewed `repositoryEvidence.ts` entry. Repositories without one show only what generic analysis can support — an explicit evidence gap instead of an invented diagram.",
      "architectureNotes": "Repository README (Architecture and technical evidence): The architecture tab renders sub-service decomposition, protocols, and key architectural decisions for repositories that have a reviewed `repositoryEvidence.ts` entry. Repositories without one show... GitHub metadata: primary language TypeScript, default branch main, license MIT.",
      "techStack": [
        "TypeScript",
        "Lucide Icons",
        "Motion",
        "React",
        "React DOM",
        "Tailwind CSS",
        "Vite"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-3"
      ],
      "subsystems": [
        {
          "id": "systems_cartography_portfolio-1-interactive-deployed-systems-topology",
          "name": "Interactive deployed-systems topology",
          "category": "backend",
          "role": "— your repositories laid out as a navigable map of systems, not a list.",
          "description": "— your repositories laid out as a navigable map of systems, not a list.",
          "tech": [
            "TypeScript"
          ],
          "coordinates": {
            "x": -60,
            "y": -30,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "VERIFIED"
        },
        {
          "id": "systems_cartography_portfolio-2-capability-reactor---tech-stack-view",
          "name": "Capability reactor / tech stack view",
          "category": "backend",
          "role": "— technologies synthesized from your repositories' actual languages, dependencies, and topics, orbit",
          "description": "— technologies synthesized from your repositories' actual languages, dependencies, and topics, orbiting as inspectable capability nodes.",
          "tech": [
            "TypeScript"
          ],
          "coordinates": {
            "x": 0,
            "y": -35,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "VERIFIED"
        },
        {
          "id": "systems_cartography_portfolio-3-project-architecture-inspector",
          "name": "Project architecture inspector",
          "category": "backend",
          "role": "— per-repository problem/solution/subsystems/key-decisions view, generated from repository metadata ",
          "description": "— per-repository problem/solution/subsystems/key-decisions view, generated from repository metadata and (optionally) your own reviewed notes.",
          "tech": [
            "TypeScript"
          ],
          "coordinates": {
            "x": 60,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "VERIFIED"
        },
        {
          "id": "systems_cartography_portfolio-4-github-derived-capabilities",
          "name": "GitHub-derived capabilities",
          "category": "backend",
          "role": "— capability nodes are computed from what your repositories actually contain, not hand-picked from a",
          "description": "— capability nodes are computed from what your repositories actually contain, not hand-picked from a resume.",
          "tech": [
            "TypeScript"
          ],
          "coordinates": {
            "x": -45,
            "y": 30,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "VERIFIED"
        },
        {
          "id": "systems_cartography_portfolio-5-professional-experience",
          "name": "Professional experience",
          "category": "backend",
          "role": "— imported from a LinkedIn PDF export, with support for progression/promotion within an organization",
          "description": "— imported from a LinkedIn PDF export, with support for progression/promotion within an organization and persistent curated evidence overlays.",
          "tech": [
            "TypeScript"
          ],
          "coordinates": {
            "x": 10,
            "y": 35,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "VERIFIED"
        },
        {
          "id": "systems_cartography_portfolio-6-evidence-provenance",
          "name": "Evidence provenance",
          "category": "telemetry",
          "role": "— every claim on the site is labeled VERIFIED, DERIVED, CURATED, or UNAVAILABLE so a visitor can tel",
          "description": "— every claim on the site is labeled VERIFIED, DERIVED, CURATED, or UNAVAILABLE so a visitor can tell what is GitHub-verifiable metadata versus what the owner has personally attested to.",
          "tech": [
            "TypeScript"
          ],
          "coordinates": {
            "x": 55,
            "y": 30,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "VERIFIED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "1 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "4.0 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "MIT",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Static analysis & code quality enforced with TypeScript Type-Check. 47 test files detected in repository structure.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "VERIFIED",
        "architectureNotes": "VERIFIED",
        "subsystems": "VERIFIED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "TypeScript Type-Check"
        ],
        "buildTools": [
          "Vite"
        ],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 47,
        "summary": "Static analysis & code quality enforced with TypeScript Type-Check. 47 test files detected in repository structure.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/Systems_Cartography_Portfolio",
        "demo": "https://systems-cartography-portfolio.vercel.app",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1335930004",
      "code": "GH-02",
      "title": "physio_bot",
      "tagline": "Whatsapp Bot for Physio appointments automations with google sheets x n8n",
      "category": "fullstack",
      "classifications": [
        "fullstack",
        "frontend",
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 89,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 140,
        "y": -110
      },
      "accentColor": "#C3E54E",
      "summary": "Whatsapp Bot for Physio appointments automations with google sheets x n8n GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "PhysioBot is an n8n-based WhatsApp appointment automation MVP for a physiotherapy clinic. It reduces repetitive appointment intake while keeping final scheduling and physiotherapist assignment under clinic control.",
      "solution": "No custom backend or administrative dashboard is required. Google Sheets remains the MVP operational source of truth.",
      "architectureNotes": "Repository README (MVP architecture): No custom backend or administrative dashboard is required. Google Sheets remains the MVP operational source of truth. GitHub metadata: primary language not reported, default branch main, license not reported.",
      "techStack": [
        "n8n",
        "Google Sheets",
        "WhatsApp Cloud API"
      ],
      "infrastructureDeps": [
        "gh-infra-18",
        "gh-infra-21",
        "gh-infra-27"
      ],
      "subsystems": [
        {
          "id": "physio_bot-layer-1",
          "name": "n8n Backend Service",
          "category": "backend",
          "role": "Business transactions, routing, and workflow orchestration",
          "protocol": "HTTPS / REST",
          "description": "Architectural tier derived from verified n8n, Google Sheets, WhatsApp Cloud API configuration.",
          "tech": [
            "n8n",
            "Google Sheets",
            "WhatsApp Cloud API"
          ],
          "coordinates": {
            "x": 0,
            "y": 0,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "0.0 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "Mixed Stack",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "No test harness, test files, or CI workflow detected in repository.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "VERIFIED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "UNAVAILABLE",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 0,
        "summary": "No test harness, test files, or CI workflow detected in repository.",
        "provenance": "UNAVAILABLE"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/physio_bot",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1072943348",
      "code": "GH-03",
      "title": "towerdesk-mobile-app",
      "tagline": "Public frontend repository; no description supplied on GitHub.",
      "category": "frontend",
      "classifications": [
        "frontend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 120,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -210,
        "y": 120
      },
      "accentColor": "#8EA9DA",
      "summary": "Public repository owned by SalAkBuK. Primary language: TypeScript.",
      "problem": "Support property and concierge workflows across resident, owner, management, staff, and provider roles on mobile.",
      "solution": "An Expo Router application with guarded role workspaces, shared modal workflows, typed REST clients, secure token handling, notification capabilities, and realtime messaging.",
      "architectureNotes": "Repository README: route guards and app-state contexts organize role workspaces above a typed REST service layer with token refresh and domain clients. GitHub metadata: primary language TypeScript, default branch master, license not reported.",
      "techStack": [
        "TypeScript",
        "Expo",
        "React",
        "React DOM",
        "React Native",
        "GitHub Actions",
        "Jest",
        "ESLint",
        "Expo Router",
        "React Navigation",
        "Axios",
        "Expo SecureStore",
        "Expo Notifications"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-10",
        "gh-infra-15"
      ],
      "subsystems": [
        {
          "id": "tdm-router",
          "name": "Role Workspace Router",
          "category": "frontend",
          "role": "Guard and organize role-specific screens",
          "description": "Expo Router and React Navigation separate resident, owner, management, employee, and provider journeys.",
          "tech": [
            "Expo Router",
            "React Navigation"
          ],
          "coordinates": {
            "x": -45,
            "y": -28,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdm-client",
          "name": "Typed API Client",
          "category": "frontend",
          "role": "Call backend domain services",
          "protocol": "HTTPS / REST",
          "description": "Request helpers and domain clients handle tokens, refresh, and REST calls.",
          "tech": [
            "TypeScript",
            "Axios"
          ],
          "coordinates": {
            "x": 40,
            "y": -26,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdm-device",
          "name": "Device Services",
          "category": "frontend",
          "role": "Integrate secure storage and mobile capabilities",
          "description": "Expo modules provide SecureStore, notifications, files, images, documents, and browser handoffs.",
          "tech": [
            "Expo SecureStore",
            "Expo Notifications"
          ],
          "coordinates": {
            "x": 0,
            "y": 38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "12.2 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [
        {
          "decision": "Multi-role mobile workspace isolation",
          "rationale": "Support distinct operational user roles (resident, owner, management, employee, provider) in a single mobile codebase.",
          "tradeoff": "Requires structured route guards and modular navigation state.",
          "provenance": "CURATED"
        }
      ],
      "resilienceTesting": "Repository evidence: Jest/jest-expo is configured for selected workflow coverage, with lint and TypeScript type-check scripts available.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "CURATED",
        "solution": "CURATED",
        "architectureNotes": "CURATED",
        "subsystems": "CURATED",
        "keyDecisions": "CURATED",
        "resilienceTesting": "CURATED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "Jest"
        ],
        "ciWorkflows": [
          "GitHub Actions"
        ],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint",
          "TypeScript Type-Check"
        ],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 34,
        "summary": "Unit/integration test suite configured (Jest). Automated verification pipeline via GitHub Actions. Static analysis & code quality enforced with ESLint, TypeScript Type-Check. 34 test files detected in repository structure.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/towerdesk-mobile-app",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1121594562",
      "code": "GH-04",
      "title": "tower-desk",
      "tagline": "Building management system for handling tenant requests, administrator assignments, and maintenance operations",
      "category": "frontend",
      "classifications": [
        "frontend",
        "backend",
        "fullstack"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 109,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 160,
        "y": 100
      },
      "accentColor": "#8EA9DA",
      "summary": "Building management system for handling tenant requests, administrator assignments, and maintenance operations GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "Provide role-specific building and property workflows against a separate TowerDesk API without exposing server credentials in the browser.",
      "solution": "A Next.js App Router dashboard with role-aware routes, typed API/query layers, persisted session state, realtime hooks, and server-side proxy routes for platform-only calls.",
      "architectureNotes": "Repository README: app routes and dashboards sit above feature/UI components and a shared API, query, auth, RBAC, utility, and type layer; selected platform calls use Next.js server routes. GitHub metadata: primary language TypeScript, default branch main, license not reported.",
      "techStack": [
        "TypeScript",
        "TanStack Query",
        "Framer Motion",
        "Lucide Icons",
        "Next.js",
        "React",
        "React DOM",
        "Zustand",
        "Tailwind CSS",
        "Playwright",
        "Vitest",
        "ESLint",
        "Next.js API Routes",
        "Socket.IO Client"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-3",
        "gh-infra-6",
        "gh-infra-8",
        "gh-infra-9",
        "gh-infra-11"
      ],
      "subsystems": [
        {
          "id": "tdw-routes",
          "name": "Role-based Workspaces",
          "category": "frontend",
          "role": "Route users to appropriate operational portals",
          "description": "Platform, organization, manager, provider, and owner views expose scoped workflows.",
          "tech": [
            "Next.js",
            "React"
          ],
          "coordinates": {
            "x": -48,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdw-state",
          "name": "Client Integration Layer",
          "category": "frontend",
          "role": "Coordinate server and session state",
          "description": "TanStack Query manages server state while Zustand persists client authentication/session state.",
          "tech": [
            "TanStack Query",
            "Zustand"
          ],
          "coordinates": {
            "x": 12,
            "y": -36,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdw-proxy",
          "name": "Platform API Proxy",
          "category": "backend",
          "role": "Keep platform-key calls server-side",
          "protocol": "HTTPS / REST",
          "description": "Selected Next.js API routes proxy platform operations that require a server-side key.",
          "tech": [
            "Next.js API Routes"
          ],
          "coordinates": {
            "x": 52,
            "y": 25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdw-realtime",
          "name": "Realtime Client",
          "category": "frontend",
          "role": "Surface messages and notifications",
          "protocol": "WebSocket",
          "description": "Socket.IO client hooks support notification, unread-count, and messaging experiences.",
          "tech": [
            "Socket.IO Client"
          ],
          "coordinates": {
            "x": -25,
            "y": 38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "5.8 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [
        {
          "decision": "Use server routes for privileged platform calls",
          "rationale": "The platform API key belongs on the server boundary.",
          "tradeoff": "Those workflows require additional runtime environment configuration.",
          "provenance": "CURATED"
        },
        {
          "decision": "Split server state from session state",
          "rationale": "Query caching and persisted authentication have different lifecycles.",
          "tradeoff": "The repository notes that local-storage token persistence needs review for high-risk deployments.",
          "provenance": "CURATED"
        }
      ],
      "resilienceTesting": "Repository evidence: Vitest unit tests and Playwright e2e tests are configured, with lint and TypeScript typecheck scripts.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "CURATED",
        "solution": "CURATED",
        "architectureNotes": "CURATED",
        "subsystems": "CURATED",
        "keyDecisions": "CURATED",
        "resilienceTesting": "CURATED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "Vitest"
        ],
        "ciWorkflows": [],
        "e2eHarnesses": [
          "Playwright"
        ],
        "lintersAndFormatters": [
          "ESLint"
        ],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 63,
        "summary": "Unit/integration test suite configured (Vitest). End-to-end browser automation configured (Playwright). Static analysis & code quality enforced with ESLint. 63 test files detected in repository structure.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/tower-desk",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1122295326",
      "code": "GH-05",
      "title": "towerdesk-backend",
      "tagline": "TowerDesk backend",
      "category": "backend",
      "classifications": [
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 96,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -30,
        "y": -200
      },
      "accentColor": "#8EA9DA",
      "summary": "TowerDesk backend GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "Coordinate multi-tenant property operations while enforcing organization, building, role, owner, and provider boundaries.",
      "solution": "A modular NestJS API backed by Prisma/PostgreSQL, with guarded REST workflows, persisted realtime notifications, optional background jobs, and storage/email adapters.",
      "architectureNotes": "Repository README: controllers expose guarded REST routes; services contain workflows; repositories wrap Prisma; shared integrations live under src/infra; API and worker bootstraps are separate. GitHub metadata: primary language TypeScript, default branch main, license not reported.",
      "techStack": [
        "TypeScript",
        "NestJS",
        "Argon2",
        "BullMQ",
        "Nodemailer",
        "Passport",
        "Socket.IO",
        "Prisma Client",
        "ioredis",
        "Prisma",
        "GitHub Actions",
        "Autocannon (Load)",
        "Jest",
        "ESLint",
        "Prettier",
        "Swagger",
        "Passport JWT",
        "RBAC",
        "PostgreSQL",
        "Redis"
      ],
      "infrastructureDeps": [
        "gh-infra-2",
        "gh-infra-5",
        "gh-infra-10",
        "gh-infra-11",
        "gh-infra-13",
        "gh-infra-16",
        "gh-infra-22",
        "gh-infra-24",
        "gh-infra-25"
      ],
      "subsystems": [
        {
          "id": "tdb-api",
          "name": "Guarded REST API",
          "category": "backend",
          "role": "Request validation and workflow entry",
          "protocol": "HTTPS / REST",
          "description": "NestJS controllers, DTOs, Swagger, and scope-aware guards expose the API surface.",
          "tech": [
            "NestJS",
            "TypeScript",
            "Swagger"
          ],
          "coordinates": {
            "x": -58,
            "y": -28,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdb-auth",
          "name": "Tenant & Access Boundary",
          "category": "auth",
          "role": "Resolve identity and authorization scope",
          "protocol": "JWT",
          "description": "JWT, organization, building, permission, owner, and provider guards protect records before service mutations.",
          "tech": [
            "Passport JWT",
            "Argon2",
            "RBAC"
          ],
          "coordinates": {
            "x": 0,
            "y": -38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdb-data",
          "name": "Property Data Layer",
          "category": "database",
          "role": "Persist multi-tenant operational data",
          "description": "Prisma repositories map organizations, buildings, units, leases, residents, owners, maintenance, and messaging to PostgreSQL.",
          "tech": [
            "Prisma",
            "PostgreSQL"
          ],
          "coordinates": {
            "x": 58,
            "y": -20,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdb-realtime",
          "name": "Notification Gateway",
          "category": "backend",
          "role": "Persist and emit realtime updates",
          "protocol": "WebSocket",
          "description": "Notifications are stored in PostgreSQL and emitted over the /notifications Socket.IO namespace.",
          "tech": [
            "Socket.IO",
            "PostgreSQL"
          ],
          "coordinates": {
            "x": -35,
            "y": 35,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "tdb-worker",
          "name": "Delivery Worker",
          "category": "worker",
          "role": "Run delivery work outside HTTP",
          "protocol": "Queue",
          "description": "A separate worker bootstrap supports optional BullMQ/Redis delivery tasks.",
          "tech": [
            "BullMQ",
            "Redis"
          ],
          "coordinates": {
            "x": 34,
            "y": 38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "2.8 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [
        {
          "decision": "Resolve tenant scope before business mutations",
          "rationale": "The README identifies tenant isolation as the core boundary.",
          "tradeoff": "Every feature flow must consistently apply organization and building scope.",
          "provenance": "CURATED"
        },
        {
          "decision": "Separate API and worker bootstraps",
          "rationale": "Delivery tasks can execute outside the HTTP process.",
          "tradeoff": "Queue-backed deployment adds Redis and worker operations when enabled.",
          "provenance": "CURATED"
        }
      ],
      "resilienceTesting": "Repository evidence: Jest integration/e2e coverage, an autocannon load-test script, and a Socket.IO notification smoke script are provided. The README says the implementation should be reviewed before production use.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "CURATED",
        "solution": "CURATED",
        "architectureNotes": "CURATED",
        "subsystems": "CURATED",
        "keyDecisions": "CURATED",
        "resilienceTesting": "CURATED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "Autocannon (Load)",
          "Jest"
        ],
        "ciWorkflows": [
          "GitHub Actions"
        ],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint",
          "Prettier"
        ],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": true,
        "testFilesDetected": 95,
        "summary": "Unit/integration test suite configured (Autocannon (Load), Jest). Automated verification pipeline via GitHub Actions. Static analysis & code quality enforced with ESLint, Prettier. 95 test files detected in repository structure.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/towerdesk-backend",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1301560608",
      "code": "GH-06",
      "title": "formcrash",
      "tagline": "FormCrash Lab is a pre-production resilience-testing workbench for transactional web journeys.  It records a normal journey, lets the developer attach a controlled failure experiment to a precise step",
      "category": "fullstack",
      "classifications": [
        "fullstack",
        "tooling",
        "frontend",
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 119,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 260,
        "y": -40
      },
      "accentColor": "#8EA9DA",
      "summary": "FormCrash Lab is a pre-production resilience-testing workbench for transactional web journeys.  It records a normal journey, lets the developer attach a controlled failure experiment to a precise step GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "Reproduce timing and repeated-action failures in transactional browser journeys before production.",
      "solution": "A local-first workspace records critical journeys, injects controlled repeated actions, evaluates approved outcomes, and persists ordered evidence and screenshots.",
      "architectureNotes": "Repository README: a Next.js dashboard calls a Fastify control server that owns Playwright execution, SQLite persistence, screenshots, and an SSE event stream; shared packages hold contracts and test fixtures. GitHub metadata: primary language TypeScript, default branch main, license MIT.",
      "techStack": [
        "TypeScript",
        "Next.js",
        "React",
        "React DOM",
        "Fastify",
        "better-sqlite3",
        "Vitest",
        "React Testing Library",
        "Playwright",
        "ESLint",
        "Prettier",
        "Chromium",
        "SSE",
        "SQLite"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-5",
        "gh-infra-6",
        "gh-infra-8",
        "gh-infra-9",
        "gh-infra-17",
        "gh-infra-26"
      ],
      "subsystems": [
        {
          "id": "fc-dashboard",
          "name": "Control Dashboard",
          "category": "frontend",
          "role": "Configure journeys, tests, and inspect runs",
          "protocol": "HTTPS / REST",
          "description": "The Next.js interface renders server-authoritative projects, journeys, tests, runs, evidence, and verdicts.",
          "tech": [
            "Next.js",
            "React"
          ],
          "coordinates": {
            "x": -52,
            "y": -28,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "fc-runner",
          "name": "Browser Runner",
          "category": "worker",
          "role": "Replay and perturb browser journeys",
          "description": "A server-owned Playwright runner injects double, triple, and delayed repeated actions.",
          "tech": [
            "Playwright",
            "Chromium"
          ],
          "coordinates": {
            "x": 42,
            "y": -30,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "fc-control",
          "name": "Control Server",
          "category": "backend",
          "role": "Own execution and canonical results",
          "protocol": "REST / SSE",
          "description": "Fastify APIs coordinate browser state, persistence, screenshots, and SSE updates.",
          "tech": [
            "Fastify",
            "SSE"
          ],
          "coordinates": {
            "x": 0,
            "y": 5,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "fc-store",
          "name": "Run Evidence Store",
          "category": "database",
          "role": "Persist durable test history",
          "description": "SQLite stores projects, immutable journey/test versions, events, assertions, and observed evidence.",
          "tech": [
            "SQLite"
          ],
          "coordinates": {
            "x": -15,
            "y": 42,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "8.2 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "MIT",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [
        {
          "decision": "Keep recommendations deterministic at runtime",
          "rationale": "The repository requires no model or OpenAI API key while running.",
          "tradeoff": "Recommendations are intentionally bounded rather than open-ended.",
          "provenance": "CURATED"
        },
        {
          "decision": "Make the server authoritative for executions",
          "rationale": "Browser state, evidence, and verdicts remain consistent and durable.",
          "tradeoff": "The dashboard depends on the local control server and installed Chromium.",
          "provenance": "CURATED"
        }
      ],
      "resilienceTesting": "The project is itself a resilience-testing workbench. Its bundled deterministic demo verifies that a vulnerable repeated checkout creates two orders while an idempotent implementation creates one; this is demo evidence, not a production benchmark.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "CURATED",
        "solution": "CURATED",
        "architectureNotes": "CURATED",
        "subsystems": "CURATED",
        "keyDecisions": "CURATED",
        "resilienceTesting": "CURATED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "Vitest",
          "React Testing Library"
        ],
        "ciWorkflows": [],
        "e2eHarnesses": [
          "Playwright"
        ],
        "lintersAndFormatters": [
          "ESLint",
          "Prettier",
          "TypeScript Type-Check"
        ],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": true,
        "testFilesDetected": 63,
        "summary": "No external SaaS application, account, or test data is required to evaluate the core project.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/formcrash",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1237812647",
      "code": "GH-07",
      "title": "grok-flow-image-gen",
      "tagline": "Local image-generation console for Grok and Google Flow, built with Node.js, Express, and Playwright. Uses browser UI automation, not official APIs.",
      "category": "backend",
      "classifications": [
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 100,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -280,
        "y": -40
      },
      "accentColor": "#8EA9DA",
      "summary": "Local image-generation console for Grok and Google Flow, built with Node.js, Express, and Playwright. Uses browser UI automation, not official APIs. GitHub reports 1 stars, 0 forks, and 0 open issues.",
      "problem": "Local image-generation console for two browser-driven providers:",
      "solution": "Layered architecture decomposed into Express Backend Service.",
      "architectureNotes": "Verified metadata only: primary language JavaScript, default branch main, license not reported.",
      "techStack": [
        "JavaScript",
        "Express",
        "Playwright",
        "Automation",
        "Browser Automation",
        "Cookies",
        "Flow",
        "Grok",
        "Image Generation",
        "Local Tool",
        "Nodejs"
      ],
      "infrastructureDeps": [
        "gh-infra-4",
        "gh-infra-5",
        "gh-infra-7",
        "gh-infra-8"
      ],
      "subsystems": [
        {
          "id": "grok-flow-image-gen-layer-1",
          "name": "Express Backend Service",
          "category": "backend",
          "role": "Business transactions, routing, and workflow orchestration",
          "protocol": "HTTPS / REST",
          "description": "Architectural tier derived from verified Express configuration.",
          "tech": [
            "Express"
          ],
          "coordinates": {
            "x": 0,
            "y": 0,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "1 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "3.7 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "JavaScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "End-to-end browser automation configured (Playwright).",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "DERIVED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [],
        "e2eHarnesses": [
          "Playwright"
        ],
        "lintersAndFormatters": [],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 0,
        "summary": "End-to-end browser automation configured (Playwright).",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/grok-flow-image-gen",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1299619574",
      "code": "GH-08",
      "title": "GitArchaeologist",
      "tagline": "A code time machine that traces commits back to the conversations, tickets, and decisions that created them, helping engineers understand historical context instantly.",
      "category": "fullstack",
      "classifications": [
        "fullstack",
        "frontend",
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 89,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 0,
        "y": 190
      },
      "accentColor": "#F59E0B",
      "summary": "A code time machine that traces commits back to the conversations, tickets, and decisions that created them, helping engineers understand historical context instantly. GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "GitArchaeologist imports bounded Git and GitHub pull-request evidence and turns it into a deterministic investigation graph.",
      "solution": "Layered architecture decomposed into Lucide Icons Client Surface, Python Backend Service, SQLAlchemy Schema Store.",
      "architectureNotes": "Verified metadata only: primary language Python, default branch main, license not reported.",
      "techStack": [
        "Python",
        "Lucide Icons",
        "Next.js",
        "React",
        "React DOM",
        "Tailwind CSS",
        "FastAPI",
        "SQLAlchemy",
        "pytest",
        "TypeScript",
        "Pydantic"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-3",
        "gh-infra-6",
        "gh-infra-14"
      ],
      "subsystems": [
        {
          "id": "gitarchaeologist-layer-1",
          "name": "Lucide Icons Client Surface",
          "category": "frontend",
          "role": "Client rendering, UI components, and state synchronization",
          "description": "Architectural tier derived from verified Lucide Icons, Next.js, React, React DOM, Tailwind CSS configuration.",
          "tech": [
            "Lucide Icons",
            "Next.js",
            "React",
            "React DOM",
            "Tailwind CSS"
          ],
          "coordinates": {
            "x": -50,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        },
        {
          "id": "gitarchaeologist-layer-2",
          "name": "Python Backend Service",
          "category": "backend",
          "role": "Business transactions, routing, and workflow orchestration",
          "protocol": "HTTPS / REST",
          "description": "Architectural tier derived from verified Python, FastAPI configuration.",
          "tech": [
            "Python",
            "FastAPI"
          ],
          "coordinates": {
            "x": 40,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        },
        {
          "id": "gitarchaeologist-layer-3",
          "name": "SQLAlchemy Schema Store",
          "category": "database",
          "role": "Persistent storage, schema invariants, and data models",
          "description": "Architectural tier derived from verified SQLAlchemy configuration.",
          "tech": [
            "SQLAlchemy"
          ],
          "coordinates": {
            "x": 0,
            "y": 35,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "0.2 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "Python",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Backend checks from `backend/`:",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "DERIVED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "pytest"
        ],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 3,
        "summary": "Backend checks from `backend/`:",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/GitArchaeologist",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1300791569",
      "code": "GH-09",
      "title": "seedstory",
      "tagline": "Scenario-aware demo and test data generation for Prisma applications.",
      "category": "tooling",
      "classifications": [
        "tooling",
        "frontend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 89,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -160,
        "y": 240
      },
      "accentColor": "#8EA9DA",
      "summary": "Scenario-aware demo and test data generation for Prisma applications. GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "SeedStory turns a Prisma schema into deterministic, relationship-aware and time-aware demo data. It is a local-first developer tool: schema text, configuration and generated records remain in browser memory. There is no authentication, database, telemetry, cloud persistence or runtime AI call.",
      "solution": "The UI depends on pure TypeScript domain modules:",
      "architectureNotes": "Repository README (Architecture): The UI depends on pure TypeScript domain modules: GitHub metadata: primary language TypeScript, default branch main, license MIT.",
      "techStack": [
        "TypeScript",
        "Lucide Icons",
        "Next.js",
        "React",
        "React DOM",
        "Tailwind CSS",
        "Vitest",
        "ESLint"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-3",
        "gh-infra-6",
        "gh-infra-9"
      ],
      "subsystems": [
        {
          "id": "seedstory-1-components",
          "name": "Components",
          "category": "backend",
          "role": "owns React state, visualization and browser downloads only.",
          "description": "owns React state, visualization and browser downloads only.",
          "tech": [
            "React"
          ],
          "coordinates": {
            "x": 0,
            "y": 0,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "VERIFIED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "0.1 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "MIT",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Unit/integration test suite configured (Vitest). Static analysis & code quality enforced with ESLint, TypeScript Type-Check. 4 test files detected in repository structure.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "VERIFIED",
        "architectureNotes": "VERIFIED",
        "subsystems": "VERIFIED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "Vitest"
        ],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint",
          "TypeScript Type-Check"
        ],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 4,
        "summary": "Unit/integration test suite configured (Vitest). Static analysis & code quality enforced with ESLint, TypeScript Type-Check. 4 test files detected in repository structure.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/seedstory",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1237757392",
      "code": "GH-10",
      "title": "pillcheck-public",
      "tagline": "Medication reminder app with caregiver support, dose tracking, refill alerts, and backend-driven notifications.",
      "category": "fullstack",
      "classifications": [
        "fullstack",
        "infrastructure",
        "frontend",
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 116,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 220,
        "y": 220
      },
      "accentColor": "#8EA9DA",
      "summary": "Medication reminder app with caregiver support, dose tracking, refill alerts, and backend-driven notifications. GitHub reports 0 stars, 1 forks, and 0 open issues.",
      "problem": "Help patients confirm scheduled medication and escalate late or missed doses to caregivers.",
      "solution": "A React Native/Expo client plus Node.js/PostgreSQL backend workflows for schedules, dose state, caregiver access, inventory, reminders, and push notifications.",
      "architectureNotes": "Repository README: the mobile app uses a custom backend as the active runtime path; a backend worker generates doses and checks overdue doses and refill thresholds. GitHub metadata: primary language TypeScript, default branch main, license not reported.",
      "techStack": [
        "TypeScript",
        "Expo",
        "React",
        "React DOM",
        "React Native",
        "Express",
        "Nodemailer",
        "Firebase Admin",
        "PostgreSQL (pg)",
        "Docker",
        "GitHub Actions",
        "Vitest",
        "ESLint",
        "Nodejs",
        "Pill Tracker",
        "Postgresql",
        "Push Notifications",
        "Refill Alerts",
        "Node.js",
        "PostgreSQL"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-5",
        "gh-infra-7",
        "gh-infra-9",
        "gh-infra-12",
        "gh-infra-13",
        "gh-infra-15"
      ],
      "subsystems": [
        {
          "id": "pc-mobile",
          "name": "Medication Mobile App",
          "category": "frontend",
          "role": "Schedule, confirm, and monitor medication",
          "description": "React Native screens provide dose confirmation, reminders, caregiver access, and inventory tracking.",
          "tech": [
            "React Native",
            "Expo"
          ],
          "coordinates": {
            "x": -48,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "pc-api",
          "name": "Medication API",
          "category": "backend",
          "role": "Persist schedules and caregiver workflows",
          "protocol": "HTTPS / REST",
          "description": "The custom Node.js backend handles user, prescription, schedule, and notification workflows.",
          "tech": [
            "Node.js",
            "TypeScript"
          ],
          "coordinates": {
            "x": 42,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "pc-db",
          "name": "Medication Store",
          "category": "database",
          "role": "Persist medication and dose state",
          "description": "PostgreSQL is the active backend data store.",
          "tech": [
            "PostgreSQL"
          ],
          "coordinates": {
            "x": 0,
            "y": 36,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "pc-worker",
          "name": "Reminder Worker",
          "category": "worker",
          "role": "Generate and evaluate timed work",
          "protocol": "Scheduled jobs",
          "description": "A backend worker generates doses and runs overdue and refill checks.",
          "tech": [
            "Node.js"
          ],
          "coordinates": {
            "x": 55,
            "y": 38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "1 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "7.6 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [
        {
          "decision": "Use the custom backend as the active runtime path",
          "rationale": "Scheduling, caregiver, and notification workflows require server-owned state.",
          "tradeoff": "The app requires a configured API and PostgreSQL service.",
          "provenance": "CURATED"
        },
        {
          "decision": "Retain Firebase code only for migration/import",
          "rationale": "The README explicitly separates migration code from the active runtime path.",
          "tradeoff": "Legacy migration code remains present and must not be mistaken for the current architecture.",
          "provenance": "CURATED"
        }
      ],
      "resilienceTesting": "Repository evidence: the app CI script runs lint plus backend CI, and staging smoke/load scripts are provided. No production benchmark or delivery SLA is claimed.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "CURATED",
        "solution": "CURATED",
        "architectureNotes": "CURATED",
        "subsystems": "CURATED",
        "keyDecisions": "CURATED",
        "resilienceTesting": "CURATED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "Vitest"
        ],
        "ciWorkflows": [
          "GitHub Actions"
        ],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint"
        ],
        "buildTools": [],
        "hasDocker": true,
        "hasMigrations": false,
        "testFilesDetected": 8,
        "summary": "Unit/integration test suite configured (Vitest). Automated verification pipeline via GitHub Actions. Static analysis & code quality enforced with ESLint. 8 test files detected in repository structure. Containerized execution environment (Dockerfile/Compose).",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/pillcheck-public",
        "caseStudy": false
      }
    },
    {
      "id": "gh-929426683",
      "code": "GH-11",
      "title": "AutoExperts-Frontend",
      "tagline": "AutoExperts frontend for car inspection bookings, used-car listings, auctions, member accounts, price prediction, and AI car assistance.",
      "category": "frontend",
      "classifications": [
        "frontend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 116,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -330,
        "y": 180
      },
      "accentColor": "#8EA9DA",
      "summary": "AutoExperts frontend for car inspection bookings, used-car listings, auctions, member accounts, price prediction, and AI car assistance. GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "Before running the project, make sure you have:",
      "solution": "Layered architecture decomposed into Framer Motion Client Surface.",
      "architectureNotes": "Verified metadata only: primary language JavaScript, default branch main, license not reported.",
      "techStack": [
        "JavaScript",
        "Framer Motion",
        "Lucide Icons",
        "React",
        "React DOM",
        "Tailwind CSS",
        "Vite",
        "ESLint",
        "Car Listings",
        "Chatbot",
        "Price Prediction",
        "Tailwindcss"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-3",
        "gh-infra-4"
      ],
      "subsystems": [
        {
          "id": "autoexperts-frontend-layer-1",
          "name": "Framer Motion Client Surface",
          "category": "frontend",
          "role": "Client rendering, UI components, and state synchronization",
          "description": "Architectural tier derived from verified Framer Motion, Lucide Icons, React, React DOM, Tailwind CSS configuration.",
          "tech": [
            "Framer Motion",
            "Lucide Icons",
            "React",
            "React DOM",
            "Tailwind CSS"
          ],
          "coordinates": {
            "x": 0,
            "y": 0,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "7.5 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "JavaScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Static analysis & code quality enforced with ESLint.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "DERIVED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint"
        ],
        "buildTools": [
          "Vite"
        ],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 0,
        "summary": "Static analysis & code quality enforced with ESLint.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/AutoExperts-Frontend",
        "caseStudy": false
      }
    },
    {
      "id": "gh-929445293",
      "code": "GH-12",
      "title": "Admin-Dashboard",
      "tagline": "AutoExperts admin dashboard for managing members, inspection bookings, used cars, auction cars, uploads, and real-time auction data.",
      "category": "frontend",
      "classifications": [
        "frontend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 94,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 320,
        "y": -180
      },
      "accentColor": "#8EA9DA",
      "summary": "AutoExperts admin dashboard for managing members, inspection bookings, used cars, auction cars, uploads, and real-time auction data. GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "AutoExperts Admin Dashboard is a React + Vite admin panel for managing the AutoExperts platform. It provides admin login, dashboard stats, member management, inspection bookings, used-car listings, auction listings, car upload forms, auction upload forms, and update/detail pages for vehicle records.",
      "solution": "Layered architecture decomposed into Framer Motion Client Surface.",
      "architectureNotes": "Repository README (Project Structure):  GitHub metadata: primary language JavaScript, default branch main, license not reported.",
      "techStack": [
        "JavaScript",
        "Framer Motion",
        "Lucide Icons",
        "React",
        "React DOM",
        "Tailwind CSS",
        "Vite",
        "ESLint",
        "Auction System",
        "Axios",
        "Booking Management System",
        "Car Management",
        "Dashboard",
        "Javascript",
        "Socket Io"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-3",
        "gh-infra-4"
      ],
      "subsystems": [
        {
          "id": "admin-dashboard-layer-1",
          "name": "Framer Motion Client Surface",
          "category": "frontend",
          "role": "Client rendering, UI components, and state synchronization",
          "description": "Architectural tier derived from verified Framer Motion, Lucide Icons, React, React DOM, Tailwind CSS configuration.",
          "tech": [
            "Framer Motion",
            "Lucide Icons",
            "React",
            "React DOM",
            "Tailwind CSS"
          ],
          "coordinates": {
            "x": 0,
            "y": 0,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "2.1 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "JavaScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Static analysis & code quality enforced with ESLint.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "DERIVED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint"
        ],
        "buildTools": [
          "Vite"
        ],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 0,
        "summary": "Static analysis & code quality enforced with ESLint.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/Admin-Dashboard",
        "caseStudy": false
      }
    },
    {
      "id": "gh-913331020",
      "code": "GH-13",
      "title": "AutoExperts-Server-BACKEND-",
      "tagline": "AutoExperts backend API for bookings, members, used cars, auctions, bidding, payments, uploads, and real-time updates.",
      "category": "backend",
      "classifications": [
        "backend",
        "infrastructure"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 120,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -475,
        "y": 0
      },
      "accentColor": "#8EA9DA",
      "summary": "AutoExperts backend API for bookings, members, used cars, auctions, bidding, payments, uploads, and real-time updates. GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "AutoExperts Server Backend is a Node.js, Express, and MongoDB backend API for the AutoExperts platform. It powers admin authentication, member registration, vehicle inspection bookings, used-car listings, auction cars, bidding, email verification, Stripe payments, subscriptions, file uploads, real-time auction updates, and scheduled background...",
      "solution": "Layered architecture decomposed into Express Backend Service, Mongoose Schema Store, Deployment & CI Matrix.",
      "architectureNotes": "Verified metadata only: primary language JavaScript, default branch main, license not reported.",
      "techStack": [
        "JavaScript",
        "Express",
        "Nodemailer",
        "Socket.IO",
        "Mongoose",
        "Docker",
        "GitHub Actions",
        "Api",
        "Auction System",
        "Backend",
        "Mongodb",
        "Nodejs",
        "Twillio"
      ],
      "infrastructureDeps": [
        "gh-infra-4",
        "gh-infra-5",
        "gh-infra-7",
        "gh-infra-11",
        "gh-infra-12",
        "gh-infra-19"
      ],
      "subsystems": [
        {
          "id": "autoexperts-server-backend--layer-1",
          "name": "Express Backend Service",
          "category": "backend",
          "role": "Business transactions, routing, and workflow orchestration",
          "protocol": "WebSocket",
          "description": "Architectural tier derived from verified Express, Nodemailer, Socket.IO configuration.",
          "tech": [
            "Express",
            "Nodemailer",
            "Socket.IO"
          ],
          "coordinates": {
            "x": -50,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        },
        {
          "id": "autoexperts-server-backend--layer-2",
          "name": "Mongoose Schema Store",
          "category": "database",
          "role": "Persistent storage, schema invariants, and data models",
          "description": "Architectural tier derived from verified Mongoose configuration.",
          "tech": [
            "Mongoose"
          ],
          "coordinates": {
            "x": 40,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        },
        {
          "id": "autoexperts-server-backend--layer-3",
          "name": "Deployment & CI Matrix",
          "category": "telemetry",
          "role": "Continuous integration, container runtime, and build pipelines",
          "protocol": "GitHub Actions",
          "description": "Architectural tier derived from verified Docker, GitHub Actions configuration.",
          "tech": [
            "Docker",
            "GitHub Actions"
          ],
          "coordinates": {
            "x": 0,
            "y": 35,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "14.9 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "JavaScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Automated verification pipeline via GitHub Actions. 5 test files detected in repository structure. Containerized execution environment (Dockerfile/Compose).",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "DERIVED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [
          "GitHub Actions"
        ],
        "e2eHarnesses": [],
        "lintersAndFormatters": [],
        "buildTools": [],
        "hasDocker": true,
        "hasMigrations": false,
        "testFilesDetected": 5,
        "summary": "Automated verification pipeline via GitHub Actions. 5 test files detected in repository structure. Containerized execution environment (Dockerfile/Compose).",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/AutoExperts-Server-BACKEND-",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1128809227",
      "code": "GH-14",
      "title": "worthy-crm",
      "tagline": "A PHP/MySQL real estate CRM for managing leads, agent follow-ups, call proof uploads, and performance reporting.",
      "category": "fullstack",
      "classifications": [
        "fullstack",
        "frontend",
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 120,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": -350,
        "y": -250
      },
      "accentColor": "#A78BFA",
      "summary": "A PHP/MySQL real estate CRM for managing leads, agent follow-ups, call proof uploads, and performance reporting. GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "Coordinate real estate sales workflows, lead assignments, and sequential follow-up attempts while enforcing role isolation between Admin, CEO, and Agents and requiring verified call/WhatsApp evidence.",
      "solution": "A PHP 8 / MySQL web application with session-based RBAC, transaction-safe bulk lead entry, sequential agent follow-up validations with mandatory screenshot proof, structured audit logging, automated system notifications, and an HTTP/cache-backed external property catalogue.",
      "architectureNotes": "Repository source: controllers and middleware enforce auth, CSRF, and role boundaries; AdminLeadsController wraps multi-row lead creation in database transactions; AgentLeadsController enforces sequential attempt constraints and mandatory screenshot uploads; AuditLog writes structured user events; external_projects_service integrates with downstream Remapp API using JSON disk caching. GitHub metadata: primary language HTML, default branch main, license not reported.",
      "techStack": [
        "HTML",
        "PHPUnit",
        "TypeScript",
        "Admin Dashboard",
        "Crm Platform",
        "Lead Generation",
        "Lead Management",
        "Mysql",
        "Php",
        "Role Based",
        "PHP 8",
        "MySQL",
        "RBAC",
        "PDO",
        "JSON",
        "Cron",
        "cURL",
        "JSON Cache"
      ],
      "infrastructureDeps": [
        "gh-infra-2",
        "gh-infra-20",
        "gh-infra-23"
      ],
      "subsystems": [
        {
          "id": "wcrm-auth",
          "name": "Role Boundary & Session Auth",
          "category": "auth",
          "role": "Enforce user roles and session boundaries",
          "description": "Admin, CEO, and Agent role segregation with session management, CSRF protection, and brute-force login lockouts.",
          "tech": [
            "PHP 8",
            "MySQL",
            "RBAC"
          ],
          "coordinates": {
            "x": -50,
            "y": -28,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "wcrm-leads",
          "name": "Transactional Lead Pipeline",
          "category": "backend",
          "role": "Manage lead assignments and followups",
          "description": "Multi-row lead entry saved in single transactions; agents see only assigned leads with sequential attempt constraints and mandatory screenshot proof.",
          "tech": [
            "PHP 8",
            "PDO",
            "MySQL"
          ],
          "coordinates": {
            "x": 0,
            "y": -38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "wcrm-audit",
          "name": "Structured Audit Logger",
          "category": "telemetry",
          "role": "Track operational mutations and security events",
          "description": "AuditLog model records user actions, action types, JSON metadata, IP addresses, and timestamps to audit_logs table.",
          "tech": [
            "MySQL",
            "JSON"
          ],
          "coordinates": {
            "x": 52,
            "y": -20,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "wcrm-notify",
          "name": "Automated System Notifications",
          "category": "worker",
          "role": "Process scheduled alerts and escalations",
          "protocol": "Scheduled jobs",
          "description": "Cron-triggered SystemTasksController processes idle leads, upcoming followups, overdue escalations, and retention purging with dedup keys.",
          "tech": [
            "PHP 8",
            "Cron",
            "MySQL"
          ],
          "coordinates": {
            "x": -35,
            "y": 35,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "wcrm-ext",
          "name": "External Property Adapter",
          "category": "backend",
          "role": "Consume external property catalogue",
          "protocol": "HTTPS / REST",
          "description": "HTTP client with Bearer authentication and disk-cache fallback consuming external property endpoints without relational DB coupling.",
          "tech": [
            "cURL",
            "JSON Cache"
          ],
          "coordinates": {
            "x": 36,
            "y": 38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "32.9 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "HTML",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [
        {
          "decision": "Wrap bulk lead entry in single database transactions",
          "rationale": "All rows succeed or roll back together, preventing partial or corrupt lead imports.",
          "tradeoff": "Requires strict per-row pre-validation before committing.",
          "provenance": "CURATED"
        },
        {
          "decision": "Cache external property catalogue to disk rather than relational DB sync",
          "rationale": "Isolates the core operational CRM database from external catalogue volatility and schema changes.",
          "tradeoff": "Catalogue updates rely on scheduled refresh and disk-cache reads.",
          "provenance": "CURATED"
        }
      ],
      "resilienceTesting": "Repository evidence: PDO prepared statements for SQL injection prevention, CSRF validation on all mutations, brute-force lockout (5 attempts / 10 mins), file upload mime/size validation with random filenames, and PHPUnit test suite configuration.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "CURATED",
        "solution": "CURATED",
        "architectureNotes": "CURATED",
        "subsystems": "CURATED",
        "keyDecisions": "CURATED",
        "resilienceTesting": "CURATED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "PHPUnit"
        ],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "TypeScript Type-Check"
        ],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 3,
        "summary": "Unit/integration test suite configured (PHPUnit). Static analysis & code quality enforced with TypeScript Type-Check. 3 test files detected in repository structure.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": true,
        "notes": "A ready-to-run web app with 3 roles:"
      },
      "links": {
        "github": "https://github.com/SalAkBuK/worthy-crm",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1133595694",
      "code": "GH-15",
      "title": "remapp-scraper",
      "tagline": "Remapp Scraper is a small data-fetching and API service that collects project data from Remapp, caches it as JSON, normalizes the results into a consistent schema, and serves the data through a simple Node.js API for downstream systems.",
      "category": "backend",
      "classifications": [
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2026",
      "dimensions": {
        "width": 120,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 0,
        "y": -325
      },
      "accentColor": "#8EA9DA",
      "summary": "Remapp Scraper is a small data-fetching and API service that collects project data from Remapp, caches it as JSON, normalizes the results into a consistent schema, and serves the data through a simple Node.js API for downstream systems. GitHub reports 0 stars, 0 forks, and 0 open issues.",
      "problem": "Ingest large-scale real estate listings and detail records from the Remapp API without running into rate limits or memory exhaustion, and serve fresh structured property data to downstream CRM systems.",
      "solution": "A Python batch ingestion worker with retry backoff, incremental state tracking, and JSONL caching, paired with a Node.js/Express API server exposing authenticated endpoints for data retrieval and on-demand refresh triggers.",
      "architectureNotes": "Repository source: dist/fetch_public_projects.py performs direct HTTP requests to Remapp API endpoints with Bearer auth, exponential backoff (MAX_RETRIES=5), rate-limit recovery (429), and incremental JSONL caching; server.js provides API-key protected REST endpoints (/projects, /projects/:id, /refresh, /refresh/status) serving normalized JSON outputs. GitHub metadata: primary language JavaScript, default branch master, license not reported.",
      "techStack": [
        "JavaScript",
        "Express",
        "Playwright",
        "Jest",
        "Api",
        "Automation",
        "Data Fetcher",
        "Data Pipeline",
        "Dubai Real Estate",
        "Json",
        "Nodejs",
        "Normalization",
        "Python",
        "Web Scraping",
        "Requests",
        "JSONL",
        "File System",
        "Node.js"
      ],
      "infrastructureDeps": [
        "gh-infra-4",
        "gh-infra-5",
        "gh-infra-7",
        "gh-infra-8",
        "gh-infra-10",
        "gh-infra-14"
      ],
      "subsystems": [
        {
          "id": "rmp-fetcher",
          "name": "Resilient API Fetcher",
          "category": "worker",
          "role": "Ingest project list and detail records",
          "description": "Python batch worker calling Remapp API endpoints with automated credential login, retry backoff, and 429 recovery.",
          "tech": [
            "Python",
            "Requests"
          ],
          "coordinates": {
            "x": -48,
            "y": -25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "rmp-state",
          "name": "Incremental State Engine",
          "category": "database",
          "role": "Manage fetch progress and detail cache",
          "description": "Incremental state and JSONL detail caching preventing redundant network fetches and supporting resumable sync.",
          "tech": [
            "JSONL",
            "File System"
          ],
          "coordinates": {
            "x": 0,
            "y": -36,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "rmp-api",
          "name": "Protected Gateway API",
          "category": "backend",
          "role": "Serve cached data to downstream systems",
          "protocol": "HTTPS / REST",
          "description": "Node.js/Express server exposing authenticated /projects, /projects/:id, /refresh, and /refresh/status endpoints.",
          "tech": [
            "Node.js",
            "Express"
          ],
          "coordinates": {
            "x": 48,
            "y": 25,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        },
        {
          "id": "rmp-norm",
          "name": "Data Normalization Layer",
          "category": "backend",
          "role": "Structure and format property metadata",
          "description": "Normalizes raw API payloads into consistent project schemas and price/handover structures.",
          "tech": [
            "JavaScript",
            "Python"
          ],
          "coordinates": {
            "x": -25,
            "y": 38,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "CURATED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "43.4 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "JavaScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [
        {
          "decision": "Use direct API integration rather than browser scraping",
          "rationale": "Direct JSON endpoints provide structured data, faster execution, and lower resource overhead.",
          "tradeoff": "Requires active session token maintenance and auto-login handling.",
          "provenance": "CURATED"
        },
        {
          "decision": "Maintain JSONL detail cache with incremental state",
          "rationale": "Enables resumable fetches and avoids re-querying unchanged project details across runs.",
          "tradeoff": "Requires local disk storage management and state synchronization.",
          "provenance": "CURATED"
        }
      ],
      "resilienceTesting": "Repository evidence: retry backoff with exponential backoff on network/rate-limit failures, memory-conscious batching, API key validation, error logging to JSONL, and unit tests in test/ directory.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "CURATED",
        "solution": "CURATED",
        "architectureNotes": "CURATED",
        "subsystems": "CURATED",
        "keyDecisions": "CURATED",
        "resilienceTesting": "CURATED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [
          "Jest"
        ],
        "ciWorkflows": [],
        "e2eHarnesses": [
          "Playwright"
        ],
        "lintersAndFormatters": [],
        "buildTools": [],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 1,
        "summary": "Unit/integration test suite configured (Jest). End-to-end browser automation configured (Playwright). 1 test files detected in repository structure.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/remapp-scraper",
        "caseStudy": false
      }
    },
    {
      "id": "gh-1074198727",
      "code": "GH-16",
      "title": "psych-websites",
      "tagline": "Monorepo containing two frontend websites with different tech stacks",
      "category": "fullstack",
      "classifications": [
        "fullstack",
        "frontend",
        "backend"
      ],
      "status": "ACTIVE",
      "year": "2025",
      "dimensions": {
        "width": 120,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 350,
        "y": -250
      },
      "accentColor": "#8EA9DA",
      "summary": "Monorepo containing two frontend websites with different tech stacks GitHub reports 0 stars, 0 forks, and 1 open issues.",
      "problem": "A monorepo containing two frontend websites built with different tech stacks.",
      "solution": "Layered architecture decomposed into React Client Surface, Nodemailer Backend Service.",
      "architectureNotes": "Repository README (Repository Structure):  GitHub metadata: primary language TypeScript, default branch main, license not reported.",
      "techStack": [
        "TypeScript",
        "React",
        "React DOM",
        "Tailwind CSS",
        "Next.js",
        "GSAP",
        "Motion",
        "Nodemailer",
        "Vite",
        "ESLint"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-2",
        "gh-infra-3",
        "gh-infra-6"
      ],
      "subsystems": [
        {
          "id": "psych-websites-layer-1",
          "name": "React Client Surface",
          "category": "frontend",
          "role": "Client rendering, UI components, and state synchronization",
          "description": "Architectural tier derived from verified React, React DOM, Tailwind CSS, Next.js, GSAP, Motion configuration.",
          "tech": [
            "React",
            "React DOM",
            "Tailwind CSS",
            "Next.js",
            "GSAP",
            "Motion"
          ],
          "coordinates": {
            "x": -40,
            "y": -20,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        },
        {
          "id": "psych-websites-layer-2",
          "name": "Nodemailer Backend Service",
          "category": "backend",
          "role": "Business transactions, routing, and workflow orchestration",
          "protocol": "HTTPS / REST",
          "description": "Architectural tier derived from verified Nodemailer configuration.",
          "tech": [
            "Nodemailer"
          ],
          "coordinates": {
            "x": 40,
            "y": 20,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "85.1 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "1 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "TypeScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Static analysis & code quality enforced with ESLint.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "DERIVED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint"
        ],
        "buildTools": [
          "Vite"
        ],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 0,
        "summary": "Static analysis & code quality enforced with ESLint.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/psych-websites",
        "caseStudy": false
      }
    },
    {
      "id": "gh-929429993",
      "code": "GH-17",
      "title": "Auto-Expert-Admin-Dashboard",
      "tagline": "Public frontend repository; no description supplied on GitHub.",
      "category": "frontend",
      "classifications": [
        "frontend"
      ],
      "status": "ACTIVE",
      "year": "2025",
      "dimensions": {
        "width": 90,
        "height": 77,
        "levels": 2
      },
      "gridPosition": {
        "x": 600,
        "y": 0
      },
      "accentColor": "#8EA9DA",
      "summary": "Public repository owned by SalAkBuK. Primary language: JavaScript.",
      "problem": "This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.",
      "solution": "Layered architecture decomposed into Framer Motion Client Surface.",
      "architectureNotes": "Verified metadata only: primary language JavaScript, default branch main, license not reported.",
      "techStack": [
        "JavaScript",
        "Framer Motion",
        "Lucide Icons",
        "React",
        "React DOM",
        "Tailwind CSS",
        "Vite",
        "ESLint"
      ],
      "infrastructureDeps": [
        "gh-infra-1",
        "gh-infra-3",
        "gh-infra-4"
      ],
      "subsystems": [
        {
          "id": "auto-expert-admin-dashboard-layer-1",
          "name": "Framer Motion Client Surface",
          "category": "frontend",
          "role": "Client rendering, UI components, and state synchronization",
          "description": "Architectural tier derived from verified Framer Motion, Lucide Icons, React, React DOM, Tailwind CSS configuration.",
          "tech": [
            "Framer Motion",
            "Lucide Icons",
            "React",
            "React DOM",
            "Tailwind CSS"
          ],
          "coordinates": {
            "x": 0,
            "y": 0,
            "z": 28
          },
          "dimensions": {
            "width": 48,
            "height": 26,
            "depth": 34
          },
          "provenance": "DERIVED"
        }
      ],
      "metrics": [
        {
          "label": "Stargazers",
          "value": "0 ★",
          "note": "GitHub community stars",
          "provenance": "VERIFIED"
        },
        {
          "label": "Forks",
          "value": "0 ⑂",
          "note": "Public downstream forks",
          "provenance": "VERIFIED"
        },
        {
          "label": "Repo Footprint",
          "value": "1.3 MB",
          "note": "Source code & assets",
          "provenance": "VERIFIED"
        },
        {
          "label": "Open Issues",
          "value": "0 open",
          "note": "Issue tracker backlog",
          "provenance": "VERIFIED"
        },
        {
          "label": "Primary Language",
          "value": "JavaScript",
          "note": "Dominant language",
          "provenance": "VERIFIED"
        },
        {
          "label": "License Spec",
          "value": "Not reported",
          "note": "GitHub repository metadata",
          "provenance": "VERIFIED"
        }
      ],
      "keyDecisions": [],
      "resilienceTesting": "Static analysis & code quality enforced with ESLint.",
      "provenance": {
        "summary": "VERIFIED",
        "problem": "VERIFIED",
        "solution": "DERIVED",
        "architectureNotes": "VERIFIED",
        "subsystems": "DERIVED",
        "keyDecisions": "UNAVAILABLE",
        "resilienceTesting": "VERIFIED",
        "metrics": "VERIFIED"
      },
      "validationEvidence": {
        "testFrameworks": [],
        "ciWorkflows": [],
        "e2eHarnesses": [],
        "lintersAndFormatters": [
          "ESLint"
        ],
        "buildTools": [
          "Vite"
        ],
        "hasDocker": false,
        "hasMigrations": false,
        "testFilesDetected": 0,
        "summary": "Static analysis & code quality enforced with ESLint.",
        "provenance": "VERIFIED"
      },
      "performanceEvidence": {
        "claimed": false,
        "notes": "No runtime benchmarks or production telemetry claimed in repository."
      },
      "links": {
        "github": "https://github.com/SalAkBuK/Auto-Expert-Admin-Dashboard",
        "caseStudy": false
      }
    }
  ],
  "skills": [
    {
      "id": "gh-infra-1",
      "code": "INF-01",
      "name": "React & Component Architecture",
      "category": "frontend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 100,
        "y": 0
      },
      "systemCount": 11,
      "usedInProjects": [
        "gh-1347309405",
        "gh-1072943348",
        "gh-1121594562",
        "gh-1301560608",
        "gh-1299619574",
        "gh-1300791569",
        "gh-1237757392",
        "gh-929426683",
        "gh-929445293",
        "gh-1074198727",
        "gh-929429993"
      ],
      "primaryUseCases": [
        "Detected in 11 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-2",
      "code": "INF-02",
      "name": "TypeScript & Typed Systems & Architecture",
      "category": "fullstack",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 80,
        "y": 20
      },
      "systemCount": 10,
      "usedInProjects": [
        "gh-1347309405",
        "gh-1072943348",
        "gh-1121594562",
        "gh-1122295326",
        "gh-1301560608",
        "gh-1299619574",
        "gh-1300791569",
        "gh-1237757392",
        "gh-1128809227",
        "gh-1074198727"
      ],
      "primaryUseCases": [
        "Detected in 10 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-3",
      "code": "INF-03",
      "name": "Tailwind CSS & Design Systems & UI",
      "category": "frontend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 80,
        "y": 20
      },
      "systemCount": 8,
      "usedInProjects": [
        "gh-1347309405",
        "gh-1121594562",
        "gh-1299619574",
        "gh-1300791569",
        "gh-929426683",
        "gh-929445293",
        "gh-1074198727",
        "gh-929429993"
      ],
      "primaryUseCases": [
        "Detected in 8 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-4",
      "code": "INF-04",
      "name": "JavaScript & Application Engineering",
      "category": "fullstack",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 60,
        "y": 40
      },
      "systemCount": 6,
      "usedInProjects": [
        "gh-1237812647",
        "gh-929426683",
        "gh-929445293",
        "gh-913331020",
        "gh-1133595694",
        "gh-929429993"
      ],
      "primaryUseCases": [
        "Detected in 6 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-5",
      "code": "INF-05",
      "name": "Node.js & Application Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 60,
        "y": 60
      },
      "systemCount": 6,
      "usedInProjects": [
        "gh-1122295326",
        "gh-1301560608",
        "gh-1237812647",
        "gh-1237757392",
        "gh-913331020",
        "gh-1133595694"
      ],
      "primaryUseCases": [
        "Detected in 6 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-6",
      "code": "INF-06",
      "name": "Next.js & Full-Stack Architecture",
      "category": "fullstack",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 40,
        "y": 60
      },
      "systemCount": 5,
      "usedInProjects": [
        "gh-1121594562",
        "gh-1301560608",
        "gh-1299619574",
        "gh-1300791569",
        "gh-1074198727"
      ],
      "primaryUseCases": [
        "Detected in 5 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-7",
      "code": "INF-07",
      "name": "Express & API Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 20,
        "y": 60
      },
      "systemCount": 4,
      "usedInProjects": [
        "gh-1237812647",
        "gh-1237757392",
        "gh-913331020",
        "gh-1133595694"
      ],
      "primaryUseCases": [
        "Detected in 4 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-8",
      "code": "INF-08",
      "name": "Playwright & End-to-End Test Architecture",
      "category": "tooling",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 0,
        "y": 60
      },
      "systemCount": 4,
      "usedInProjects": [
        "gh-1121594562",
        "gh-1301560608",
        "gh-1237812647",
        "gh-1133595694"
      ],
      "primaryUseCases": [
        "Detected in 4 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-9",
      "code": "INF-09",
      "name": "Vitest & Unit & Integration Testing",
      "category": "tooling",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -40,
        "y": 80
      },
      "systemCount": 4,
      "usedInProjects": [
        "gh-1121594562",
        "gh-1301560608",
        "gh-1300791569",
        "gh-1237757392"
      ],
      "primaryUseCases": [
        "Detected in 4 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-10",
      "code": "INF-10",
      "name": "Jest & Automated Test Harness",
      "category": "tooling",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -60,
        "y": 80
      },
      "systemCount": 3,
      "usedInProjects": [
        "gh-1072943348",
        "gh-1122295326",
        "gh-1133595694"
      ],
      "primaryUseCases": [
        "Detected in 3 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-11",
      "code": "INF-11",
      "name": "Socket.IO & Realtime WebSocket Gateway",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -80,
        "y": 60
      },
      "systemCount": 3,
      "usedInProjects": [
        "gh-1121594562",
        "gh-1122295326",
        "gh-913331020"
      ],
      "primaryUseCases": [
        "Detected in 3 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-12",
      "code": "INF-12",
      "name": "Docker & Container & Deployment Architecture",
      "category": "infrastructure",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -100,
        "y": 40
      },
      "systemCount": 2,
      "usedInProjects": [
        "gh-1237757392",
        "gh-913331020"
      ],
      "primaryUseCases": [
        "Detected in 2 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-13",
      "code": "INF-13",
      "name": "PostgreSQL & Relational Database Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -120,
        "y": 20
      },
      "systemCount": 2,
      "usedInProjects": [
        "gh-1122295326",
        "gh-1237757392"
      ],
      "primaryUseCases": [
        "Detected in 2 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-14",
      "code": "INF-14",
      "name": "Python & Data & Service Engineering",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -120,
        "y": 20
      },
      "systemCount": 2,
      "usedInProjects": [
        "gh-1299619574",
        "gh-1133595694"
      ],
      "primaryUseCases": [
        "Detected in 2 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-15",
      "code": "INF-15",
      "name": "React Native & Mobile Architecture",
      "category": "frontend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -120,
        "y": -20
      },
      "systemCount": 2,
      "usedInProjects": [
        "gh-1072943348",
        "gh-1237757392"
      ],
      "primaryUseCases": [
        "Detected in 2 public GitHub repositories"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-16",
      "code": "INF-16",
      "name": "BullMQ & Distributed Queue Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -120,
        "y": -20
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1122295326"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-17",
      "code": "INF-17",
      "name": "Fastify & High-Throughput Services",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -140,
        "y": -60
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1301560608"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-18",
      "code": "INF-18",
      "name": "Google Sheets & Spreadsheet Data Integration",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -100,
        "y": -80
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1335930004"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-19",
      "code": "INF-19",
      "name": "MongoDB & Document Storage Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -80,
        "y": -100
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-913331020"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-20",
      "code": "INF-20",
      "name": "MySQL & Relational Database Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": -40,
        "y": -100
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1128809227"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-21",
      "code": "INF-21",
      "name": "n8n & Workflow Automation & Orchestration",
      "category": "infrastructure",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 0,
        "y": -120
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1335930004"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-22",
      "code": "INF-22",
      "name": "NestJS & Modular Monolith Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 20,
        "y": -120
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1122295326"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-23",
      "code": "INF-23",
      "name": "PHP & Web Application Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 60,
        "y": -100
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1128809227"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-24",
      "code": "INF-24",
      "name": "Prisma & Data Access & Schema Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 100,
        "y": -80
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1122295326"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-25",
      "code": "INF-25",
      "name": "Redis & In-Memory & Caching Systems",
      "category": "infrastructure",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 140,
        "y": -80
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1122295326"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-26",
      "code": "INF-26",
      "name": "SQLite & Embedded Storage Architecture",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 180,
        "y": -60
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1301560608"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    },
    {
      "id": "gh-infra-27",
      "code": "INF-27",
      "name": "WhatsApp Cloud API & Messaging Platform Integration",
      "category": "backend",
      "yearsActive": 0,
      "proficiencyScore": 0,
      "gridPosition": {
        "x": 180,
        "y": -40
      },
      "systemCount": 1,
      "usedInProjects": [
        "gh-1335930004"
      ],
      "primaryUseCases": [
        "Detected in 1 public GitHub repository"
      ],
      "technicalHighlights": [
        "No proficiency score or years inferred from repository metadata"
      ],
      "samplePattern": "// Evidence source: public GitHub repository metadata"
    }
  ],
  "operator": {
    "name": "SalAkBuK",
    "handle": "@SalAkBuK",
    "role": "GitHub profile",
    "location": "Not provided on GitHub",
    "status": "ACTIVE_BUILD // GITHUB SNAPSHOT",
    "focus": "Public GitHub repositories using React, TypeScript, Tailwind CSS, JavaScript",
    "yearsActive": 0,
    "commitsIndexed": "Not indexed",
    "productionUptime": "Not claimed",
    "primaryStack": [
      "React",
      "TypeScript",
      "Tailwind CSS",
      "JavaScript",
      "Node.js",
      "Next.js",
      "Express"
    ],
    "systemManifesto": "Profile synthesized from public GitHub repository metadata. Verify personal and architectural claims before publication.",
    "contact": {
      "email": "",
      "github": "https://github.com/SalAkBuK",
      "linkedin": "",
      "pgpKeyId": "",
      "pgpFingerprint": "",
      "matrix": "",
      "availability": "Not provided on GitHub"
    }
  },
  "experience": [
    {
      "id": "gh-exp-1",
      "code": "BUILD-01",
      "yearRange": "PUBLIC GITHUB SNAPSHOT",
      "role": "GitHub profile",
      "organization": "GitHub repositories",
      "location": "Not provided on GitHub",
      "systemDomain": "Public repository metadata",
      "keyOutputs": [
        "Mapped 17 public repositories returned by GitHub.",
        "Detected repository languages and topics: React, TypeScript, Tailwind CSS, JavaScript, Node.js.",
        "No employment history or performance claims inferred."
      ],
      "systemsArchitected": [
        "Systems_Cartography_Portfolio",
        "physio_bot",
        "towerdesk-mobile-app"
      ],
      "technologies": [
        "React",
        "TypeScript",
        "Tailwind CSS",
        "JavaScript",
        "Node.js"
      ],
      "gridPosition": {
        "x": -260,
        "y": 140
      }
    }
  ],
  "rawCount": 18,
  "repositoryInventoryTruncated": false,
  "inspectionSummary": {
    "canonicalRepositoryCount": 17,
    "inspectedRepositoryCount": 17,
    "warnings": []
  }
};
