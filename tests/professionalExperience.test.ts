import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProfessionalExperience } from '../src/services/experienceResolver';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated';
import { OWNER_EXPERIENCE_EVIDENCE, OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET, getOwnerExperienceEvidence } from '../src/data/ownerExperienceEvidence';
import { ADDITIONAL_OWNER_EXPERIENCE } from '../src/data/ownerAdditionalExperience';
import { getRepositoryEvidence, REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET } from '../src/data/repositoryEvidence';
import { ExperienceNode, GeneratedOwnerProfile, OwnerExperienceEvidence } from '../src/types';
import { parseLinkedInProfileText, buildGeneratedOwnerProfile } from '../scripts/linkedinProfileParser';

test('1. Reconstructing importer output is compatible with experienceResolver', () => {
  const resolved = resolveProfessionalExperience({
    importedExperience: OWNER_PROFILE.experience,
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.ok(Array.isArray(resolved));
  assert.equal(resolved.length, 4, 'All 3 imported LinkedIn roles and 1 additional curated freelance role must resolve');
});

test('2. LinkedIn re-import does not modify or delete ownerExperienceEvidence', () => {
  const reimportedProfile: GeneratedOwnerProfile = {
    source: {
      kind: 'linkedin_pdf',
      importedAt: '2026-08-28T00:00:00.000Z',
      reviewed: true,
      warnings: []
    },
    githubTarget: 'https://github.com/SalAkBuK',
    operator: {
      name: 'Salih Bukhari',
      role: 'Full Stack Engineer',
      location: 'Rawalpindi, Pakistan',
      focus: 'Updated focus statement',
      primaryStack: ['TypeScript', 'React'],
      systemManifesto: 'Updated manifesto',
      contact: {
        email: 'bukharian1776@gmail.com',
        linkedin: 'https://www.linkedin.com/in/salih-bukhari-33439b194/'
      }
    },
    experience: [
      {
        id: 'exp-01-reimported',
        code: 'EXP-01',
        yearRange: 'December 2025 - Present',
        role: 'Full Stack Engineer',
        organization: 'CodeFier',
        location: 'Islamabad, Pakistan',
        systemDomain: 'Full-Stack Systems',
        keyOutputs: ['Reimported output statement from LinkedIn PDF.'],
        systemsArchitected: [],
        technologies: ['TypeScript', 'Next.js'],
        gridPosition: { x: -140, y: -40 },
        provenance: 'CURATED',
        startDate: '2025-12',
        endDate: null,
        progressionGroup: 'codefier',
        progressionOrder: 2,
        promotionNote: 'PROMOTED FROM PREVIOUS ROLE'
      },
      {
        id: 'exp-02-reimported',
        code: 'EXP-02',
        yearRange: 'September 2025 - November 2025',
        role: 'React (Native & JS) Developer',
        organization: 'CodeFier',
        location: 'Islamabad, Pakistan',
        systemDomain: 'Mobile & Frontend Applications',
        keyOutputs: ['Reimported frontend output statement.'],
        systemsArchitected: [],
        technologies: ['React Native'],
        gridPosition: { x: 0, y: -40 },
        provenance: 'CURATED',
        startDate: '2025-09',
        endDate: '2025-11',
        progressionGroup: 'codefier',
        progressionOrder: 1
      }
    ],
    skills: ['TypeScript'],
    certifications: [],
    education: []
  };

  const resolved = resolveProfessionalExperience({
    importedExperience: reimportedProfile.experience,
    additionalExperience: [],
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.equal(resolved.length, 2);
  const primaryNode = resolved[0];

  assert.equal(primaryNode.role, 'Full Stack Engineer');
  assert.equal(primaryNode.keyOutputs[0], 'Reimported output statement from LinkedIn PDF.');

  assert.ok(primaryNode.architectedSystemsDetails && primaryNode.architectedSystemsDetails.length >= 1);
  assert.ok(primaryNode.systemsDelivered && primaryNode.systemsDelivered.length >= 3);
  assert.ok(primaryNode.engineeringContributions && primaryNode.engineeringContributions.length >= 3);
  assert.ok(primaryNode.infrastructureOperations && primaryNode.infrastructureOperations.length >= 3);
  assert.ok(primaryNode.evidenceLinks && primaryNode.evidenceLinks.length >= 5);

  const towerdesk = primaryNode.systemsDelivered.find(s => s.name.includes('TowerDesk'));
  assert.ok(towerdesk);
  assert.equal(towerdesk.surfaces?.length, 3, 'TowerDesk must have 3 surfaces (Backend, Admin/Web, Mobile)');
});

test('3. All three imported Salih employment records survive resolution', () => {
  const resolved = resolveProfessionalExperience();

  assert.equal(resolved.length, 4, 'All 4 records (3 imported + 1 freelance) must survive');

  const codefierFullStack = resolved.find(e => e.id === 'exp-01-codefier-full-stack-engineer');
  const codefierReact = resolved.find(e => e.id === 'exp-02-codefier-react-native-js-developer');
  const devinity = resolved.find(e => e.id === 'exp-03-devinity-solutions-web-development-intern-mern-stack');
  const freelance = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions');

  assert.ok(codefierFullStack, 'CodeFier Full Stack Engineer must exist');
  assert.ok(codefierReact, 'CodeFier React Developer must exist');
  assert.ok(devinity, 'Devinity Solutions Intern must exist');
  assert.ok(freelance, 'Freelance Web Developer must exist');

  assert.equal(codefierFullStack.organization, 'CodeFier');
  assert.equal(codefierReact.organization, 'CodeFier');
  assert.equal(devinity.organization, 'Devinity Solutions');
  assert.equal(freelance.organization, 'Independent / Freelance');
});

test('4. CodeFier roles group visually as progression on the primary role', () => {
  const resolved = resolveProfessionalExperience();
  const primaryCodefier = resolved.find(e => e.id === 'exp-01-codefier-full-stack-engineer')!;

  assert.ok(primaryCodefier.progressionRoles, 'Primary CodeFier node should have progressionRoles');
  assert.equal(primaryCodefier.progressionRoles.length, 2, 'Should group both CodeFier roles');

  assert.equal(primaryCodefier.progressionRoles[0].role, 'Full Stack Engineer');
  assert.equal(primaryCodefier.progressionRoles[1].role, 'React (Native & JS) Developer');
});

test('5. Explicit promotion metadata produces PROMOTED badge', () => {
  const resolved = resolveProfessionalExperience();
  const primaryCodefier = resolved.find(e => e.id === 'exp-01-codefier-full-stack-engineer')!;

  assert.equal(primaryCodefier.promotionNote, 'PROMOTED FROM PREVIOUS ROLE');
  assert.ok(primaryCodefier.progressionRoles);
  assert.equal(primaryCodefier.progressionRoles[0].promotionNote, 'PROMOTED FROM PREVIOUS ROLE');
  assert.equal(primaryCodefier.progressionRoles[1].promotionNote, undefined);
});

test('6. Multiple same-company roles WITHOUT promotion evidence do NOT produce PROMOTED', () => {
  const sameCompanyNoPromo: ExperienceNode[] = [
    {
      id: 'role-02-product-eng',
      code: 'EXP-01',
      yearRange: '2024 - Present',
      role: 'Product Engineer',
      organization: 'Acme Corp',
      location: 'Remote',
      systemDomain: 'Frontend',
      keyOutputs: ['Built UI'],
      systemsArchitected: [],
      technologies: ['React'],
      gridPosition: { x: 0, y: 0 },
      progressionGroup: 'acme',
      progressionOrder: 2
    },
    {
      id: 'role-01-developer',
      code: 'EXP-02',
      yearRange: '2023 - 2024',
      role: 'Developer',
      organization: 'Acme Corp',
      location: 'Remote',
      systemDomain: 'Frontend',
      keyOutputs: ['Fixed bugs'],
      systemsArchitected: [],
      technologies: ['JavaScript'],
      gridPosition: { x: 0, y: 0 },
      progressionGroup: 'acme',
      progressionOrder: 1
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: sameCompanyNoPromo,
    curatedEvidence: []
  });

  const primary = resolved[0];
  assert.equal(primary.promotionNote, undefined, 'Must NOT infer PROMOTED without explicit promotion evidence');
  assert.ok(primary.progressionRoles);
  assert.equal(primary.progressionRoles[0].promotionNote, undefined);
  assert.equal(primary.progressionRoles[1].promotionNote, undefined);
});

test('7. Curated evidence attaches strictly to CodeFier and NOT to Devinity Solutions', () => {
  const resolved = resolveProfessionalExperience();

  const codefier = resolved.find(e => e.organization === 'CodeFier')!;
  const devinity = resolved.find(e => e.organization === 'Devinity Solutions')!;

  assert.ok(codefier.architectedSystemsDetails && codefier.architectedSystemsDetails.length > 0);
  assert.ok(codefier.systemsDelivered && codefier.systemsDelivered.length > 0);
  assert.ok(codefier.engineeringContributions && codefier.engineeringContributions.length > 0);

  // Devinity has NO curated overlay evidence
  assert.equal(devinity.architectedSystemsDetails?.length || 0, 0, 'Devinity must not receive CodeFier architected systems');
  assert.equal(devinity.systemsDelivered?.length || 0, 0, 'Devinity must not receive CodeFier systems delivered');
  assert.equal(devinity.engineeringContributions?.length || 0, 0, 'Devinity must not receive CodeFier contributions');
  assert.equal(devinity.infrastructureOperations?.length || 0, 0, 'Devinity must not receive CodeFier infra/ops');
  assert.equal(devinity.evidenceLinks?.length || 0, 0, 'Devinity must not receive CodeFier evidence links');
});

test('8. Freelance work cannot accidentally inherit CodeFier evidence', () => {
  const profileWithFreelance: ExperienceNode[] = [
    ...OWNER_PROFILE.experience,
    {
      id: 'exp-04-freelance',
      code: 'EXP-04',
      yearRange: 'September 2025 - Present',
      role: 'Independent Technical Consultant',
      organization: 'AOK Health Solutions',
      location: 'Remote',
      systemDomain: 'Healthcare Systems',
      keyOutputs: ['Independent consulting and technical architecture.'],
      systemsArchitected: [],
      technologies: ['Next.js', 'TypeScript'],
      gridPosition: { x: 280, y: -40 },
      startDate: '2025-09',
      endDate: null
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: profileWithFreelance,
    additionalExperience: [],
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.equal(resolved.length, 4);
  const aok = resolved.find(e => e.organization === 'AOK Health Solutions')!;
  assert.ok(aok);
  assert.equal(aok.systemsDelivered?.length || 0, 0, 'AOK Health Solutions must NOT inherit CodeFier systems');
  assert.equal(aok.architectedSystemsDetails?.length || 0, 0, 'AOK Health Solutions must NOT inherit CodeFier architecture');
});

test('9. TowerDesk resolves as ONE professional platform with 3 surfaces', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier', OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET)!;
  const towerdesk = codefierEvidence.systemsDelivered?.find(s => s.name.includes('TowerDesk'))!;

  assert.ok(towerdesk, 'TowerDesk platform must exist');
  assert.ok(towerdesk.surfaces && towerdesk.surfaces.length === 3, 'TowerDesk platform must have exactly 3 surfaces');

  const backend = towerdesk.surfaces.find(s => s.name.includes('Backend'))!;
  const web = towerdesk.surfaces.find(s => s.name.includes('Web'))!;
  const mobile = towerdesk.surfaces.find(s => s.name.includes('Mobile'))!;

  assert.ok(backend && web && mobile, 'All 3 surfaces must be present');
  assert.equal(backend.provenance, 'CURATED');
  assert.equal(web.provenance, 'CURATED');
  assert.equal(mobile.provenance, 'CURATED');
});

test('10. Original and sanitized TowerDesk repository aliases resolve to identical evidence records', () => {
  const originalBackend = getRepositoryEvidence('towerdesk-backend', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  const cleanBackend = getRepositoryEvidence('towerdesk-backend-clean', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  assert.ok(originalBackend);
  assert.equal(originalBackend, cleanBackend);

  const originalWeb = getRepositoryEvidence('tower-desk', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  const cleanWeb = getRepositoryEvidence('tower-desk-clean', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  assert.ok(originalWeb);
  assert.equal(originalWeb, cleanWeb);

  const originalMobile = getRepositoryEvidence('binghatti-concierge-app-rn-expo', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  const showcaseMobile = getRepositoryEvidence('towerdesk-mobile-showcase', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  assert.ok(originalMobile);
  assert.equal(originalMobile, showcaseMobile);
});

test('11. Worthy CRM technical facts are VERIFIED in repositoryEvidence while attribution is CURATED', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier', OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET)!;
  const crmDelivered = codefierEvidence.systemsDelivered?.find(s => s.name.includes('Worthy Real Estate CRM'))!;

  assert.ok(crmDelivered);
  assert.equal(crmDelivered.provenance, 'CURATED', 'Professional attribution remains CURATED');

  // Verify capabilities include RBAC, atomic lead entry, and screenshot proof
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('ADMIN, CEO, AGENT')));
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('Bulk Lead Entry')));
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('WhatsApp Media Proof')));
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('audit_logs')));

  // Direct repo technical evidence check (VERIFIED in repositoryEvidence)
  const crmEvidence = getRepositoryEvidence('worthy-crm', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  assert.ok(crmEvidence);
  assert.ok(crmEvidence.subsystems.some(s => s.name.includes('Audit Logger')));
  assert.ok(crmEvidence.subsystems.some(s => s.name.includes('Notifications')));
  assert.ok(crmEvidence.subsystems.some(s => s.name.includes('Role Boundary')));
});

test('12. Remapp data service is modeled as API ingestion and NOT browser scraping', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier', OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET)!;
  const remappDelivered = codefierEvidence.systemsDelivered?.find(s => s.name.includes('Remapp'))!;

  assert.ok(remappDelivered);
  assert.equal(remappDelivered.provenance, 'CURATED', 'Professional attribution remains CURATED');

  // Verify it is labeled API Ingestion
  assert.ok(remappDelivered.name.includes('Ingestion') || remappDelivered.name.includes('Synchronization'));
  assert.ok(!remappDelivered.name.toLowerCase().includes('scraping'));
  assert.ok(remappDelivered.capabilities?.some(c => c.includes('Direct Remapp JSON API Ingestion')));
  assert.ok(remappDelivered.capabilities?.some(c => c.includes('Exponential Retry Backoff')));

  // Direct repo technical evidence check (VERIFIED in repositoryEvidence)
  const remappEvidence = getRepositoryEvidence('remapp-scraper', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  assert.ok(remappEvidence);
  assert.ok(remappEvidence.subsystems.some(s => s.name.includes('Resilient API Fetcher')));
});

test('13. Production nightly schedule remains CURATED while ingestion automation is VERIFIED', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier', OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET)!;
  const nightlyOp = codefierEvidence.infrastructureOperations?.find(o => o.area.includes('Scheduled Ingestion'))!;

  assert.ok(nightlyOp);
  assert.equal(nightlyOp.provenance, 'CURATED', 'Deployment schedule cadence must remain CURATED');

  // The ingestion pipeline architecture itself is VERIFIED in repositoryEvidence
  const remappEvidence = getRepositoryEvidence('remapp-scraper', REPOSITORY_EVIDENCE_OWNER_GITHUB_TARGET);
  assert.ok(remappEvidence);
});

test('14. CRM external property integration is cache-backed and not claimed as relational DB sync', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier', OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET)!;
  const crmDelivered = codefierEvidence.systemsDelivered?.find(s => s.name.includes('Worthy Real Estate CRM'))!;

  assert.ok(crmDelivered);
  const cacheCap = crmDelivered.capabilities?.find(c => c.includes('External Property'));
  assert.ok(cacheCap);
  assert.ok(cacheCap.includes('Disk Cache-Backed') || cacheCap.includes('HTTP'));
  assert.ok(!cacheCap.includes('Relational DB sync') && !cacheCap.includes('MySQL sync'));
});

test('15. TowerDesk mobile implementation maturity honestly discloses hybrid/mock modules', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier', OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET)!;
  const towerdesk = codefierEvidence.systemsDelivered?.find(s => s.name.includes('TowerDesk'))!;
  const mobileSurface = towerdesk?.surfaces?.find(s => s.name.includes('Mobile'))!;

  assert.ok(mobileSurface);
  assert.ok(mobileSurface.role.includes('API-backed') && mobileSurface.role.includes('mock'));
});

test('16. Non-CodeFier showcase preparation is not in CodeFier contributions', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier', OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET)!;
  const contributions = codefierEvidence.engineeringContributions || [];

  assert.ok(!contributions.some(c => c.title.toLowerCase().includes('sanitized showcase')), 'Sanitized showcase preparation must not be a CodeFier employment contribution');
});

test('17. Freshly generated ownerProfile.generated.ts from actual importer compiles with the resolver', () => {
  const mockMainText = [
    'Salih Bukhari',
    'Full Stack Engineer',
    'Rawalpindi, Punjab, Pakistan',
    'bukharian1776@gmail.com',
    'Experience',
    'CodeFier',
    'Full Stack Engineer',
    'December 2025 - Present (3 months)',
    'Islāmābād, Pakistan',
    'Promoted from React (Native & JS) Developer to Full Stack Engineer based on contributions across the product stack.',
    'React (Native & JS) Developer',
    'September 2025 - November 2025 (3 months)',
    'Islamabad, Pakistan',
    'Joined CodeFier as a React (Native & JS) Developer.',
    'Devinity Solutions',
    'Web Development Intern (MERN Stack)',
    'July 2024 - September 2024 (3 months)',
    'Islamabad, Pakistan',
    'Developed and maintained web applications using the MERN stack.'
  ];

  const parsed = parseLinkedInProfileText(mockMainText, ['Top Skills', 'TypeScript']);
  const generatedProfile = buildGeneratedOwnerProfile(parsed, 'https://github.com/SalAkBuK', '2026-08-27T00:00:00.000Z');

  const resolved = resolveProfessionalExperience({
    importedExperience: generatedProfile.experience,
    additionalExperience: [],
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.equal(resolved.length, 3, 'Raw LinkedIn import alone resolves to 3 roles');
  assert.equal(resolved[0].organization, 'CodeFier');
  assert.equal(resolved[0].role, 'Full Stack Engineer');
  assert.ok(resolved[0].systemsDelivered && resolved[0].systemsDelivered.length >= 3);
});

test('18. Zero ExperienceNode or experience physics exist in forceLayout or collision services', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const forceLayoutContent = fs.readFileSync(path.resolve('src/utils/forceLayout.ts'), 'utf8');
  const collisionContent = fs.readFileSync(path.resolve('src/utils/collision.ts'), 'utf8');

  assert.ok(!forceLayoutContent.includes('ExperienceNode'), 'forceLayout must NOT import or process ExperienceNode');
  assert.ok(!forceLayoutContent.includes('customExpPositions'), 'forceLayout must NOT track customExpPositions');
  assert.ok(!forceLayoutContent.includes('experienceForce'), 'forceLayout must NOT include experience physics forces');
  assert.ok(!collisionContent.includes('ExperienceNode'), 'collision service must NOT process ExperienceNode');
});

test('19. Viewport overlay dock clamping boundaries math clamps coordinates within safe margins', () => {
  const clampDock = (
    pos: { x: number; y: number },
    containerW: number,
    containerH: number,
    dockW: number,
    dockH: number
  ) => {
    const margin = 12;
    const maxX = Math.max(margin, containerW - dockW - margin);
    const maxY = Math.max(margin, containerH - dockH - margin);
    return {
      x: Math.min(Math.max(margin, Math.round(pos.x)), maxX),
      y: Math.min(Math.max(margin, Math.round(pos.y)), maxY)
    };
  };

  // 1. Normal position within bounds
  assert.deepEqual(clampDock({ x: 100, y: 150 }, 1000, 700, 300, 60), { x: 100, y: 150 });

  // 2. Negative coordinates clamped to safe margin (12)
  assert.deepEqual(clampDock({ x: -100, y: -50 }, 1000, 700, 300, 60), { x: 12, y: 12 });

  // 3. Overflowing coordinates clamped to container bounds (1000 - 300 - 12 = 688, 700 - 60 - 12 = 628)
  assert.deepEqual(clampDock({ x: 1500, y: 900 }, 1000, 700, 300, 60), { x: 688, y: 628 });

  // 4. Smaller mobile screen clamping
  assert.deepEqual(clampDock({ x: 300, y: 400 }, 360, 600, 300, 60), { x: 48, y: 400 });
});

test('20. System overview includes 4 verified architecture principles and process navigation is removed', async () => {
  const { VERIFIED_ARCHITECTURE_PRINCIPLES } = await import('../src/data/verifiedPortfolioData');
  assert.equal(VERIFIED_ARCHITECTURE_PRINCIPLES.length, 4, 'Must maintain 4 core evidence principles');
  assert.equal(VERIFIED_ARCHITECTURE_PRINCIPLES[0].number, '01');
  assert.equal(VERIFIED_ARCHITECTURE_PRINCIPLES[0].title, 'Repository Evidence Before Claims');
  assert.equal(VERIFIED_ARCHITECTURE_PRINCIPLES[3].number, '04');
  assert.equal(VERIFIED_ARCHITECTURE_PRINCIPLES[3].title, 'Show Unknowns Honestly');
});

test('21. System Overview and Operator Profile have distinct structural content and view semantics', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const panelContent = fs.readFileSync(path.resolve('src/components/RightInspectorPanel.tsx'), 'utf8');

  // Verify activeView is passed and inspected in RightInspectorPanel
  assert.ok(panelContent.includes("activeView === 'identity'"), 'RightInspectorPanel must branch on identity view');
  assert.ok(panelContent.includes("OPERATOR // PROFILE CONSOLE"), 'Title bar must show OPERATOR // PROFILE CONSOLE for identity view');
  assert.ok(panelContent.includes("SYSTEM // SYSTEM OVERVIEW"), 'Title bar must show SYSTEM // SYSTEM OVERVIEW for system overview');
  assert.ok(panelContent.includes("CAREER FOOTPRINT // SUMMARY"), 'Identity view must show concise career footprint snapshot');
  assert.ok(panelContent.includes("EVIDENCE CLASSIFICATION TAXONOMY"), 'System overview must show evidence taxonomy');
});

test('22. Technical Capabilities and Experience views support neutral tab switching and toggle-off', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  const normalizedApp = appContent.replace(/\r\n/g, '\n');

  // Verify skill toggle-off logic
  assert.ok(normalizedApp.includes("if (selectedSkillId === id) {\n      setSelectedSkillId(null);"), 'handleSelectSkill must toggle off when clicked again');

  // Verify experience toggle-off logic
  assert.ok(normalizedApp.includes("if (selectedExperienceId === id) {\n      setSelectedExperienceId(null);"), 'handleSelectExperience must toggle off when clicked again');

  // Verify no auto-selection on tab navigation
  assert.ok(!appContent.includes("setSelectedSkillId(skills[0].id)"), 'Must not auto-select first capability on navigation switch');
  assert.ok(!appContent.includes("setSelectedExperienceId(experience[0].id)"), 'Must not auto-select first employer on navigation switch');
});

test('23. Experience dock is removed from TopologyCanvas to prevent canvas clutter', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const topologyContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

  // Assert dock position states and localStorage keys are removed from TopologyCanvas
  assert.ok(!topologyContent.includes("DEFAULT_DOCK_POSITION"), 'Dock default position state must be removed');
  assert.ok(!topologyContent.includes("sys_cartography_experience_dock_position"), 'Dock localStorage key must be removed');
});

test('24. Experience dock markup is removed while TECHNICAL CAPABILITIES label remains', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const topologyContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

  // Assert dock container markup is removed from canvas
  assert.ok(!topologyContent.includes("PROFESSIONAL EXPERIENCE DOCK"), 'Experience dock markup must be removed from canvas');
  assert.ok(!topologyContent.includes("handleResetDockPosition"), 'Dock reset handler must be removed');
  assert.ok(topologyContent.includes("TECHNICAL CAPABILITIES // SYSTEM BACKBONE"), 'Bottom label TECHNICAL CAPABILITIES // SYSTEM BACKBONE must remain');
});

test('25. Synthetic capability connection fallback is removed and unmatched projects have empty infrastructureDeps', async () => {
  const { generateGitHubProfileDetails } = await import('../src/services/githubService');

  // Create projects with 6 high-frequency technologies occupying all 6 capability slots
  const mockProjects: any[] = [
    {
      id: 'proj-fe-1',
      title: 'Frontend Portal',
      techStack: ['TypeScript', 'React', 'Tailwind CSS'],
      infrastructureDeps: []
    },
    {
      id: 'proj-fe-2',
      title: 'Mobile App',
      techStack: ['TypeScript', 'React', 'Tailwind CSS'],
      infrastructureDeps: []
    },
    {
      id: 'proj-be-1',
      title: 'Core API Gateway',
      techStack: ['Node.js', 'PostgreSQL', 'Docker'],
      infrastructureDeps: []
    },
    {
      id: 'proj-be-2',
      title: 'Auth Service',
      techStack: ['Node.js', 'PostgreSQL', 'Docker'],
      infrastructureDeps: []
    },
    // Guaranteed unmatched rare project using technologies outside the top 6
    {
      id: 'proj-rare',
      title: 'Haskell Parsing Utility',
      techStack: ['Haskell', 'Cabal'],
      infrastructureDeps: []
    }
  ];  const result = generateGitHubProfileDetails(mockProjects as any, null, 'testuser');

  // 1. Verify 6 capabilities are generated from the high-frequency stack
  assert.equal(result.skills.length, 6, 'Must generate top 6 capability nodes');
  assert.ok(
    result.skills.every(s => !s.name.includes('Haskell') && !s.name.includes('Cabal')),
    'Haskell and Cabal must not be among top 6 generated capability nodes'
  );

  // 2. Unconditionally assert rare project has empty infrastructureDeps (no synthetic modulo assignment)
  const rareProj = mockProjects.find(p => p.id === 'proj-rare')!;
  assert.deepEqual(rareProj.infrastructureDeps, [], 'Unmatched project must have empty infrastructureDeps');

  // 3. Unconditionally assert none of the generated capability nodes list the rare project in usedInProjects
  assert.ok(
    result.skills.every(s => !s.usedInProjects.includes('proj-rare')),
    'No generated capability must list the unmatched project in usedInProjects'
  );
});

test('26. CAREER ORGANIZATIONS calculates unique organizations rather than role records count', async () => {
  const { PORTFOLIO_CONFIG } = await import('../src/config/portfolioConfig');
  const resolved = PORTFOLIO_CONFIG.experience || [];
  
  // Current owner has 4 employment records (CodeFier Full Stack, CodeFier React Dev, Devinity Solutions Intern, Independent / Freelance Web Developer)
  assert.equal(resolved.length, 4, 'Total employment records is 4');

  const uniqueOrgs = Array.from(
    new Set(resolved.map(e => (e.organization || '').trim().toLowerCase()))
  ).filter(Boolean);

  assert.equal(uniqueOrgs.length, 3, 'Unique career organizations must be 3 (CodeFier, Devinity Solutions, and Independent / Freelance)');
});

test('27. groupExperienceByProgression centralizes grouping with organization tenure and exact linked systems count', async () => {
  const { PORTFOLIO_CONFIG } = await import('../src/config/portfolioConfig');
  const { groupExperienceByProgression } = await import('../src/utils/portfolioUtils');
  const resolved = PORTFOLIO_CONFIG.experience || [];
  
  const grouped = groupExperienceByProgression(resolved);

  // Current owner verified experience must produce exactly 3 grouped cards
  assert.equal(grouped.length, 3, 'Must produce 3 grouped employer cards');
  
  // Card 1: CodeFier (Full Stack Engineer, PROMOTED, SEP 2025 → PRESENT, exactly 3 delivered systems)
  assert.equal(grouped[0].organization, 'CodeFier');
  assert.equal(grouped[0].role, 'Full Stack Engineer');
  assert.equal(grouped[0].isPromoted, true);
  assert.equal(grouped[0].roleCount, 2);
  assert.equal(grouped[0].organizationTenure, 'SEP 2025 → PRESENT');
  assert.equal(grouped[0].linkedSystemsCount, 3, 'CodeFier linked systems count must be 3 (delivered systems only, no double-counting)');

  // Card 2: Devinity Solutions (Web Development Intern, JUL 2024 → SEP 2024, 0 delivered systems)
  assert.equal(grouped[1].organization, 'Devinity Solutions');
  assert.equal(grouped[1].role, 'Web Development Intern (MERN Stack)');
  assert.equal(grouped[1].isPromoted, false);
  assert.equal(grouped[1].roleCount, 1);
  assert.equal(grouped[1].organizationTenure, 'JUL 2024 → SEP 2024');
  assert.equal(grouped[1].linkedSystemsCount, 0);

  // Card 3: Independent / Freelance (Freelance Web Developer, 2025, 1 delivered system)
  assert.equal(grouped[2].organization, 'Independent / Freelance');
  assert.equal(grouped[2].role, 'Freelance Web Developer');
  assert.equal(grouped[2].isPromoted, false);
  assert.equal(grouped[2].roleCount, 1);
  assert.equal(grouped[2].organizationTenure, '2025');
  assert.equal(grouped[2].linkedSystemsCount, 1, 'Independent / Freelance linked systems count must be 1 (AOK Health Solutions Website)');
});

test('28. RightInspectorPanel consumes groupExperienceByProgression helper while TopologyCanvas keeps clean canvas', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const topologyContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');
  const panelContent = fs.readFileSync(path.resolve('src/components/RightInspectorPanel.tsx'), 'utf8');

  // Verify RightInspectorPanel imports and uses groupExperienceByProgression
  assert.ok(panelContent.includes("groupExperienceByProgression"), 'RightInspectorPanel must import and use groupExperienceByProgression');
  assert.ok(!topologyContent.includes("groupedExperience"), 'TopologyCanvas must not retain dock grouping state');

  // Verify Experience Index UI elements
  assert.ok(panelContent.includes("PROFESSIONAL EXPERIENCE INDEX"), 'Panel must render PROFESSIONAL EXPERIENCE INDEX');
  assert.ok(panelContent.includes("org.organizationTenure"), 'Panel must render org.organizationTenure');
  assert.ok(panelContent.includes("SYSTEMS LINKED //"), 'Organization card must display linked systems count');
});

test('29. RightInspectorPanel capability index renders capability cards and routes through onSelectSkill', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const panelContent = fs.readFileSync(path.resolve('src/components/RightInspectorPanel.tsx'), 'utf8');

  // Verify capability index header and cards
  assert.ok(panelContent.includes("TECHNICAL CAPABILITIES INDEX"), 'Panel must render TECHNICAL CAPABILITIES INDEX');
  assert.ok(panelContent.includes("skills.map"), 'Panel must map over skills array');
  assert.ok(panelContent.includes("onSelectSkill(skill.id)"), 'Clicking a capability card must route through onSelectSkill');
  assert.ok(panelContent.includes("REPOSITORY ASSOCIATIONS //"), 'Capability card must display repository associations count');
});

test('30. onSelectExperience is required and back buttons clear selected ID without parallel state', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const panelContent = fs.readFileSync(path.resolve('src/components/RightInspectorPanel.tsx'), 'utf8');
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');

  // Verify onSelectExperience is declared as required in props
  assert.ok(panelContent.includes("onSelectExperience: (id: string) => void;"), 'onSelectExperience must be required in RightInspectorPanelProps');
  assert.ok(!panelContent.includes("onSelectExperience?: (id: string) => void;"), 'onSelectExperience must not be optional');

  // Verify back buttons exist in detail views and route without optional chaining
  assert.ok(panelContent.includes("← PROFESSIONAL EXPERIENCE"), 'Experience detail must provide back button to index');
  assert.ok(panelContent.includes("← TECHNICAL CAPABILITIES"), 'Capability detail must provide back button to index');
  assert.ok(panelContent.includes("onSelectExperience(selectedExperience.id)"), 'Experience back button must call onSelectExperience with selected ID');
  assert.ok(panelContent.includes("onSelectSkill(selectedSkill.id)"), 'Capability back button must call onSelectSkill with selected ID');

  // Verify App.tsx passes shared onSelectExperience to RightInspectorPanel
  assert.ok(appContent.includes("onSelectExperience={handleSelectExperience}"), 'App.tsx must pass onSelectExperience to RightInspectorPanel');
});

test('31. computeGroupedTenure does not treat undefined endDate as PRESENT and falls back to yearRange', async () => {
  const { computeGroupedTenure } = await import('../src/utils/portfolioUtils');

  // Case A: startDate exists, but endDate is undefined (not null)
  const mockNodeUndefinedEnd: any = {
    id: 'exp-test-1',
    startDate: '2023-01',
    endDate: undefined,
    yearRange: 'January 2023 - December 2024'
  };

  const tenureA = computeGroupedTenure([mockNodeUndefinedEnd], mockNodeUndefinedEnd.yearRange);
  assert.equal(tenureA, 'JANUARY 2023 → DECEMBER 2024', 'Undefined endDate must NOT produce PRESENT');

  // Case B: explicit current role with endDate: null
  const mockNodeCurrent: any = {
    id: 'exp-test-2',
    startDate: '2025-12',
    endDate: null,
    yearRange: 'December 2025 - Present'
  };

  const tenureB = computeGroupedTenure([mockNodeCurrent], mockNodeCurrent.yearRange);
  assert.equal(tenureB, 'DEC 2025 → PRESENT', 'Explicit endDate: null must produce PRESENT');
});

test('32. groupExperienceByProgression normalizes progressionGroup casing without splitting organizations', async () => {
  const { groupExperienceByProgression } = await import('../src/utils/portfolioUtils');

  const mockCasedProgression: any[] = [
    {
      id: 'exp-c1',
      organization: 'CodeFier',
      progressionGroup: 'CodeFier',
      role: 'Full Stack Engineer',
      progressionOrder: 2,
      yearRange: 'December 2025 - Present',
      startDate: '2025-12',
      endDate: null
    },
    {
      id: 'exp-c2',
      organization: 'CodeFier',
      progressionGroup: 'codefier',
      role: 'React Developer',
      progressionOrder: 1,
      yearRange: 'September 2025 - November 2025',
      startDate: '2025-09',
      endDate: '2025-11'
    }
  ];

  const grouped = groupExperienceByProgression(mockCasedProgression);
  assert.equal(grouped.length, 1, 'Different casing in progressionGroup (CodeFier vs codefier) must group into exactly one card');
  assert.equal(grouped[0].role, 'Full Stack Engineer');
  assert.equal(grouped[0].roleCount, 2);
  assert.equal(grouped[0].organizationTenure, 'SEP 2025 → PRESENT');
});

// ---------------------------------------------------------------------------
// PART 5: Persistent Freelance Experience & AOK Client Evidence Invariants
// ---------------------------------------------------------------------------

test('33. ownerProfile.generated.ts is NOT modified to contain AOK or freelance experience', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const generatedContent = fs.readFileSync(path.resolve('src/data/ownerProfile.generated.ts'), 'utf8');

  assert.ok(!generatedContent.includes('AOK'), 'ownerProfile.generated.ts must not contain AOK');
  assert.ok(!generatedContent.includes('Freelance'), 'ownerProfile.generated.ts must not contain Freelance');
  assert.ok(!generatedContent.includes('independent-freelance'), 'ownerProfile.generated.ts must not contain independent-freelance');
});

test('34. ADDITIONAL_OWNER_EXPERIENCE contains the persistent AOK freelance record', async () => {
  const { ADDITIONAL_OWNER_EXPERIENCE } = await import('../src/data/ownerAdditionalExperience');

  assert.ok(Array.isArray(ADDITIONAL_OWNER_EXPERIENCE), 'ADDITIONAL_OWNER_EXPERIENCE must be an array');
  assert.equal(ADDITIONAL_OWNER_EXPERIENCE.length, 1, 'Contains exactly 1 persistent freelance record');

  const aok = ADDITIONAL_OWNER_EXPERIENCE[0];
  assert.equal(aok.id, 'exp-freelance-aok-health-solutions');
  assert.equal(aok.code, 'EXP-FL-01');
  assert.equal(aok.organization, 'Independent / Freelance');
  assert.equal(aok.role, 'Freelance Web Developer');
  assert.equal(aok.yearRange, '2025');
  assert.equal(aok.location, 'Client Engagement');
  assert.equal(aok.systemDomain, 'Client Web Delivery');
  assert.equal(aok.provenance, 'CURATED');
  assert.equal(aok.progressionGroup, 'salakbuk-independent-freelance');
  assert.equal(aok.progressionOrder, 1);
  assert.equal(aok.startDate, undefined, 'startDate must be omitted without contract date evidence');
  assert.equal(aok.endDate, undefined, 'endDate must be undefined and NOT null (not current/present)');
  assert.ok(aok.keyOutputs && aok.keyOutputs.length >= 2);
  assert.ok(aok.keyOutputs.some(k => k.includes('AOK Health Solutions')));
  assert.ok(aok.keyOutputs.some(k => k.includes('Hostinger')));
});

test('35. resolveProfessionalExperience() includes AOK even though it is absent from imported LinkedIn experience', () => {
  const resolved = resolveProfessionalExperience();

  const aok = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions');
  assert.ok(aok, 'AOK freelance experience must be present in resolved experience');
  assert.equal(aok.organization, 'Independent / Freelance');
  assert.equal(aok.role, 'Freelance Web Developer');
});

test('36. Additional experience survives a simulated LinkedIn re-import', () => {
  const simulatedReimported: ExperienceNode[] = [
    {
      id: 'exp-simulated-01',
      code: 'EXP-SIM-01',
      organization: 'Future Company',
      role: 'Staff Engineer',
      yearRange: '2026 - Present',
      location: 'Remote',
      systemDomain: 'Core Systems',
      keyOutputs: ['Leading platform teams.'],
      systemsArchitected: [],
      technologies: ['TypeScript'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED',
      startDate: '2026-01',
      endDate: null
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: simulatedReimported,
    additionalExperience: ADDITIONAL_OWNER_EXPERIENCE
  });

  assert.equal(resolved.length, 2, 'Must contain 1 simulated imported role + 1 additional freelance role');
  assert.ok(resolved.some(e => e.id === 'exp-simulated-01'));
  assert.ok(resolved.some(e => e.id === 'exp-freelance-aok-health-solutions'));
});

test('37. Resolver returns additionalExperience even when importedExperience is empty (early-return bug fix)', () => {
  const resolved = resolveProfessionalExperience({
    importedExperience: [],
    additionalExperience: ADDITIONAL_OWNER_EXPERIENCE
  });

  assert.equal(resolved.length, 1, 'Empty importedExperience must still resolve additionalExperience');
  assert.equal(resolved[0].id, 'exp-freelance-aok-health-solutions');
});

test('38. mergeExperienceSources does not mutate input arrays', async () => {
  const { mergeExperienceSources } = await import('../src/services/experienceResolver');

  const imported: ExperienceNode[] = [
    {
      id: 'exp-imp-1',
      code: 'EXP-01',
      organization: 'Org A',
      role: 'Role A',
      yearRange: '2024',
      location: 'Loc A',
      systemDomain: 'Domain A',
      keyOutputs: ['Output A'],
      systemsArchitected: [],
      technologies: ['TypeScript'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const additional: ExperienceNode[] = [
    {
      id: 'exp-add-1',
      code: 'EXP-02',
      organization: 'Org B',
      role: 'Role B',
      yearRange: '2025',
      location: 'Loc B',
      systemDomain: 'Domain B',
      keyOutputs: ['Output B'],
      systemsArchitected: [],
      technologies: ['React'],
      gridPosition: { x: 100, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const importedCopy = JSON.parse(JSON.stringify(imported));
  const additionalCopy = JSON.parse(JSON.stringify(additional));

  const merged = mergeExperienceSources(imported, additional);
  assert.equal(merged.length, 2);
  assert.deepEqual(imported, importedCopy, 'imported array was not mutated');
  assert.deepEqual(additional, additionalCopy, 'additional array was not mutated');
});

test('39. mergeExperienceSources deduplicates identical experience and preserves imported base identity', async () => {
  const { mergeExperienceSources } = await import('../src/services/experienceResolver');

  const imported: ExperienceNode[] = [
    {
      id: 'exp-duplicate',
      code: 'EXP-01',
      organization: 'Independent / Freelance',
      role: 'Freelance Web Developer',
      yearRange: '2025',
      location: 'Islamabad, Pakistan',
      systemDomain: 'Web Development',
      keyOutputs: ['Imported LinkedIn version of freelance role.'],
      systemsArchitected: [],
      technologies: ['TypeScript'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const additional: ExperienceNode[] = [
    {
      id: 'exp-duplicate',
      code: 'EXP-FL-01',
      organization: 'Independent / Freelance',
      role: 'Freelance Web Developer',
      yearRange: '2025',
      location: 'Client Engagement',
      systemDomain: 'Client Web Delivery',
      keyOutputs: ['Additional curated version.'],
      systemsArchitected: [],
      technologies: ['Next.js'],
      gridPosition: { x: 100, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const merged = mergeExperienceSources(imported, additional);
  assert.equal(merged.length, 1, 'Duplicate record must not be emitted twice');
  assert.equal(merged[0].location, 'Islamabad, Pakistan', 'Imported LinkedIn base identity wins for duplicates');
  assert.equal(merged[0].keyOutputs[0], 'Imported LinkedIn version of freelance role.');
});

test('40. CodeFier resolves 2 roles and 3 delivered systems while Independent / Freelance resolves 1 role and 1 delivered system', () => {
  const resolved = resolveProfessionalExperience();

  const codefier = resolved.filter(e => e.organization === 'CodeFier');
  assert.equal(codefier.length, 2, 'CodeFier has 2 role records');
  assert.equal(codefier[0].systemsDelivered?.length, 3, 'CodeFier primary role has 3 delivered systems');

  const freelance = resolved.filter(e => e.organization === 'Independent / Freelance');
  assert.equal(freelance.length, 1, 'Independent / Freelance has 1 role record');
  assert.equal(freelance[0].systemsDelivered?.length, 1, 'Independent / Freelance has 1 delivered system');
  assert.equal(freelance[0].systemsDelivered?.[0].name, 'AOK Health Solutions Website');
});

test('41. AOK evidence links target exact repository subdirectory and live showcase site', () => {
  const resolved = resolveProfessionalExperience();
  const aok = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions')!;

  assert.ok(aok);
  assert.ok(aok.evidenceLinks && aok.evidenceLinks.length === 2, 'AOK must have exactly 2 evidence links');

  const repoLink = aok.evidenceLinks.find(l => l.type === 'repository');
  assert.ok(repoLink);
  assert.equal(repoLink.url, 'https://github.com/SalAkBuK/psych-websites/tree/main/website-3');
  assert.equal(repoLink.projectId, undefined, 'Must NOT contain projectId');

  const liveLink = aok.evidenceLinks.find(l => l.type === 'showcase');
  assert.ok(liveLink);
  assert.equal(liveLink.url, 'https://aokhealthsolutions.com/');
  assert.equal(liveLink.projectId, undefined, 'Must NOT contain projectId');
});

test('42. AOK has NO generic topology project linkage and getLinkedProjectIdsForExperience returns empty set', async () => {
  const { getLinkedProjectIdsForExperience, isProjectLinkedToExperience } = await import('../src/utils/portfolioUtils');
  const resolved = resolveProfessionalExperience();
  const aok = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions')!;

  assert.ok(aok);
  assert.equal(aok.systemsDelivered?.[0].linkedProjectIds, undefined, 'AOK systemsDelivered must not have linkedProjectIds');

  const linkedIds = getLinkedProjectIdsForExperience(aok);
  assert.equal(linkedIds.size, 0, 'AOK must not link to any topology project IDs');
  assert.equal(linkedIds.has('psych-websites'), false, 'AOK must NOT link to psych-websites topology project');

  const genericPsychWebsitesProject = {
    id: 'psych-websites',
    title: 'psych-websites'
  };
  assert.equal(
    isProjectLinkedToExperience(genericPsychWebsitesProject, aok),
    false,
    'psych-websites topology project must NOT be linked to AOK experience'
  );
});

test('43. Evidence isolation: CodeFier and AOK evidence do not leak into other organizations', () => {
  const resolved = resolveProfessionalExperience();

  const devinity = resolved.find(e => e.organization === 'Devinity Solutions')!;
  assert.equal(devinity.systemsDelivered?.length || 0, 0, 'Devinity must not inherit any delivered systems');
  assert.equal(devinity.architectedSystemsDetails?.length || 0, 0, 'Devinity must not inherit architected systems');

  const freelance = resolved.find(e => e.organization === 'Independent / Freelance')!;
  assert.equal(freelance.architectedSystemsDetails?.length || 0, 0, 'Freelance must not inherit CodeFier architecture');
  assert.ok(freelance.systemsDelivered?.every(s => !s.name.includes('TowerDesk')), 'Freelance must not have TowerDesk systems');

  const codefier = resolved.find(e => e.organization === 'CodeFier')!;
  assert.ok(codefier.systemsDelivered?.every(s => !s.name.includes('AOK')), 'CodeFier must not have AOK systems');
});

test('44. AOK date semantics: omitted startDate and undefined endDate do not synthesize CURRENT or PRESENT', async () => {
  const { computeGroupedTenure, formatIsoYearMonth } = await import('../src/utils/portfolioUtils');
  const resolved = resolveProfessionalExperience();
  const aok = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions')!;

  assert.ok(aok);
  assert.equal(aok.startDate, undefined, 'AOK startDate must be undefined');
  assert.equal(aok.endDate, undefined, 'AOK endDate must be undefined');
  assert.notEqual(aok.endDate, null, 'AOK endDate must NOT be null');

  const tenure = computeGroupedTenure([aok], aok.yearRange);
  assert.equal(tenure, '2025', 'Tenure must fall back to conservative 2025 yearRange without PRESENT');
  assert.ok(!tenure.includes('PRESENT'), 'Tenure must not include PRESENT');
  assert.ok(!tenure.includes('CURRENT'), 'Tenure must not include CURRENT');
});

test('45. AOK infrastructureOperations contains Hostinger as CURATED and no AWS current hosting claims exist', () => {
  const resolved = resolveProfessionalExperience();
  const aok = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions')!;

  assert.ok(aok);
  assert.ok(aok.infrastructureOperations && aok.infrastructureOperations.length >= 1);

  const hosting = aok.infrastructureOperations.find(op => op.area.includes('Hosting'))!;
  assert.ok(hosting, 'Client Hosting operation must exist');
  assert.ok(hosting.details.includes('Hostinger'), 'Must specify Hostinger');
  assert.equal(hosting.provenance, 'CURATED', 'Hostinger operations must have CURATED provenance');

  // Verify no AWS claims exist for AOK
  assert.ok(!hosting.details.includes('AWS'), 'No AWS claim in AOK hosting');
  assert.ok(!hosting.details.includes('Amplify'), 'No Amplify claim in AOK hosting');
  assert.ok(!hosting.details.includes('EC2'), 'No EC2 claim in AOK hosting');
  assert.ok(!hosting.details.includes('CloudFront'), 'No CloudFront claim in AOK hosting');
  assert.ok(!hosting.details.includes('Vercel'), 'No Vercel claim in AOK hosting');
});

test('46. Fork Safety: Different owner githubTarget does NOT append AOK freelance experience by default', () => {
  const forkOwnerExperience: ExperienceNode[] = [
    {
      id: 'exp-fork-01',
      code: 'EXP-01',
      organization: 'Fork Corp',
      role: 'Software Engineer',
      yearRange: '2024 - 2025',
      location: 'London, UK',
      systemDomain: 'Cloud Infrastructure',
      keyOutputs: ['Built cloud pipelines.'],
      systemsArchitected: [],
      technologies: ['Go', 'Kubernetes'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED',
      startDate: '2024-01',
      endDate: '2025-01'
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: forkOwnerExperience,
    ownerGithubTarget: 'https://github.com/AnotherDeveloper'
  });

  assert.equal(resolved.length, 1, 'Fork owner must retain exactly their own 1 experience record');
  assert.equal(resolved[0].id, 'exp-fork-01');
  assert.ok(!resolved.some(e => e.id === 'exp-freelance-aok-health-solutions'), 'AOK must NOT be resolved for different fork owner');
});

test('47. Fork Safety: Fork owner with their own "Independent / Freelance" role does NOT receive AOK evidence', () => {
  const forkOwnerFreelance: ExperienceNode[] = [
    {
      id: 'exp-fork-freelance',
      code: 'EXP-FL-01',
      organization: 'Independent / Freelance',
      role: 'Consultant',
      yearRange: '2024',
      location: 'Berlin, Germany',
      systemDomain: 'Web Delivery',
      keyOutputs: ['Client consulting.'],
      systemsArchitected: [],
      technologies: ['Vue.js'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED',
      progressionGroup: 'fork-freelance',
      progressionOrder: 1
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: forkOwnerFreelance,
    ownerGithubTarget: 'https://github.com/AnotherDeveloper'
  });

  assert.equal(resolved.length, 1);
  const forkRole = resolved[0];
  assert.equal(forkRole.organization, 'Independent / Freelance');
  assert.equal(forkRole.systemsDelivered?.length || 0, 0, 'Generic Independent / Freelance role in fork must NOT receive AOK systems');
  assert.equal(forkRole.architectedSystemsDetails?.length || 0, 0);
  assert.equal(forkRole.evidenceLinks?.length || 0, 0);
});

test('48. Owner target normalization: trailing slashes and casing match the curated owner target', () => {
  const resolvedTrailing = resolveProfessionalExperience({
    ownerGithubTarget: 'https://github.com/SalAkBuK/'
  });
  assert.ok(resolvedTrailing.some(e => e.id === 'exp-freelance-aok-health-solutions'), 'Trailing slash matches owner target');

  const resolvedCased = resolveProfessionalExperience({
    ownerGithubTarget: 'HTTPS://GITHUB.COM/SALAKBUK'
  });
  assert.ok(resolvedCased.some(e => e.id === 'exp-freelance-aok-health-solutions'), 'Uppercase matches owner target');
});

test('49. Explicit additionalExperience override is honored regardless of ownerGithubTarget', () => {
  const resolved = resolveProfessionalExperience({
    importedExperience: [],
    additionalExperience: ADDITIONAL_OWNER_EXPERIENCE,
    ownerGithubTarget: 'https://github.com/AnotherDeveloper'
  });

  assert.equal(resolved.length, 1, 'Explicit additionalExperience array must be honored');
  assert.equal(resolved[0].id, 'exp-freelance-aok-health-solutions');
});

test('50. mergeExperienceSources deduplicates when IDs differ but normalized organization + role + yearRange match', async () => {
  const { mergeExperienceSources } = await import('../src/services/experienceResolver');

  const imported: ExperienceNode[] = [
    {
      id: 'exp-imp-diff-id',
      code: 'EXP-01',
      organization: 'Independent / Freelance',
      role: 'Freelance Web Developer',
      yearRange: '2025',
      location: 'Karachi, Pakistan',
      systemDomain: 'Web Development',
      keyOutputs: ['Imported base identity with different ID.'],
      systemsArchitected: [],
      technologies: ['TypeScript'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const additional: ExperienceNode[] = [
    {
      id: 'exp-add-diff-id',
      code: 'EXP-FL-01',
      organization: 'independent / freelance',
      role: 'freelance web developer',
      yearRange: '2025',
      location: 'Client Engagement',
      systemDomain: 'Client Web Delivery',
      keyOutputs: ['Curated additional with different ID.'],
      systemsArchitected: [],
      technologies: ['Next.js'],
      gridPosition: { x: 100, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const merged = mergeExperienceSources(imported, additional);
  assert.equal(merged.length, 1, 'Records with different IDs but matching org+role+year must deduplicate');
  assert.equal(merged[0].id, 'exp-imp-diff-id', 'Imported ID wins');
  assert.equal(merged[0].location, 'Karachi, Pakistan', 'Imported location wins');
  assert.equal(merged[0].keyOutputs[0], 'Imported base identity with different ID.');
});

test('51. mergeExperienceSources retains multiple freelance engagements with different roles or year ranges', async () => {
  const { mergeExperienceSources } = await import('../src/services/experienceResolver');

  const imported: ExperienceNode[] = [
    {
      id: 'exp-fl-2024',
      code: 'EXP-01',
      organization: 'Independent / Freelance',
      role: 'WordPress Developer',
      yearRange: '2024',
      location: 'Client Engagement',
      systemDomain: 'Web Development',
      keyOutputs: ['Delivered CMS sites.'],
      systemsArchitected: [],
      technologies: ['PHP', 'WordPress'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const additional: ExperienceNode[] = [
    {
      id: 'exp-fl-2025',
      code: 'EXP-FL-01',
      organization: 'Independent / Freelance',
      role: 'Freelance Web Developer',
      yearRange: '2025',
      location: 'Client Engagement',
      systemDomain: 'Client Web Delivery',
      keyOutputs: ['Built AOK site.'],
      systemsArchitected: [],
      technologies: ['Next.js'],
      gridPosition: { x: 100, y: 0 },
      provenance: 'CURATED'
    }
  ];

  const merged = mergeExperienceSources(imported, additional);
  assert.equal(merged.length, 2, 'Distinct freelance engagements must both be retained');
  assert.equal(merged[0].id, 'exp-fl-2024');
  assert.equal(merged[1].id, 'exp-fl-2025');
});

test('52. AOK evidence structure: Parent DeliveredSystem is CURATED DELIVERED while child surfaces are VERIFIED IMPLEMENTED', () => {
  const resolved = resolveProfessionalExperience();
  const aok = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions')!;

  assert.ok(aok);
  const sys = aok.systemsDelivered?.[0];
  assert.ok(sys);
  assert.equal(sys.status, 'DELIVERED');
  assert.equal(sys.provenance, 'CURATED');

  assert.ok(sys.surfaces && sys.surfaces.length === 2);
  for (const surface of sys.surfaces) {
    assert.equal(surface.status, 'IMPLEMENTED', 'Child verified surface status must be IMPLEMENTED');
    assert.equal(surface.provenance, 'VERIFIED', 'Child surface must have VERIFIED provenance');
  }
});

test('53. AOK verified engineering contributions contain implementation wording without unverified delivery claims', () => {
  const resolved = resolveProfessionalExperience();
  const aok = resolved.find(e => e.id === 'exp-freelance-aok-health-solutions')!;

  assert.ok(aok);
  assert.ok(aok.engineeringContributions && aok.engineeringContributions.length >= 2);

  const contrib1 = aok.engineeringContributions.find(c => c.title.includes('Web Application'))!;
  assert.ok(contrib1);
  assert.equal(contrib1.title, 'Responsive Client Web Application Implementation', 'Title specifies Implementation');
  assert.ok(contrib1.description.startsWith('Implemented'), 'Description begins with source-verifiable implementation verb');
  assert.equal(contrib1.provenance, 'VERIFIED');
});

test('54. ownerAdditionalExperience.ts has clean UTF-8 encoding without BOM', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const buf = fs.readFileSync(path.resolve('src/data/ownerAdditionalExperience.ts'));

  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  assert.equal(hasBom, false, 'src/data/ownerAdditionalExperience.ts must NOT have a UTF-8 BOM');
});

test('55. getExperienceChronologyKey extracts conservative single-year keys for same-calendar-year ranges', async () => {
  const { getExperienceChronologyKey } = await import('../src/services/experienceResolver');

  const structuredSameYear: any = {
    startDate: '2025-10',
    endDate: '2025-11',
    yearRange: 'October 2025 - November 2025'
  };
  assert.equal(getExperienceChronologyKey(structuredSameYear), '2025');

  const stringSameYear: any = {
    yearRange: 'October 2025 - November 2025'
  };
  assert.equal(getExperienceChronologyKey(stringSameYear), '2025');

  const yearOnly: any = {
    yearRange: '2025'
  };
  assert.equal(getExperienceChronologyKey(yearOnly), '2025');
});

test('56. getExperienceChronologyKey keeps cross-year, present, and distinct calendar years separated', async () => {
  const { getExperienceChronologyKey } = await import('../src/services/experienceResolver');

  const crossYearStructured: any = {
    startDate: '2024-10',
    endDate: '2025-02',
    yearRange: 'October 2024 - February 2025'
  };
  assert.equal(getExperienceChronologyKey(crossYearStructured), '2024:2025');

  const crossYearString: any = {
    yearRange: '2024 - 2025'
  };
  assert.equal(getExperienceChronologyKey(crossYearString), '2024:2025');

  const presentStructured: any = {
    startDate: '2025-10',
    endDate: null,
    yearRange: 'October 2025 - Present'
  };
  assert.equal(getExperienceChronologyKey(presentStructured), '2025:PRESENT');

  const presentString: any = {
    yearRange: '2025 - Present'
  };
  assert.equal(getExperienceChronologyKey(presentString), '2025:PRESENT');

  const differentYear: any = {
    yearRange: '2024'
  };
  assert.equal(getExperienceChronologyKey(differentYear), '2024');
});

test('57. Realistic LinkedIn re-import: Month-dated imported AOK role deduplicates with persistent 2025 record and retains evidence routing', () => {
  const importedAokRole: ExperienceNode = {
    id: 'exp-04-independent-freelance-freelance-web-developer',
    code: 'EXP-04',
    organization: 'Independent / Freelance',
    role: 'Freelance Web Developer',
    yearRange: 'October 2025 - November 2025',
    location: 'Islamabad, Pakistan',
    systemDomain: 'Client Web Delivery',
    keyOutputs: ['Built client website with Next.js and Nodemailer.'],
    systemsArchitected: [],
    technologies: ['Next.js', 'React', 'TypeScript'],
    gridPosition: { x: 280, y: -40 },
    provenance: 'CURATED',
    startDate: '2025-10',
    endDate: '2025-11',
    progressionGroup: undefined,
    progressionOrder: undefined
  };

  const resolved = resolveProfessionalExperience({
    importedExperience: [importedAokRole],
    ownerGithubTarget: 'https://github.com/SalAkBuK'
  });

  assert.equal(resolved.length, 1, 'Only one AOK freelance record should be emitted');
  
  // Imported base identity wins
  const role = resolved[0];
  assert.equal(role.id, 'exp-04-independent-freelance-freelance-web-developer', 'Imported ID wins');
  assert.equal(role.yearRange, 'October 2025 - November 2025', 'Imported precise yearRange wins');
  assert.equal(role.startDate, '2025-10', 'Imported startDate wins');
  assert.equal(role.endDate, '2025-11', 'Imported endDate wins');
  assert.equal(role.location, 'Islamabad, Pakistan', 'Imported location wins');
  assert.equal(role.keyOutputs[0], 'Built client website with Next.js and Nodemailer.', 'Imported keyOutputs win');

  // Persistent routing metadata survives
  assert.equal(role.progressionGroup, 'salakbuk-independent-freelance', 'Persistent progressionGroup survives to route evidence');
  assert.equal(role.progressionOrder, 1, 'Persistent progressionOrder survives');

  // Evidence attaches correctly via persistent progressionGroup
  assert.ok(role.systemsDelivered && role.systemsDelivered.length === 1, 'Delivered systems must attach to imported AOK record');
  assert.equal(role.systemsDelivered[0].name, 'AOK Health Solutions Website');
  assert.ok(role.evidenceLinks && role.evidenceLinks.some(l => l.url.includes('website-3')));
});

test('58. Cross-year imported role does NOT deduplicate with persistent single-year 2025 record', async () => {
  const { mergeExperienceSources } = await import('../src/services/experienceResolver');
  const { ADDITIONAL_OWNER_EXPERIENCE } = await import('../src/data/ownerAdditionalExperience');

  const crossYearImport: ExperienceNode = {
    id: 'exp-imp-cross-year',
    code: 'EXP-01',
    organization: 'Independent / Freelance',
    role: 'Freelance Web Developer',
    yearRange: 'October 2024 - February 2025',
    location: 'Client Engagement',
    systemDomain: 'Client Web Delivery',
    keyOutputs: ['Cross-year engagement.'],
    systemsArchitected: [],
    technologies: ['React'],
    gridPosition: { x: 0, y: 0 },
    provenance: 'CURATED',
    startDate: '2024-10',
    endDate: '2025-02'
  };

  const merged = mergeExperienceSources([crossYearImport], ADDITIONAL_OWNER_EXPERIENCE);
  assert.equal(merged.length, 2, 'Cross-year role and single-year 2025 role must both survive without collision');
  assert.ok(merged.some(e => e.id === 'exp-imp-cross-year'));
  assert.ok(merged.some(e => e.id === 'exp-freelance-aok-health-solutions'));
});

test('59. Current imported role (endDate: null) does NOT deduplicate with historical 2025 record', async () => {
  const { mergeExperienceSources } = await import('../src/services/experienceResolver');
  const { ADDITIONAL_OWNER_EXPERIENCE } = await import('../src/data/ownerAdditionalExperience');

  const currentImport: ExperienceNode = {
    id: 'exp-imp-current',
    code: 'EXP-01',
    organization: 'Independent / Freelance',
    role: 'Freelance Web Developer',
    yearRange: 'October 2025 - Present',
    location: 'Client Engagement',
    systemDomain: 'Client Web Delivery',
    keyOutputs: ['Ongoing freelance engagement.'],
    systemsArchitected: [],
    technologies: ['React'],
    gridPosition: { x: 0, y: 0 },
    provenance: 'CURATED',
    startDate: '2025-10',
    endDate: null
  };

  const merged = mergeExperienceSources([currentImport], ADDITIONAL_OWNER_EXPERIENCE);
  assert.equal(merged.length, 2, 'Ongoing role (PRESENT) and historical 2025 role must both survive without collision');
});

test('60. Different historical year does NOT deduplicate with 2025 record', async () => {
  const { mergeExperienceSources } = await import('../src/services/experienceResolver');
  const { ADDITIONAL_OWNER_EXPERIENCE } = await import('../src/data/ownerAdditionalExperience');

  const year2024Import: ExperienceNode = {
    id: 'exp-imp-2024',
    code: 'EXP-01',
    organization: 'Independent / Freelance',
    role: 'Freelance Web Developer',
    yearRange: '2024',
    location: 'Client Engagement',
    systemDomain: 'Client Web Delivery',
    keyOutputs: ['2024 engagement.'],
    systemsArchitected: [],
    technologies: ['React'],
    gridPosition: { x: 0, y: 0 },
    provenance: 'CURATED',
    startDate: '2024-01',
    endDate: '2024-12'
  };

  const merged = mergeExperienceSources([year2024Import], ADDITIONAL_OWNER_EXPERIENCE);
  assert.equal(merged.length, 2, '2024 role and 2025 role must both survive without collision');
});

// ---------------------------------------------------------------------------
// PR28: Owner-Scoped Professional Evidence (Foreign-Owner Collision Protection)
// ---------------------------------------------------------------------------

test('PR28 CRITICAL: Synthetic owner with employment organization also named "CodeFier" does NOT receive SalAkBuK CodeFier engineering evidence', () => {
  const syntheticCodeFierExperience: ExperienceNode[] = [
    {
      id: 'exp-synthetic-codefier',
      code: 'EXP-01',
      yearRange: '2023 - Present',
      role: 'Backend Engineer',
      organization: 'CodeFier',
      location: 'Berlin, Germany',
      systemDomain: 'Payments Systems',
      keyOutputs: ['Built an unrelated payments backend at a different company that also happens to be named CodeFier.'],
      systemsArchitected: [],
      technologies: ['Go', 'Kubernetes'],
      gridPosition: { x: 0, y: 0 },
      provenance: 'CURATED',
      startDate: '2023-01',
      endDate: null
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: syntheticCodeFierExperience,
    ownerGithubTarget: 'https://github.com/example-owner'
  });

  assert.equal(resolved.length, 1);
  const foreignCodefier = resolved[0];
  assert.equal(foreignCodefier.organization, 'CodeFier');

  // Owner identity boundary wins even when organization names collide.
  assert.equal(foreignCodefier.systemsDelivered?.length || 0, 0, 'Foreign CodeFier must NOT receive SalAkBuK systemsDelivered (TowerDesk/Worthy/Remapp)');
  assert.equal(foreignCodefier.architectedSystemsDetails?.length || 0, 0, 'Foreign CodeFier must NOT receive SalAkBuK architectedSystems (TowerDesk)');
  assert.equal(foreignCodefier.engineeringContributions?.length || 0, 0, 'Foreign CodeFier must NOT receive SalAkBuK engineeringContributions');
  assert.equal(foreignCodefier.infrastructureOperations?.length || 0, 0, 'Foreign CodeFier must NOT receive SalAkBuK infrastructureOperations');
  assert.equal(foreignCodefier.evidenceLinks?.length || 0, 0, 'Foreign CodeFier must NOT receive SalAkBuK evidenceLinks');
  assert.ok(
    (foreignCodefier.systemsArchitected || []).every(name => !name.includes('TowerDesk')),
    'Foreign CodeFier must not list TowerDesk as a systemsArchitected name'
  );
});

test('PR28: getOwnerExperienceEvidenceCollection returns [] for a foreign githubTarget and the full bundle for the matching owner (no current-owner default)', async () => {
  const { getOwnerExperienceEvidenceCollection, OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET } = await import('../src/data/ownerExperienceEvidence');

  const foreignCollection = getOwnerExperienceEvidenceCollection('https://github.com/example-owner');
  assert.deepEqual(foreignCollection, [], 'Foreign owner target must receive an empty evidence collection');

  const ownCollection = getOwnerExperienceEvidenceCollection(OWNER_EXPERIENCE_EVIDENCE_GITHUB_TARGET);
  assert.ok(ownCollection.length > 0, 'Matching owner target must receive the full curated evidence bundle');

  // Unknown/empty owner must also fail closed -- there is no current-owner
  // default to silently fall back to.
  const unknownOwnerCollection = getOwnerExperienceEvidenceCollection('');
  assert.deepEqual(unknownOwnerCollection, [], 'Empty/unknown githubTarget must fail closed, never substitute this owner\'s own target');
});

test('PR28: getOwnerExperienceEvidence("CodeFier", foreignTarget) returns null while the matching owner target still resolves it', async () => {
  const { getOwnerExperienceEvidence: scopedGetOwnerExperienceEvidence } = await import('../src/data/ownerExperienceEvidence');

  const foreignLookup = scopedGetOwnerExperienceEvidence('CodeFier', 'https://github.com/example-owner');
  assert.equal(foreignLookup, null, 'Foreign owner target must not resolve CodeFier evidence by organization name');

  const ownLookup = scopedGetOwnerExperienceEvidence('CodeFier', 'https://github.com/SalAkBuK');
  assert.ok(ownLookup, 'Matching owner target must still resolve CodeFier evidence');
});

test('PR28: Foreign owner still produces a valid resolved experience model (imported history survives without any curated overlay)', () => {
  const foreignHistory: ExperienceNode[] = [
    {
      id: 'exp-foreign-01',
      code: 'EXP-01',
      yearRange: '2022 - 2024',
      role: 'Platform Engineer',
      organization: 'Example Foreign Co',
      location: 'Sydney, Australia',
      systemDomain: 'Cloud Platform',
      keyOutputs: ['Operated Kubernetes clusters and CI/CD pipelines.'],
      systemsArchitected: [],
      technologies: ['Kubernetes', 'Terraform'],
      gridPosition: { x: 0, y: 0 },
      startDate: '2022-01',
      endDate: '2024-01'
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: foreignHistory,
    ownerGithubTarget: 'https://github.com/example-owner'
  });

  assert.equal(resolved.length, 1, 'Foreign owner imported history must survive resolution');
  assert.equal(resolved[0].organization, 'Example Foreign Co');
  assert.equal(resolved[0].systemsDelivered?.length || 0, 0);
});

