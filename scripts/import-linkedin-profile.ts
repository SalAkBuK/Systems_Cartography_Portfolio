import { execFile } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import { buildGeneratedOwnerProfile, parseLinkedInProfileText } from './linkedinProfileParser';

const execFileAsync = promisify(execFile);

type PositionedText = { str: string; x: number; y: number };

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positionalPdfArg(): string | undefined {
  return process.argv.slice(2).find((arg: string) => !arg.startsWith('--'));
}

function groupIntoLines(items: PositionedText[]): string[] {
  const rows: Array<{ y: number; items: PositionedText[] }> = [];
  const sorted = [...items].sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x));
  for (const item of sorted) {
    let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 2.2);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.str.trim()).filter(Boolean).join(' '))
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function extractPdfColumns(pdfPath: string): Promise<{ main: string[]; sidebar: string[] }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = new Uint8Array(await readFile(pdfPath));
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const main: string[] = [];
  const sidebar: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const positioned: PositionedText[] = [];
    for (const raw of content.items as unknown[]) {
      const item = raw as { str?: unknown; transform?: unknown };
      if (typeof item.str !== 'string' || !Array.isArray(item.transform) || item.transform.length < 6) continue;
      const x = Number(item.transform[4]);
      const y = Number(item.transform[5]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !item.str.trim()) continue;
      positioned.push({ str: item.str, x, y });
    }

    const splitX = viewport.width * 0.35;
    const pageSidebar = groupIntoLines(positioned.filter(item => item.x < splitX));
    const pageMain = groupIntoLines(positioned.filter(item => item.x >= splitX));
    main.push(...pageMain);
    sidebar.push(...pageSidebar);
  }

  if (!main.some(line => /^Experience$/i.test(line))) {
    throw new Error('LinkedIn Experience section was not detected in the PDF. The export layout may not be supported yet.');
  }
  return { main, sidebar };
}

function githubProfileFromRemote(remote: string): string {
  const normalized = remote.trim();
  const match = normalized.match(/github\.com(?::|\/)([^/]+)\/[^/]+(?:\.git)?$/i);
  return match ? `https://github.com/${match[1]}` : '';
}

async function inferGitHubTarget(): Promise<string> {
  const explicit = readArg('--github');
  if (explicit) return explicit.replace(/\/$/, '');
  try {
    const result = await execFileAsync('git', ['config', '--get', 'remote.origin.url']);
    return githubProfileFromRemote(result.stdout);
  } catch {
    return '';
  }
}

function renderGeneratedModule(profile: ReturnType<typeof buildGeneratedOwnerProfile>): string {
  return `import type { GeneratedOwnerProfile } from '../types';\n\n/**\n * GENERATED OWNER PROFILE.\n *\n * Created by \`npm run setup -- <linkedin-profile.pdf>\`.\n * The source PDF is intentionally not stored in the repository.\n * Review this generated data before committing it.\n */\nexport const OWNER_PROFILE: GeneratedOwnerProfile = ${JSON.stringify(profile, null, 2)};\n`;
}

function printReview(profile: ReturnType<typeof buildGeneratedOwnerProfile>): void {
  console.log('\n========================================');
  console.log(' OWNER PROFILE IMPORT // REVIEW');
  console.log('========================================');
  console.log(`${profile.operator.name} // ${profile.operator.role}`);
  console.log(profile.operator.location);
  console.log(`GitHub: ${profile.githubTarget || 'NOT DETECTED'}`);
  console.log(`LinkedIn: ${profile.operator.contact.linkedin || 'NOT DETECTED'}`);
  console.log(`Email: ${profile.operator.contact.email || 'NOT DETECTED'}`);
  console.log('\nEXPERIENCE');
  for (const entry of profile.experience) {
    const marker = entry.endDate === null ? 'CURRENT' : entry.promotionNote ? 'PROMOTION' : 'HISTORY';
    console.log(`  [${marker}] ${entry.organization} // ${entry.role} // ${entry.yearRange}`);
  }
  if (profile.source.warnings.length) {
    console.log('\nREVIEW WARNINGS');
    for (const warning of profile.source.warnings) console.log(`  ! ${warning}`);
  }
  console.log('\nThe PDF itself will NOT be copied into the repository.');
}

async function main(): Promise<void> {
  const pdfPath = readArg('--pdf') || positionalPdfArg() || 'imports/linkedin-profile.pdf';
  try {
    await access(pdfPath);
  } catch {
    throw new Error(`LinkedIn PDF not found: ${pdfPath}`);
  }

  const extracted = await extractPdfColumns(pdfPath);
  const parsed = parseLinkedInProfileText(extracted.main, extracted.sidebar);
  let githubTarget = await inferGitHubTarget();

  const rl = createInterface({ input, output });
  if (!githubTarget) {
    githubTarget = (await rl.question('GitHub profile URL (for repository sync): ')).trim().replace(/\/$/, '');
  }

  const profile = buildGeneratedOwnerProfile(parsed, githubTarget, new Date().toISOString());
  printReview(profile);

  if (!process.argv.includes('--yes')) {
    const answer = (await rl.question('\nWrite src/data/ownerProfile.generated.ts? [y/N] ')).trim().toLowerCase();
    if (answer !== 'y' && answer !== 'yes') {
      rl.close();
      console.log('Import cancelled; no source files were changed.');
      return;
    }
  }
  rl.close();

  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/ownerProfile.generated.ts', renderGeneratedModule(profile), 'utf8');
  console.log('\nGenerated src/data/ownerProfile.generated.ts');
  console.log('Next: npm test && npm run lint && npm run build');
}

main().catch(error => {
  console.error(`\nLinkedIn import failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
