import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProfessionalExperience } from '../src/services/experienceResolver';
import { OWNER_PROFILE } from '../src/data/ownerProfile.generated';
import { OWNER_EXPERIENCE_EVIDENCE, getOwnerExperienceEvidence } from '../src/data/ownerExperienceEvidence';
import { ExperienceNode, GeneratedOwnerProfile, OwnerExperienceEvidence } from '../src/types';
import { parseLinkedInProfileText, buildGeneratedOwnerProfile } from '../scripts/linkedinProfileParser';

test('1. Reconstructing importer output is compatible with experienceResolver', () => {
  // Take the canonical parsed structure and verify resolveProfessionalExperience processes it seamlessly
  const resolved = resolveProfessionalExperience({
    importedExperience: OWNER_PROFILE.experience,
    curatedEvidence: OWNER_EXPERIENCE_EVIDENCE
  });

  assert.ok(Array.isArray(resolved));
  assert.equal(resolved.length, 3, 'All 3 imported LinkedIn roles must survive');
});

test('2. LinkedIn re-import does not modify or delete ownerExperienceEvidence', () => {
  // Simulate re-importing an updated profile with new importedAt or modified descriptions
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

  // LinkedIn facts updated
  assert.equal(primaryNode.role, 'Full Stack Engineer');
  assert.equal(primaryNode.keyOutputs[0], 'Reimported output statement from LinkedIn PDF.');

  // Curated engineering evidence preserved
  assert.ok(primaryNode.architectedSystemsDetails && primaryNode.architectedSystemsDetails.length >= 2);
  assert.ok(primaryNode.systemsDelivered && primaryNode.systemsDelivered.length >= 3);
  assert.ok(primaryNode.engineeringContributions && primaryNode.engineeringContributions.length >= 4);
  assert.ok(primaryNode.infrastructureOperations && primaryNode.infrastructureOperations.length >= 3);
  assert.ok(primaryNode.evidenceLinks && primaryNode.evidenceLinks.length >= 3);

  // TowerDesk platform surfaces intact
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
      // No promotionNote!
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
      // No promotionNote!
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

test('9. Empty evidence collections do not produce corrupted objects or fallback placeholders', () => {
  const bareOrg: ExperienceNode[] = [
    {
      id: 'exp-bare',
      code: 'EXP-01',
      yearRange: '2023',
      role: 'Developer',
      organization: 'Bare Org',
      location: 'Remote',
      systemDomain: 'Web',
      keyOutputs: ['Built stuff'],
      systemsArchitected: [],
      technologies: ['HTML'],
      gridPosition: { x: 0, y: 0 }
    }
  ];

  const resolved = resolveProfessionalExperience({
    importedExperience: bareOrg,
    curatedEvidence: []
  });

  assert.equal(resolved.length, 1);
  const node = resolved[0];

  assert.deepEqual(node.systemsArchitected, []);
  assert.deepEqual(node.architectedSystemsDetails, []);
  assert.deepEqual(node.systemsDelivered, []);
  assert.deepEqual(node.engineeringContributions, []);
  assert.deepEqual(node.infrastructureOperations, []);
  assert.deepEqual(node.evidenceLinks, []);
});

test('10. CURATED evidence remains strictly labeled CURATED and is not silently upgraded to VERIFIED', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier');
  assert.ok(codefierEvidence);

  // Internal CRM must be CURATED
  const crm = codefierEvidence.systemsDelivered?.find(s => s.name.includes('CRM'));
  assert.ok(crm);
  assert.equal(crm.provenance, 'CURATED');

  // Remapp data ingestion service must be CURATED
  const remapp = codefierEvidence.systemsDelivered?.find(s => s.name.includes('Property Data Ingestion'));
  assert.ok(remapp);
  assert.equal(remapp.provenance, 'CURATED');

  // Verified open-source TowerDesk backend architecture remains VERIFIED
  const towerdeskArch = codefierEvidence.architectedSystems?.find(a => a.name.includes('TowerDesk'));
  assert.ok(towerdeskArch);
  assert.equal(towerdeskArch.provenance, 'VERIFIED');
});

test('11. Project IDs resolve safely to known repository keys', () => {
  const codefierEvidence = getOwnerExperienceEvidence('CodeFier')!;
  const towerdesk = codefierEvidence.systemsDelivered?.find(s => s.name.includes('TowerDesk'))!;

  assert.ok(towerdesk);
  assert.ok(towerdesk.surfaces && towerdesk.surfaces.length === 3);

  const backendSurface = towerdesk.surfaces.find(s => s.name.includes('Backend'))!;
  const webSurface = towerdesk.surfaces.find(s => s.name.includes('Admin'))!;
  const mobileSurface = towerdesk.surfaces.find(s => s.name.includes('Mobile'))!;

  assert.equal(backendSurface.linkedProjectId, 'towerdesk-backend-clean');
  assert.equal(webSurface.linkedProjectId, 'tower-desk-clean');
  assert.equal(mobileSurface.linkedProjectId, 'towerdesk-mobile-showcase');

  assert.equal(backendSurface.status, 'ORIGINAL BACKEND RETIRED');
  assert.equal(webSurface.status, 'FRONTEND SHOWCASE');
  assert.equal(mobileSurface.status, 'SHOWCASE REPOSITORY');

  const links = codefierEvidence.evidenceLinks!;
  assert.ok(links.some(l => l.projectId === 'towerdesk-backend-clean'));
  assert.ok(links.some(l => l.projectId === 'tower-desk-clean'));
  assert.ok(links.some(l => l.projectId === 'towerdesk-mobile-showcase'));
});

test('12. Freshly generated ownerProfile.generated.ts from actual importer compiles with the resolver', () => {
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
