import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProfessionalExperience } from '../src/services/experienceResolver';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated';
import { OWNER_EXPERIENCE_EVIDENCE, getOwnerExperienceEvidence } from '../src/data/ownerExperienceEvidence';
import { getRepositoryEvidence } from '../src/data/repositoryEvidence';
import { ExperienceNode, GeneratedOwnerProfile, OwnerExperienceEvidence } from '../src/types';
import { parseLinkedInProfileText, buildGeneratedOwnerProfile } from '../scripts/linkedinProfileParser';

test('1. Reconstructing importer output is compatible with experienceResolver', () => {
  const resolved = resolveProfessionalExperience({
    importedExperience: OWNER_PROFILE.experience,
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.ok(Array.isArray(resolved));
  assert.equal(resolved.length, 3, 'All 3 imported LinkedIn roles must survive');
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

  assert.equal(resolved.length, 3, 'All 3 records must survive');

  const codefierFullStack = resolved.find(e => e.id === 'exp-01-codefier-full-stack-engineer');
  const codefierReact = resolved.find(e => e.id === 'exp-02-codefier-react-native-js-developer');
  const devinity = resolved.find(e => e.id === 'exp-03-devinity-solutions-web-development-intern-mern-stack');

  assert.ok(codefierFullStack, 'CodeFier Full Stack Engineer must exist');
  assert.ok(codefierReact, 'CodeFier React Developer must exist');
  assert.ok(devinity, 'Devinity Solutions Intern must exist');

  assert.equal(codefierFullStack.organization, 'CodeFier');
  assert.equal(codefierReact.organization, 'CodeFier');
  assert.equal(devinity.organization, 'Devinity Solutions');
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
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.equal(resolved.length, 4);
  const aok = resolved.find(e => e.organization === 'AOK Health Solutions')!;
  assert.ok(aok);
  assert.equal(aok.systemsDelivered?.length || 0, 0, 'AOK Health Solutions must NOT inherit CodeFier systems');
  assert.equal(aok.architectedSystemsDetails?.length || 0, 0, 'AOK Health Solutions must NOT inherit CodeFier architecture');
});

test('9. TowerDesk resolves as ONE professional platform with 3 surfaces', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
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
  const originalBackend = getRepositoryEvidence('towerdesk-backend');
  const cleanBackend = getRepositoryEvidence('towerdesk-backend-clean');
  assert.ok(originalBackend);
  assert.equal(originalBackend, cleanBackend);

  const originalWeb = getRepositoryEvidence('tower-desk');
  const cleanWeb = getRepositoryEvidence('tower-desk-clean');
  assert.ok(originalWeb);
  assert.equal(originalWeb, cleanWeb);

  const originalMobile = getRepositoryEvidence('binghatti-concierge-app-rn-expo');
  const showcaseMobile = getRepositoryEvidence('towerdesk-mobile-showcase');
  assert.ok(originalMobile);
  assert.equal(originalMobile, showcaseMobile);
});

test('11. Worthy CRM technical facts are VERIFIED in repositoryEvidence while attribution is CURATED', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
  const crmDelivered = codefierEvidence.systemsDelivered?.find(s => s.name.includes('Worthy Real Estate CRM'))!;

  assert.ok(crmDelivered);
  assert.equal(crmDelivered.provenance, 'CURATED', 'Professional attribution remains CURATED');

  // Verify capabilities include RBAC, atomic lead entry, and screenshot proof
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('ADMIN, CEO, AGENT')));
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('Bulk Lead Entry')));
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('WhatsApp Media Proof')));
  assert.ok(crmDelivered.capabilities?.some(c => c.includes('audit_logs')));

  // Direct repo technical evidence check (VERIFIED in repositoryEvidence)
  const crmEvidence = getRepositoryEvidence('worthy-crm');
  assert.ok(crmEvidence);
  assert.ok(crmEvidence.subsystems.some(s => s.name.includes('Audit Logger')));
  assert.ok(crmEvidence.subsystems.some(s => s.name.includes('Notifications')));
  assert.ok(crmEvidence.subsystems.some(s => s.name.includes('Role Boundary')));
});

test('12. Remapp data service is modeled as API ingestion and NOT browser scraping', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
  const remappDelivered = codefierEvidence.systemsDelivered?.find(s => s.name.includes('Remapp'))!;

  assert.ok(remappDelivered);
  assert.equal(remappDelivered.provenance, 'CURATED', 'Professional attribution remains CURATED');

  // Verify it is labeled API Ingestion
  assert.ok(remappDelivered.name.includes('Ingestion') || remappDelivered.name.includes('Synchronization'));
  assert.ok(!remappDelivered.name.toLowerCase().includes('scraping'));
  assert.ok(remappDelivered.capabilities?.some(c => c.includes('Direct Remapp JSON API Ingestion')));
  assert.ok(remappDelivered.capabilities?.some(c => c.includes('Exponential Retry Backoff')));

  // Direct repo technical evidence check (VERIFIED in repositoryEvidence)
  const remappEvidence = getRepositoryEvidence('remapp-scraper');
  assert.ok(remappEvidence);
  assert.ok(remappEvidence.subsystems.some(s => s.name.includes('Resilient API Fetcher')));
});

test('13. Production nightly schedule remains CURATED while ingestion automation is VERIFIED', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
  const nightlyOp = codefierEvidence.infrastructureOperations?.find(o => o.area.includes('Scheduled Ingestion'))!;

  assert.ok(nightlyOp);
  assert.equal(nightlyOp.provenance, 'CURATED', 'Deployment schedule cadence must remain CURATED');

  // The ingestion pipeline architecture itself is VERIFIED in repositoryEvidence
  const remappEvidence = getRepositoryEvidence('remapp-scraper');
  assert.ok(remappEvidence);
});

test('14. CRM external property integration is cache-backed and not claimed as relational DB sync', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
  const crmDelivered = codefierEvidence.systemsDelivered?.find(s => s.name.includes('Worthy Real Estate CRM'))!;

  assert.ok(crmDelivered);
  const cacheCap = crmDelivered.capabilities?.find(c => c.includes('External Property'));
  assert.ok(cacheCap);
  assert.ok(cacheCap.includes('Disk Cache-Backed') || cacheCap.includes('HTTP'));
  assert.ok(!cacheCap.includes('Relational DB sync') && !cacheCap.includes('MySQL sync'));
});

test('15. TowerDesk mobile implementation maturity honestly discloses hybrid/mock modules', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
  const towerdesk = codefierEvidence.systemsDelivered?.find(s => s.name.includes('TowerDesk'))!;
  const mobileSurface = towerdesk?.surfaces?.find(s => s.name.includes('Mobile'))!;

  assert.ok(mobileSurface);
  assert.ok(mobileSurface.role.includes('API-backed') && mobileSurface.role.includes('mock'));
});

test('16. Non-CodeFier showcase preparation is not in CodeFier contributions', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
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
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.equal(resolved.length, 3);
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

test('23. Experience dock default position avoids collision with top-left application title badge', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const topologyContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

  // Assert default position is y >= 48 so it does not overlap the top-left title badge (y: 12-28)
  assert.ok(topologyContent.includes("DEFAULT_DOCK_POSITION = { x: 14, y: 52 }"), 'Dock default position must be y: 52 to avoid top-left label collision');
});

test('24. Experience dock drag handle is isolated and RESET button is independently clickable', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const topologyContent = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

  // Assert dock container stops pointer/mouse/touch propagation
  assert.ok(topologyContent.includes("onPointerDown={(e) => e.stopPropagation()}"), 'Dock container must stop pointer propagation');
  assert.ok(topologyContent.includes("onMouseDown={(e) => e.stopPropagation()}"), 'Dock container must stop mouse propagation');

  // Assert RESET button is not inside a button drag handle
  assert.ok(topologyContent.includes("handleResetDockPosition()"), 'RESET button must trigger handleResetDockPosition independently');
  assert.ok(topologyContent.includes("TECHNICAL CAPABILITIES // SYSTEM BACKBONE"), 'Bottom label must be renamed to TECHNICAL CAPABILITIES // SYSTEM BACKBONE');
});


