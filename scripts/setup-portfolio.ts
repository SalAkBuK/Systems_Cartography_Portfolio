/**
 * SYSTEMS CARTOGRAPHY // OWNER SETUP WIZARD
 *
 * Unified localhost-only interactive setup wizard orchestrating:
 * - 00 Welcome & Existing Setup Detection
 * - 01 LinkedIn Profile PDF Import
 * - 02 GitHub Repository Synchronization
 * - 03 Flagship Systems Configuration (drag & drop)
 * - 04 Configuration Review
 * - 05 System Diagnostics & Verification
 * - 06 Initialization Complete
 *
 * Command: `npm run setup:portfolio`
 * Binds strictly to 127.0.0.1 (localhost). Never exposed on 0.0.0.0 or in production build.
 */

import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { parseLinkedInPdfBytes, writeGeneratedOwnerProfile, inferGitHubTarget } from './import-linkedin-profile';
import { generateGitHubSnapshot, syncGitHubSnapshotToFile } from './sync-github-snapshot';
import { getGitHubAuthStatus } from './githubAuthResolver';
import { runOwnerSetupChecks } from './check-owner-setup';
import { evaluateOwnerIdentityMatch } from '../src/utils/ownerIdentityMatch';
import { getGithubOwnerIdentity } from '../src/utils/ownerScope';
import { writeOwnerPreferences } from '../src/utils/ownerPreferencesStorage';
import { createOwnerSetupManifest, type OwnerSetupManifest } from '../src/config/ownerSetupManifest';
import { OWNER_SETUP_MANIFEST } from '../src/config/ownerSetup.generated';
import { resolveCurrentRepository } from './deployment-readiness';
import { writeOwnerSetupManifest } from './owner-setup-manifest-writer';
import { evaluateDeploymentReadiness, type RepositoryIdentityResolution } from '../src/utils/deploymentReadiness';
import { GITHUB_SNAPSHOT, GITHUB_SNAPSHOT_METADATA } from '../src/data/githubSnapshot.generated';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated';
import { OWNER_PORTFOLIO_PREFERENCES } from '../src/config/ownerPreferences';
import { PORTFOLIO_CONFIG } from '../src/config/portfolioConfig';
import type { GeneratedOwnerProfile, GitHubSnapshotMetadata } from '../src/types';
import type { GitHubSyncResult } from '../src/services/githubService';
import { sanitizeGitHubUser } from '../src/services/githubService';
import type { OwnerPortfolioPreferences } from '../src/config/ownerPreferences';

/**
 * A fork inherits the previous owner's generated files (ownerProfile,
 * githubSnapshot, preferences) physically on disk. When the current
 * repository identity does not match `OWNER_SETUP_MANIFEST`'s configured
 * repository, that inherited data must never become active runtime setup
 * state -- the wizard must start from a genuinely unconfigured baseline
 * instead. These builders produce that baseline without inventing fake
 * identity values.
 */
function createUnconfiguredOwnerProfile(): GeneratedOwnerProfile {
  return {
    source: { kind: 'linkedin_pdf', importedAt: '', reviewed: false, warnings: [] },
    githubTarget: '',
    operator: {
      name: '',
      role: '',
      location: '',
      focus: '',
      primaryStack: [],
      systemManifesto: '',
      contact: { email: '', linkedin: '' }
    },
    experience: [],
    skills: [],
    certifications: [],
    education: []
  };
}

function createUnconfiguredSnapshot(): GitHubSyncResult {
  return {
    sourceType: 'user',
    sourceIdentifier: '',
    user: sanitizeGitHubUser(null),
    projects: [],
    skills: [],
    operator: {
      name: '',
      handle: '',
      role: '',
      location: '',
      status: '',
      focus: '',
      yearsActive: 0,
      commitsIndexed: '',
      productionUptime: '',
      primaryStack: [],
      systemManifesto: '',
      contact: { email: '', github: '', linkedin: '', pgpKeyId: '', pgpFingerprint: '', matrix: '', availability: '' }
    },
    experience: []
  };
}

function createUnconfiguredSnapshotMetadata(): GitHubSnapshotMetadata {
  return {
    schemaVersion: 1,
    generatedAt: '',
    githubTarget: '',
    sourceIdentifier: '',
    rawRepositoryCount: 0,
    canonicalRepositoryCount: 0,
    inspectedRepositoryCount: 0,
    inspectionWarnings: []
  };
}

function createUnconfiguredPreferences(): OwnerPortfolioPreferences {
  return { flagshipProjectIds: [] };
}

export const WIZARD_PORT = 4174;
export const WIZARD_HOST = '127.0.0.1';
const PREFERENCES_PATH = path.resolve(process.cwd(), 'src/config/ownerPreferences.ts');
const HTML_FILE_PATH = path.resolve(process.cwd(), 'scripts/setup-portfolio.html');

export const WIZARD_SESSION_CSRF_TOKEN = crypto.randomBytes(24).toString('hex');

export interface WizardRuntimeState {
  ownerProfile: GeneratedOwnerProfile;
  snapshot: GitHubSyncResult;
  snapshotMetadata: GitHubSnapshotMetadata;
  preferences: OwnerPortfolioPreferences;
  detectedGitHub: string;
  confirmedGitHub: string;
  verificationPassed: boolean;
  crossOwnerConfirmed: boolean;
  profileSavedThisSession: boolean;
  githubSyncedThisSession: boolean;
  flagshipsSavedThisSession: boolean;
}

export interface SetupPortfolioServerOptions {
  initialStateOverrides?: Partial<WizardRuntimeState>;
  persistToDisk?: boolean;
  persistSetupManifest?: boolean;
  fetchImpl?: typeof fetch;
  repositoryIdentityResolver?: () => RepositoryIdentityResolution;
  setupManifestWriter?: (manifest: OwnerSetupManifest) => void;
}

export function validateLocalhostHost(hostHeader?: string): boolean {
  if (!hostHeader || typeof hostHeader !== 'string') return false;
  const hostname = hostHeader.split(':')[0].trim().toLowerCase();
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

export function validateLocalhostOrigin(originHeader?: string): boolean {
  if (!originHeader) return true;
  try {
    const url = new URL(originHeader);
    const hostname = url.hostname.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
}

export function readBoundedJsonBody<T>(req: http.IncomingMessage, maxBytes = 256 * 1024): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalSize = 0;

    req.on('data', chunk => {
      totalSize += chunk.length;
      if (totalSize > maxBytes) {
        req.destroy();
        const err = new Error('Payload Too Large') as Error & { statusCode?: number };
        err.statusCode = 413;
        reject(err);
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        resolve(parsed);
      } catch (err) {
        const parseErr = new Error('Invalid JSON format') as Error & { statusCode?: number };
        parseErr.statusCode = 400;
        reject(parseErr);
      }
    });

    req.on('error', err => reject(err));
  });
}

function getProjectTitleMap(snapshot: GitHubSyncResult): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of snapshot.projects || []) {
    map[p.id] = p.title;
  }
  return map;
}

function renderWizardHtml(): string {
  if (fs.existsSync(HTML_FILE_PATH)) {
    return fs.readFileSync(HTML_FILE_PATH, 'utf8');
  }
  return '<!DOCTYPE html><html><body><h1>Setup Portfolio</h1></body></html>';
}

export function createSetupPortfolioServer(options?: SetupPortfolioServerOptions): http.Server {
  const initialStateOverrides = options?.initialStateOverrides;
  const shouldPersistToDisk = options?.persistToDisk !== false;
  const shouldPersistSetupManifest = options?.persistSetupManifest ?? shouldPersistToDisk;
  const repositoryIdentityResolver = options?.repositoryIdentityResolver || resolveCurrentRepository;
  const setupManifestWriter = options?.setupManifestWriter || writeOwnerSetupManifest;

  // A fork's checked-in generated files (OWNER_PROFILE, GITHUB_SNAPSHOT,
  // OWNER_PORTFOLIO_PREFERENCES) belong to whichever owner last ran
  // `npm run setup:portfolio` -- not necessarily the current repository.
  // Only treat them as active runtime state when the current repository
  // identity actually matches the setup manifest's configured repository;
  // otherwise this session must start from an unconfigured baseline
  // (FRESH FORK REINITIALIZATION MODE).
  const initialRepositoryReadiness = evaluateDeploymentReadiness(
    OWNER_SETUP_MANIFEST,
    repositoryIdentityResolver()
  );
  const repositoryReinitializationRequired = !initialRepositoryReadiness.ready;

  const confirmedTarget = initialStateOverrides?.confirmedGitHub
    || initialStateOverrides?.ownerProfile?.githubTarget
    || (repositoryReinitializationRequired ? '' : OWNER_PROFILE.githubTarget)
    || '';

  const snapshotMetadata: GitHubSnapshotMetadata = initialStateOverrides?.snapshotMetadata || (
    repositoryReinitializationRequired
      ? createUnconfiguredSnapshotMetadata()
      : { ...GITHUB_SNAPSHOT_METADATA, githubTarget: confirmedTarget || GITHUB_SNAPSHOT_METADATA.githubTarget }
  );

  const runtimeState: WizardRuntimeState = {
    ownerProfile: initialStateOverrides?.ownerProfile
      || (repositoryReinitializationRequired ? createUnconfiguredOwnerProfile() : { ...OWNER_PROFILE }),
    snapshot: initialStateOverrides?.snapshot
      || (repositoryReinitializationRequired ? createUnconfiguredSnapshot() : { ...GITHUB_SNAPSHOT }),
    snapshotMetadata,
    preferences: initialStateOverrides?.preferences
      || (repositoryReinitializationRequired ? createUnconfiguredPreferences() : { ...OWNER_PORTFOLIO_PREFERENCES }),
    detectedGitHub: initialStateOverrides?.detectedGitHub || '',
    confirmedGitHub: confirmedTarget,
    verificationPassed: Boolean(initialStateOverrides?.verificationPassed),
    crossOwnerConfirmed: Boolean(initialStateOverrides?.crossOwnerConfirmed),
    profileSavedThisSession: Boolean(initialStateOverrides?.profileSavedThisSession),
    githubSyncedThisSession: Boolean(initialStateOverrides?.githubSyncedThisSession),
    flagshipsSavedThisSession: Boolean(initialStateOverrides?.flagshipsSavedThisSession)
  };

  const server = http.createServer(async (req, res) => {
    // 1. Strict Host Header Validation
    if (!validateLocalhostHost(req.headers.host)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Setup wizard binds strictly to localhost');
      return;
    }

    // 2. Strict Origin Header Validation (for mutating requests)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method || '')) {
      if (!validateLocalhostOrigin(req.headers.origin)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden: Foreign Origin rejected on mutation request');
        return;
      }
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    const sendJson = (statusCode: number, data: unknown) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const verifyCsrf = (): boolean => {
      const headerToken = req.headers['x-setup-csrf-token'];
      return headerToken === WIZARD_SESSION_CSRF_TOKEN;
    };

    // GET / -> Serve HTML
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderWizardHtml());
      return;
    }

    // GET /api/session -> Session handshake
    if (req.method === 'GET' && url.pathname === '/api/session') {
      if (!runtimeState.detectedGitHub) {
        runtimeState.detectedGitHub = await inferGitHubTarget();
      }
      const repositorySetup = evaluateDeploymentReadiness(
        OWNER_SETUP_MANIFEST,
        repositoryIdentityResolver()
      );
      const existingSetup = Boolean(
        runtimeState.ownerProfile.operator?.name
        && runtimeState.ownerProfile.githubTarget
        && repositorySetup.ready
      );
      const githubAuth = await getGitHubAuthStatus({ fetchImpl: options?.fetchImpl });
      // Merely detected (git-origin) targets participate in identity-match
      // evaluation as a best-effort guess, but must never be reported back to
      // the client under the `confirmedGitHub` key -- that key is a claim of
      // genuine confirmation, and the wizard UI uses its presence to decide
      // whether a GitHub identity may be stamped onto an imported profile.
      const matchEvaluationTarget = runtimeState.confirmedGitHub || runtimeState.ownerProfile.githubTarget || runtimeState.detectedGitHub;
      const identityMatch = evaluateOwnerIdentityMatch({
        ownerProfile: runtimeState.ownerProfile,
        githubTarget: matchEvaluationTarget
      });
      const confirmedGitHub = runtimeState.confirmedGitHub || runtimeState.ownerProfile.githubTarget || '';

      sendJson(200, {
        csrfToken: WIZARD_SESSION_CSRF_TOKEN,
        detectedGitHub: runtimeState.detectedGitHub,
        confirmedGitHub,
        existingSetup,
        operator: runtimeState.ownerProfile.operator,
        githubTarget: runtimeState.ownerProfile.githubTarget,
        projectsCount: runtimeState.snapshot.projects?.length || 0,
        skillsCount: runtimeState.snapshot.skills?.length || 0,
        flagshipsCount: runtimeState.preferences.flagshipProjectIds?.length || 0,
        githubAuth,
        crossOwnerConfirmed: runtimeState.crossOwnerConfirmed,
        repositorySetupRequired: !repositorySetup.ready,
        repositoryReinitializationRequired: !repositorySetup.ready,
        identityMatch
      });
      return;
    }

    // GET /api/github-auth-status & POST /api/recheck-github-auth -> Safe live auth status
    if (url.pathname === '/api/github-auth-status' || url.pathname === '/api/recheck-github-auth') {
      if (req.method === 'POST' && !verifyCsrf()) {
        sendJson(403, { success: false, error: 'Invalid or missing CSRF token' });
        return;
      }
      const githubAuth = await getGitHubAuthStatus({ fetchImpl: options?.fetchImpl });
      sendJson(200, {
        success: true,
        ...githubAuth
      });
      return;
    }

    // GET /api/state -> Live runtime state
    if (req.method === 'GET' && url.pathname === '/api/state') {
      if (!runtimeState.detectedGitHub) {
        runtimeState.detectedGitHub = await inferGitHubTarget();
      }
      const target = runtimeState.confirmedGitHub || runtimeState.ownerProfile.githubTarget || runtimeState.detectedGitHub;
      const identityMatch = evaluateOwnerIdentityMatch({
        ownerProfile: runtimeState.ownerProfile,
        githubTarget: target
      });
      const repositorySetup = evaluateDeploymentReadiness(
        OWNER_SETUP_MANIFEST,
        repositoryIdentityResolver()
      );

      sendJson(200, {
        ownerProfile: runtimeState.ownerProfile,
        snapshot: runtimeState.snapshot,
        preferences: runtimeState.preferences,
        detectedGitHub: runtimeState.detectedGitHub,
        confirmedGitHub: runtimeState.confirmedGitHub,
        crossOwnerConfirmed: runtimeState.crossOwnerConfirmed,
        repositoryReinitializationRequired: !repositorySetup.ready,
        identityMatch
      });
      return;
    }

    // POST /api/upload-pdf -> In-memory PDF parsing (NO temp files on disk)
    if (req.method === 'POST' && url.pathname === '/api/upload-pdf') {
      if (!verifyCsrf()) {
        sendJson(403, { success: false, error: 'Invalid or missing CSRF token' });
        return;
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      const MAX_PDF_SIZE = 15 * 1024 * 1024; // 15MB

      req.on('data', chunk => {
        totalSize += chunk.length;
        if (totalSize <= MAX_PDF_SIZE) {
          chunks.push(chunk);
        }
      });

      req.on('end', async () => {
        if (totalSize > MAX_PDF_SIZE) {
          sendJson(413, { success: false, error: 'PDF exceeds maximum size limit (15MB)' });
          return;
        }

        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          sendJson(400, { success: false, error: 'Empty PDF payload' });
          return;
        }

        const pdfSignature = Buffer.from('%PDF');
        const pdfStart = buffer.indexOf(pdfSignature);
        if (pdfStart === -1) {
          sendJson(400, { success: false, error: 'Invalid file: PDF magic header (%PDF) not found' });
          return;
        }

        let pdfBytes: Uint8Array;
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
          const endBoundaryIndex = buffer.lastIndexOf(Buffer.from('\r\n--'));
          const end = endBoundaryIndex > pdfStart ? endBoundaryIndex : buffer.length;
          pdfBytes = new Uint8Array(buffer.subarray(pdfStart, end));
        } else {
          pdfBytes = new Uint8Array(buffer.subarray(pdfStart));
        }

        try {
          const queryTarget = url.searchParams.get('githubTarget');
          if (queryTarget && queryTarget.trim()) {
            runtimeState.confirmedGitHub = queryTarget.trim().replace(/\/$/, '');
          }

          // A detected-but-unconfirmed suggestion (from git origin / repository
          // context) must never be silently promoted into a confirmed GitHub
          // association merely because the PDF importer needs *some* target.
          // Only genuinely confirmed state (an explicit query target above, or
          // a target already confirmed earlier this session) may be used here;
          // otherwise the profile is built with no GitHub association at all.
          const targetToUse = runtimeState.confirmedGitHub || '';
          const parsed = await parseLinkedInPdfBytes(pdfBytes, targetToUse);

          if (targetToUse && parsed.githubTarget) {
            runtimeState.confirmedGitHub = parsed.githubTarget;
          }

          sendJson(200, { success: true, profile: parsed });
        } catch (err) {
          sendJson(400, { success: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
      return;
    }

    // POST /api/save-profile -> Bounded JSON body & updates runtimeState.ownerProfile
    if (req.method === 'POST' && url.pathname === '/api/save-profile') {
      if (!verifyCsrf()) {
        sendJson(403, { success: false, error: 'Invalid or missing CSRF token' });
        return;
      }

      try {
        const parsed = await readBoundedJsonBody<{ profile?: GeneratedOwnerProfile }>(req);
        if (!parsed.profile || !parsed.profile.operator?.name) {
          sendJson(400, { success: false, error: 'Invalid profile data: operator name is required' });
          return;
        }

        if (shouldPersistToDisk) {
          await writeGeneratedOwnerProfile(parsed.profile);
        }

        runtimeState.ownerProfile = parsed.profile;
        runtimeState.crossOwnerConfirmed = false;
        runtimeState.verificationPassed = false;
        runtimeState.profileSavedThisSession = true;
        if (parsed.profile.githubTarget) {
          runtimeState.confirmedGitHub = parsed.profile.githubTarget;
        }

        sendJson(200, { success: true });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode || 400;
        sendJson(status, { success: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // POST /api/sync-github -> Bounded JSON body & updates runtimeState.snapshot
    if (req.method === 'POST' && url.pathname === '/api/sync-github') {
      if (!verifyCsrf()) {
        sendJson(403, { success: false, error: 'Invalid or missing CSRF token' });
        return;
      }

      try {
        const parsed = await readBoundedJsonBody<{ githubTarget?: string }>(req);
        const target = parsed.githubTarget?.trim();
        if (!target) {
          sendJson(400, { success: false, error: 'Missing githubTarget' });
          return;
        }

        let metadata: GitHubSnapshotMetadata;
        let snapshot: GitHubSyncResult;
        if (shouldPersistToDisk) {
          const res = await syncGitHubSnapshotToFile(target);
          metadata = res.metadata;
          snapshot = res.snapshot;
        } else {
          const res = await generateGitHubSnapshot(target, { fetchImpl: options?.fetchImpl });
          metadata = res.metadata;
          snapshot = res.snapshot;
        }

        runtimeState.snapshot = snapshot;
        runtimeState.snapshotMetadata = metadata;
        runtimeState.confirmedGitHub = target;
        runtimeState.crossOwnerConfirmed = false;
        runtimeState.verificationPassed = false;
        runtimeState.githubSyncedThisSession = true;

        // A successful, explicit GitHub sync IS a deliberate user action (per
        // the detected-vs-confirmed rule from PR #32) and may bind the
        // synced target onto the current owner profile -- but ONLY when that
        // profile is genuinely configured and does not already carry its own
        // GitHub association. This must never overwrite a pre-associated
        // profile target (an intentional cross-owner setup), and a merely
        // detected suggestion or a failed sync must never reach this code at
        // all.
        if (runtimeState.ownerProfile.operator?.name && !runtimeState.ownerProfile.githubTarget) {
          const boundProfile: GeneratedOwnerProfile = { ...runtimeState.ownerProfile, githubTarget: target };
          if (shouldPersistToDisk) {
            await writeGeneratedOwnerProfile(boundProfile);
          }
          runtimeState.ownerProfile = boundProfile;
        }

        const githubAuth = await getGitHubAuthStatus({ fetchImpl: options?.fetchImpl });

        sendJson(200, {
          success: true,
          projectCount: snapshot.projects?.length || 0,
          skillCount: snapshot.skills?.length || 0,
          githubAuth
        });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode || 400;
        sendJson(status, { success: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // POST /api/confirm-cross-owner -> Explicit owner confirmation of cross-owner mismatch
    if (req.method === 'POST' && url.pathname === '/api/confirm-cross-owner') {
      if (!verifyCsrf()) {
        sendJson(403, { success: false, error: 'Invalid or missing CSRF token' });
        return;
      }
      runtimeState.crossOwnerConfirmed = true;
      runtimeState.verificationPassed = false;
      sendJson(200, { success: true, crossOwnerConfirmed: true });
      return;
    }

    // POST /api/save-flagships -> Bounded JSON body & updates runtimeState.preferences
    if (req.method === 'POST' && url.pathname === '/api/save-flagships') {
      if (!verifyCsrf()) {
        sendJson(403, { success: false, error: 'Invalid or missing CSRF token' });
        return;
      }

      try {
        const parsed = await readBoundedJsonBody<{ flagshipProjectIds?: string[] }>(req);
        if (!Array.isArray(parsed.flagshipProjectIds)) {
          sendJson(400, { success: false, error: 'flagshipProjectIds must be an array' });
          return;
        }

        const availableIds = (runtimeState.snapshot.projects || []).map(p => p.id);
        const titleMap = getProjectTitleMap(runtimeState.snapshot);

        if (shouldPersistToDisk) {
          const result = writeOwnerPreferences(
            PREFERENCES_PATH,
            parsed.flagshipProjectIds,
            availableIds,
            titleMap
          );

          if (result.success) {
            runtimeState.preferences.flagshipProjectIds = result.savedIds;
            runtimeState.verificationPassed = false;
            runtimeState.flagshipsSavedThisSession = true;
            sendJson(200, { success: true, savedIds: result.savedIds });
          } else {
            sendJson(400, { success: false, error: result.error });
          }
        } else {
          runtimeState.preferences.flagshipProjectIds = parsed.flagshipProjectIds;
          runtimeState.verificationPassed = false;
          runtimeState.flagshipsSavedThisSession = true;
          sendJson(200, { success: true, savedIds: parsed.flagshipProjectIds });
        }
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode || 400;
        sendJson(status, { success: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // GET /api/verify -> Evaluates fresh runtimeState
    if (req.method === 'GET' && url.pathname === '/api/verify') {
      try {
        const summary = runOwnerSetupChecks({
          ownerProfile: runtimeState.ownerProfile,
          snapshot: runtimeState.snapshot,
          snapshotMetadata: runtimeState.snapshotMetadata,
          preferences: runtimeState.preferences,
          githubTarget: runtimeState.confirmedGitHub || runtimeState.ownerProfile.githubTarget,
          crossOwnerConfirmed: runtimeState.crossOwnerConfirmed
        });

        runtimeState.verificationPassed = summary.status !== 'FAIL' && summary.failCount === 0;
        sendJson(200, { success: runtimeState.verificationPassed, summary });
      } catch (err) {
        sendJson(500, { success: false, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // POST /api/complete -> Re-verify, then bind setup to this repository.
    if (req.method === 'POST' && url.pathname === '/api/complete') {
      if (!verifyCsrf()) {
        sendJson(403, { success: false, error: 'Invalid or missing CSRF token' });
        return;
      }

      if (!runtimeState.verificationPassed) {
        sendJson(409, { success: false, error: 'Run verification successfully before completing setup.' });
        return;
      }

      const summary = runOwnerSetupChecks({
        ownerProfile: runtimeState.ownerProfile,
        snapshot: runtimeState.snapshot,
        snapshotMetadata: runtimeState.snapshotMetadata,
        preferences: runtimeState.preferences,
        githubTarget: runtimeState.confirmedGitHub || runtimeState.ownerProfile.githubTarget,
        crossOwnerConfirmed: runtimeState.crossOwnerConfirmed
      });

      if (summary.status === 'FAIL' || summary.failCount > 0) {
        runtimeState.verificationPassed = false;
        sendJson(409, { success: false, error: 'Owner setup verification no longer passes.', summary });
        return;
      }

      const repositoryResolution = repositoryIdentityResolver();
      if (!repositoryResolution.identity) {
        sendJson(409, {
          success: false,
          error: 'Repository identity is unavailable. Use a supported Git-connected provider or a checkout retaining a valid GitHub origin remote.'
        });
        return;
      }

      const existingRepositorySetup = evaluateDeploymentReadiness(
        OWNER_SETUP_MANIFEST,
        repositoryResolution
      );
      if (!existingRepositorySetup.ready) {
        const requiredSteps = [
          runtimeState.profileSavedThisSession ? null : 'PROFILE',
          runtimeState.githubSyncedThisSession ? null : 'GITHUB',
          runtimeState.flagshipsSavedThisSession ? null : 'FLAGSHIPS'
        ].filter(Boolean);
        if (requiredSteps.length > 0) {
          sendJson(409, {
            success: false,
            error: `This fork must complete fresh setup steps before initialization: ${requiredSteps.join(', ')}.`
          });
          return;
        }
      }

      const githubTarget = runtimeState.confirmedGitHub || runtimeState.ownerProfile.githubTarget;
      const portfolioGithubOwner = getGithubOwnerIdentity(githubTarget);
      if (!portfolioGithubOwner) {
        runtimeState.verificationPassed = false;
        sendJson(409, { success: false, error: 'Configured portfolio GitHub owner is invalid.' });
        return;
      }

      const manifest = createOwnerSetupManifest(repositoryResolution.identity, portfolioGithubOwner);
      try {
        if (shouldPersistSetupManifest) setupManifestWriter(manifest);
      } catch (err) {
        sendJson(500, {
          success: false,
          error: `Could not write repository setup manifest: ${err instanceof Error ? err.message : String(err)}`
        });
        return;
      }

      sendJson(200, {
        success: true,
        repository: repositoryResolution.identity,
        repositoryIdentitySource: repositoryResolution.source,
        portfolioGithubOwner
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return server;
}

function start() {
  const server = createSetupPortfolioServer();
  server.listen(WIZARD_PORT, WIZARD_HOST, () => {
    console.log('='.repeat(64));
    console.log('SYSTEMS CARTOGRAPHY // OWNER SETUP WIZARD');
    console.log('='.repeat(64));
    console.log(`URL: http://${WIZARD_HOST}:${WIZARD_PORT}`);
    console.log('Bind: 127.0.0.1 (localhost only - not exposed to network)');
    console.log('Pipeline: PROFILE → GITHUB → FLAGSHIPS → REVIEW → VERIFY');
    console.log('='.repeat(64));
    console.log('Press Ctrl+C to stop the wizard server.');
  });
}

if (process.argv[1]?.endsWith('setup-portfolio.ts')) {
  start();
}
