import { ProjectData, SubsystemNode } from '../types';

type Evidence = Pick<ProjectData, 'problem' | 'solution' | 'architectureNotes' | 'subsystems' | 'keyDecisions' | 'resilienceTesting'>;

const subsystem = (
  id: string,
  name: string,
  category: SubsystemNode['category'],
  role: string,
  description: string,
  tech: string[],
  x: number,
  y: number,
  protocol?: string
): SubsystemNode => ({
  id,
  name,
  category,
  role,
  protocol,
  description,
  tech,
  coordinates: { x, y, z: 28 },
  dimensions: { width: 48, height: 26, depth: 34 }
});

const evidenceByRepository: Record<string, Evidence> = {
  'towerdesk-backend-clean': {
    problem: 'Coordinate multi-tenant property operations while enforcing organization, building, role, owner, and provider boundaries.',
    solution: 'A modular NestJS API backed by Prisma/PostgreSQL, with guarded REST workflows, persisted realtime notifications, optional background jobs, and storage/email adapters.',
    architectureNotes: 'Repository README: controllers expose guarded REST routes; services contain workflows; repositories wrap Prisma; shared integrations live under src/infra; API and worker bootstraps are separate.',
    subsystems: [
      subsystem('tdb-api', 'Guarded REST API', 'backend', 'Request validation and workflow entry', 'NestJS controllers, DTOs, Swagger, and scope-aware guards expose the API surface.', ['NestJS', 'TypeScript', 'Swagger'], -58, -28, 'HTTPS / REST'),
      subsystem('tdb-auth', 'Tenant & Access Boundary', 'auth', 'Resolve identity and authorization scope', 'JWT, organization, building, permission, owner, and provider guards protect records before service mutations.', ['Passport JWT', 'Argon2', 'RBAC'], 0, -38, 'JWT'),
      subsystem('tdb-data', 'Property Data Layer', 'database', 'Persist multi-tenant operational data', 'Prisma repositories map organizations, buildings, units, leases, residents, owners, maintenance, and messaging to PostgreSQL.', ['Prisma', 'PostgreSQL'], 58, -20),
      subsystem('tdb-realtime', 'Notification Gateway', 'backend', 'Persist and emit realtime updates', 'Notifications are stored in PostgreSQL and emitted over the /notifications Socket.IO namespace.', ['Socket.IO', 'PostgreSQL'], -35, 35, 'WebSocket'),
      subsystem('tdb-worker', 'Delivery Worker', 'worker', 'Run delivery work outside HTTP', 'A separate worker bootstrap supports optional BullMQ/Redis delivery tasks.', ['BullMQ', 'Redis'], 34, 38, 'Queue')
    ],
    keyDecisions: [
      { decision: 'Resolve tenant scope before business mutations', rationale: 'The README identifies tenant isolation as the core boundary.', tradeoff: 'Every feature flow must consistently apply organization and building scope.' },
      { decision: 'Separate API and worker bootstraps', rationale: 'Delivery tasks can execute outside the HTTP process.', tradeoff: 'Queue-backed deployment adds Redis and worker operations when enabled.' }
    ],
    resilienceTesting: 'Repository evidence: Jest integration/e2e coverage, an autocannon load-test script, and a Socket.IO notification smoke script are provided. The README says the implementation should be reviewed before production use.'
  },
  'tower-desk-clean': {
    problem: 'Provide role-specific building and property workflows against a separate TowerDesk API without exposing server credentials in the browser.',
    solution: 'A Next.js App Router dashboard with role-aware routes, typed API/query layers, persisted session state, realtime hooks, and server-side proxy routes for platform-only calls.',
    architectureNotes: 'Repository README: app routes and dashboards sit above feature/UI components and a shared API, query, auth, RBAC, utility, and type layer; selected platform calls use Next.js server routes.',
    subsystems: [
      subsystem('tdw-routes', 'Role-based Workspaces', 'frontend', 'Route users to appropriate operational portals', 'Platform, organization, manager, provider, and owner views expose scoped workflows.', ['Next.js', 'React'], -48, -25),
      subsystem('tdw-state', 'Client Integration Layer', 'frontend', 'Coordinate server and session state', 'TanStack Query manages server state while Zustand persists client authentication/session state.', ['TanStack Query', 'Zustand'], 12, -36),
      subsystem('tdw-proxy', 'Platform API Proxy', 'backend', 'Keep platform-key calls server-side', 'Selected Next.js API routes proxy platform operations that require a server-side key.', ['Next.js API Routes'], 52, 25, 'HTTPS / REST'),
      subsystem('tdw-realtime', 'Realtime Client', 'frontend', 'Surface messages and notifications', 'Socket.IO client hooks support notification, unread-count, and messaging experiences.', ['Socket.IO Client'], -25, 38, 'WebSocket')
    ],
    keyDecisions: [
      { decision: 'Use server routes for privileged platform calls', rationale: 'The platform API key belongs on the server boundary.', tradeoff: 'Those workflows require additional runtime environment configuration.' },
      { decision: 'Split server state from session state', rationale: 'Query caching and persisted authentication have different lifecycles.', tradeoff: 'The repository notes that local-storage token persistence needs review for high-risk deployments.' }
    ],
    resilienceTesting: 'Repository evidence: Vitest unit tests and Playwright e2e tests are configured. The sanitized README reports 60 unit-test files and 249 passing tests at its latest verification, while also disclosing remaining moderate audit findings.'
  },
  'towerdesk-mobile-showcase': {
    problem: 'Support property and concierge workflows across resident, owner, management, staff, and provider roles on mobile.',
    solution: 'An Expo Router application with guarded role workspaces, shared modal workflows, typed REST clients, secure token handling, notification capabilities, and realtime messaging.',
    architectureNotes: 'Repository README: route guards and app-state contexts organize role workspaces above a typed REST service layer with token refresh and domain clients.',
    subsystems: [
      subsystem('tdm-router', 'Role Workspace Router', 'frontend', 'Guard and organize role-specific screens', 'Expo Router and React Navigation separate resident, owner, management, employee, and provider journeys.', ['Expo Router', 'React Navigation'], -45, -28),
      subsystem('tdm-client', 'Typed API Client', 'frontend', 'Call backend domain services', 'Request helpers and domain clients handle tokens, refresh, and REST calls.', ['TypeScript', 'Axios'], 40, -26, 'HTTPS / REST'),
      subsystem('tdm-device', 'Device Services', 'frontend', 'Integrate secure storage and mobile capabilities', 'Expo modules provide SecureStore, notifications, files, images, documents, and browser handoffs.', ['Expo SecureStore', 'Expo Notifications'], 0, 38)
    ],
    keyDecisions: [
      { decision: 'Publish a sanitized showcase repository', rationale: 'The public code excludes production configuration, real contracts, credentials, and original history.', tradeoff: 'A reviewer cannot reproduce production integrations from this repository alone.' }
    ],
    resilienceTesting: 'Repository evidence: Jest/jest-expo is configured for selected workflow coverage, with lint and TypeScript type-check scripts available. The README does not claim production reliability metrics.'
  },
  'pillcheck-public': {
    problem: 'Help patients confirm scheduled medication and escalate late or missed doses to caregivers.',
    solution: 'A React Native/Expo client plus Node.js/PostgreSQL backend workflows for schedules, dose state, caregiver access, inventory, reminders, and push notifications.',
    architectureNotes: 'Repository README: the mobile app uses a custom backend as the active runtime path; a backend worker generates doses and checks overdue doses and refill thresholds.',
    subsystems: [
      subsystem('pc-mobile', 'Medication Mobile App', 'frontend', 'Schedule, confirm, and monitor medication', 'React Native screens provide dose confirmation, reminders, caregiver access, and inventory tracking.', ['React Native', 'Expo'], -48, -25),
      subsystem('pc-api', 'Medication API', 'backend', 'Persist schedules and caregiver workflows', 'The custom Node.js backend handles user, prescription, schedule, and notification workflows.', ['Node.js', 'TypeScript'], 42, -25, 'HTTPS / REST'),
      subsystem('pc-db', 'Medication Store', 'database', 'Persist medication and dose state', 'PostgreSQL is the active backend data store.', ['PostgreSQL'], 0, 36),
      subsystem('pc-worker', 'Reminder Worker', 'worker', 'Generate and evaluate timed work', 'A backend worker generates doses and runs overdue and refill checks.', ['Node.js'], 55, 38, 'Scheduled jobs')
    ],
    keyDecisions: [
      { decision: 'Use the custom backend as the active runtime path', rationale: 'Scheduling, caregiver, and notification workflows require server-owned state.', tradeoff: 'The app requires a configured API and PostgreSQL service.' },
      { decision: 'Retain Firebase code only for migration/import', rationale: 'The README explicitly separates migration code from the active runtime path.', tradeoff: 'Legacy migration code remains present and must not be mistaken for the current architecture.' }
    ],
    resilienceTesting: 'Repository evidence: the app CI script runs lint plus backend CI, and staging smoke/load scripts are provided. No production benchmark or delivery SLA is claimed.'
  },
  formcrash: {
    problem: 'Reproduce timing and repeated-action failures in transactional browser journeys before production.',
    solution: 'A local-first workspace records critical journeys, injects controlled repeated actions, evaluates approved outcomes, and persists ordered evidence and screenshots.',
    architectureNotes: 'Repository README: a Next.js dashboard calls a Fastify control server that owns Playwright execution, SQLite persistence, screenshots, and an SSE event stream; shared packages hold contracts and test fixtures.',
    subsystems: [
      subsystem('fc-dashboard', 'Control Dashboard', 'frontend', 'Configure journeys, tests, and inspect runs', 'The Next.js interface renders server-authoritative projects, journeys, tests, runs, evidence, and verdicts.', ['Next.js', 'React'], -52, -28, 'HTTPS / REST'),
      subsystem('fc-runner', 'Browser Runner', 'worker', 'Replay and perturb browser journeys', 'A server-owned Playwright runner injects double, triple, and delayed repeated actions.', ['Playwright', 'Chromium'], 42, -30),
      subsystem('fc-control', 'Control Server', 'backend', 'Own execution and canonical results', 'Fastify APIs coordinate browser state, persistence, screenshots, and SSE updates.', ['Fastify', 'SSE'], 0, 5, 'REST / SSE'),
      subsystem('fc-store', 'Run Evidence Store', 'database', 'Persist durable test history', 'SQLite stores projects, immutable journey/test versions, events, assertions, and observed evidence.', ['SQLite'], -15, 42)
    ],
    keyDecisions: [
      { decision: 'Keep recommendations deterministic at runtime', rationale: 'The repository requires no model or OpenAI API key while running.', tradeoff: 'Recommendations are intentionally bounded rather than open-ended.' },
      { decision: 'Make the server authoritative for executions', rationale: 'Browser state, evidence, and verdicts remain consistent and durable.', tradeoff: 'The dashboard depends on the local control server and installed Chromium.' }
    ],
    resilienceTesting: 'The project is itself a resilience-testing workbench. Its bundled deterministic demo verifies that a vulnerable repeated checkout creates two orders while an idempotent implementation creates one; this is demo evidence, not a production benchmark.'
  },
  'worthy-crm': {
    problem: 'Coordinate real estate sales workflows, lead assignments, and sequential follow-up attempts while enforcing role isolation between Admin, CEO, and Agents and requiring verified call/WhatsApp evidence.',
    solution: 'A PHP 8 / MySQL web application with session-based RBAC, transaction-safe bulk lead entry, sequential agent follow-up validations with mandatory screenshot proof, structured audit logging, automated system notifications, and an HTTP/cache-backed external property catalogue.',
    architectureNotes: 'Repository source: controllers and middleware enforce auth, CSRF, and role boundaries; AdminLeadsController wraps multi-row lead creation in database transactions; AgentLeadsController enforces sequential attempt constraints and mandatory screenshot uploads; AuditLog writes structured user events; external_projects_service integrates with downstream Remapp API using JSON disk caching.',
    subsystems: [
      subsystem('wcrm-auth', 'Role Boundary & Session Auth', 'auth', 'Enforce user roles and session boundaries', 'Admin, CEO, and Agent role segregation with session management, CSRF protection, and brute-force login lockouts.', ['PHP 8', 'MySQL', 'RBAC'], -50, -28),
      subsystem('wcrm-leads', 'Transactional Lead Pipeline', 'backend', 'Manage lead assignments and followups', 'Multi-row lead entry saved in single transactions; agents see only assigned leads with sequential attempt constraints and mandatory screenshot proof.', ['PHP 8', 'PDO', 'MySQL'], 0, -38),
      subsystem('wcrm-audit', 'Structured Audit Logger', 'telemetry', 'Track operational mutations and security events', 'AuditLog model records user actions, action types, JSON metadata, IP addresses, and timestamps to audit_logs table.', ['MySQL', 'JSON'], 52, -20),
      subsystem('wcrm-notify', 'Automated System Notifications', 'worker', 'Process scheduled alerts and escalations', 'Cron-triggered SystemTasksController processes idle leads, upcoming followups, overdue escalations, and retention purging with dedup keys.', ['PHP 8', 'Cron', 'MySQL'], -35, 35, 'Scheduled jobs'),
      subsystem('wcrm-ext', 'External Property Adapter', 'backend', 'Consume external property catalogue', 'HTTP client with Bearer authentication and disk-cache fallback consuming external property endpoints without relational DB coupling.', ['cURL', 'JSON Cache'], 36, 38, 'HTTPS / REST')
    ],
    keyDecisions: [
      { decision: 'Wrap bulk lead entry in single database transactions', rationale: 'All rows succeed or roll back together, preventing partial or corrupt lead imports.', tradeoff: 'Requires strict per-row pre-validation before committing.' },
      { decision: 'Cache external property catalogue to disk rather than relational DB sync', rationale: 'Isolates the core operational CRM database from external catalogue volatility and schema changes.', tradeoff: 'Catalogue updates rely on scheduled refresh and disk-cache reads.' }
    ],
    resilienceTesting: 'Repository evidence: PDO prepared statements for SQL injection prevention, CSRF validation on all mutations, brute-force lockout (5 attempts / 10 mins), file upload mime/size validation with random filenames, and PHPUnit test suite configuration.'
  },
  'remapp-scraper': {
    problem: 'Ingest large-scale real estate listings and detail records from the Remapp API without running into rate limits or memory exhaustion, and serve fresh structured property data to downstream CRM systems.',
    solution: 'A Python batch ingestion worker with retry backoff, incremental state tracking, and JSONL caching, paired with a Node.js/Express API server exposing authenticated endpoints for data retrieval and on-demand refresh triggers.',
    architectureNotes: 'Repository source: dist/fetch_public_projects.py performs direct HTTP requests to Remapp API endpoints with Bearer auth, exponential backoff (MAX_RETRIES=5), rate-limit recovery (429), and incremental JSONL caching; server.js provides API-key protected REST endpoints (/projects, /projects/:id, /refresh, /refresh/status) serving normalized JSON outputs.',
    subsystems: [
      subsystem('rmp-fetcher', 'Resilient API Fetcher', 'worker', 'Ingest project list and detail records', 'Python batch worker calling Remapp API endpoints with automated credential login, retry backoff, and 429 recovery.', ['Python', 'Requests'], -48, -25),
      subsystem('rmp-state', 'Incremental State Engine', 'database', 'Manage fetch progress and detail cache', 'Incremental state and JSONL detail caching preventing redundant network fetches and supporting resumable sync.', ['JSONL', 'File System'], 0, -36),
      subsystem('rmp-api', 'Protected Gateway API', 'backend', 'Serve cached data to downstream systems', 'Node.js/Express server exposing authenticated /projects, /projects/:id, /refresh, and /refresh/status endpoints.', ['Node.js', 'Express'], 48, 25, 'HTTPS / REST'),
      subsystem('rmp-norm', 'Data Normalization Layer', 'backend', 'Structure and format property metadata', 'Normalizes raw API payloads into consistent project schemas and price/handover structures.', ['JavaScript', 'Python'], -25, 38)
    ],
    keyDecisions: [
      { decision: 'Use direct API integration rather than browser scraping', rationale: 'Direct JSON endpoints provide structured data, faster execution, and lower resource overhead.', tradeoff: 'Requires active session token maintenance and auto-login handling.' },
      { decision: 'Maintain JSONL detail cache with incremental state', rationale: 'Enables resumable fetches and avoids re-querying unchanged project details across runs.', tradeoff: 'Requires local disk storage management and state synchronization.' }
    ],
    resilienceTesting: 'Repository evidence: retry backoff with exponential backoff on network/rate-limit failures, memory-conscious batching, API key validation, error logging to JSONL, and unit tests in test/ directory.'
  }
};

// Aliases mapping canonical original repositories to evidence records
const repositoryAliases: Record<string, string> = {
  'towerdesk-backend': 'towerdesk-backend-clean',
  'towerdesk-backend-clean': 'towerdesk-backend-clean',
  'tower-desk': 'tower-desk-clean',
  'tower-desk-clean': 'tower-desk-clean',
  'binghatti-concierge-app-rn-expo': 'towerdesk-mobile-showcase',
  'towerdesk-mobile-showcase': 'towerdesk-mobile-showcase',
  'worthy-crm': 'worthy-crm',
  'remapp-scraper': 'remapp-scraper'
};

export function getRepositoryEvidence(repositoryName: string): Evidence | null {
  const normalized = repositoryName.toLowerCase().trim();
  const canonicalKey = repositoryAliases[normalized] || normalized;
  return evidenceByRepository[canonicalKey] || null;
}

