import type { ExperienceNode, GeneratedOwnerProfile } from '../src/types';

export interface ParsedExperience {
  organization: string;
  role: string;
  startDate: string;
  endDate: string | null;
  yearRange: string;
  location: string;
  bullets: string[];
}

export interface ParsedLinkedInProfile {
  name: string;
  headline: string;
  location: string;
  summary: string;
  email: string;
  linkedin: string;
  topSkills: string[];
  certifications: string[];
  education: string[];
  experience: ParsedExperience[];
  warnings: string[];
}

export const NO_EXPERIENCE_WARNING =
  'No Experience section was found in this LinkedIn profile. You can continue setup and add professional experience later.';
export const MAX_LINKEDIN_INPUT_LINES = 20_000;
export const MAX_LINKEDIN_INPUT_CHARACTERS = 2_000_000;
export const MAX_LINKEDIN_PROFILE_ENTRIES = 200;
export const MAX_LINKEDIN_SUMMARY_LENGTH = 10_000;

const MONTH_NAMES: Array<{ name: string; index: number; patterns: string[] }> = [
  { name: 'January', index: 1, patterns: ['january', 'jan'] },
  { name: 'February', index: 2, patterns: ['february', 'feb'] },
  { name: 'March', index: 3, patterns: ['march', 'mar'] },
  { name: 'April', index: 4, patterns: ['april', 'apr'] },
  { name: 'May', index: 5, patterns: ['may'] },
  { name: 'June', index: 6, patterns: ['june', 'jun'] },
  { name: 'July', index: 7, patterns: ['july', 'jul'] },
  { name: 'August', index: 8, patterns: ['august', 'aug'] },
  { name: 'September', index: 9, patterns: ['september', 'sep', 'sept'] },
  { name: 'October', index: 10, patterns: ['october', 'oct'] },
  { name: 'November', index: 11, patterns: ['november', 'nov'] },
  { name: 'December', index: 12, patterns: ['december', 'dec'] }
];

function parseMonthIndex(token: string): number | null {
  const clean = token.trim().toLowerCase();
  for (const m of MONTH_NAMES) {
    if (m.patterns.includes(clean)) return m.index;
  }
  return null;
}

const MONTH_PART = '(?:January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec)';
const RANGE_SEP = '(?:\\s*[-–—]\\s*|\\s+to\\s+)';
const PRESENT_PART = '(?:Present|Current|Now)';

const FULL_DATE_RANGE_RE = new RegExp(
  `^(${MONTH_PART})\\s+(\\d{4})` +
  RANGE_SEP +
  `(${PRESENT_PART}|(?:(${MONTH_PART})\\s+(\\d{4})))` +
  `(?:[\\s·(].*)?$`,
  'i'
);

const YEAR_ONLY_RANGE_RE = new RegExp(
  `^(\\d{4})` +
  RANGE_SEP +
  `(${PRESENT_PART}|(\\d{4}))` +
  `(?:[\\s·(].*)?$`,
  'i'
);

const DURATION_RE = /^(?:[·•\s]*)?\d+\s+(?:yr|yrs|year|years|mo|mos|month|months)(?:\s+(?:\d+\s+)?(?:mo|mos|month|months))?$/i;
const FOOTER_RE = /^Page\s+\d+\s+of\s+\d+$/i;
const BULLET_RE = /^[•·▪◦*-]\s*/;

const KNOWN_TECH: Array<[string, RegExp]> = [
  ['TypeScript', /\bTypeScript\b/i],
  ['React Native', /\bReact Native\b/i],
  ['Next.js', /\bNext\.js\b/i],
  ['Node.js', /\bNode\.js\b/i],
  ['NestJS', /\bNestJS\b/i],
  ['Express.js', /\bExpress\.js\b/i],
  ['JavaScript', /\bJavaScript\b/i],
  ['React', /\bReact\b/i],
  ['PostgreSQL', /\bPostgreSQL\b/i],
  ['MongoDB', /\bMongoDB\b/i],
  ['Prisma ORM', /\bPrisma(?:\s+ORM)?\b/i],
  ['AWS EC2', /\bAWS\s+EC2\b/i],
  ['AWS SES', /\bAWS\s+SES\b/i],
  ['PM2', /\bPM2\b/i],
  ['Netlify', /\bNetlify\b/i],
  ['Docker', /\bDocker\b/i],
  ['Kubernetes', /\bKubernetes\b/i],
  ['Python', /\bPython\b/i]
];

export function normalizeLinkedInLine(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.([A-Z])/g, '. $1')
    .trim();
}

export function normalizeLinkedInLines(lines: string[]): string[] {
  return lines
    .map(normalizeLinkedInLine)
    .filter(Boolean)
    .filter(line => !FOOTER_RE.test(line));
}

const SECTION_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: 'summary', regex: /^(?:summary|about|about\s+me):?$/i },
  { type: 'experience', regex: /^(?:experience|work\s+experience|professional\s+experience|employment\s+history):?$/i },
  { type: 'education', regex: /^(?:education|academic\s+background|degrees):?$/i },
  { type: 'projects', regex: /^(?:projects|key\s+projects):?$/i },
  { type: 'volunteer', regex: /^(?:volunteer\s+experience|volunteering):?$/i },
  { type: 'contact', regex: /^(?:contact|contact\s+info|contact\s+information):?$/i },
  { type: 'skills', regex: /^(?:top\s+skills|skills|key\s+skills):?$/i },
  { type: 'certifications', regex: /^(?:certifications|licenses\s+(?:&|and)\s+certifications|licenses):?$/i },
  { type: 'languages', regex: /^(?:languages):?$/i },
  { type: 'honors', regex: /^(?:honors-awards|honors\s+(?:&|and)\s+awards|awards):?$/i },
  { type: 'publications', regex: /^(?:publications):?$/i },
  { type: 'patents', regex: /^(?:patents):?$/i }
];

function matchSectionHeading(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length > 60) return null;
  for (const s of SECTION_PATTERNS) {
    if (s.regex.test(trimmed)) return s.type;
  }
  return null;
}

export function partitionSections(lines: string[]): { preamble: string[]; sections: Map<string, string[]> } {
  const matches: Array<{ type: string; index: number; heading: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const matchedType = matchSectionHeading(lines[i]);
    if (matchedType) {
      matches.push({ type: matchedType, index: i, heading: lines[i] });
    }
  }

  const sections = new Map<string, string[]>();
  let preamble: string[] = [];

  if (matches.length === 0) {
    preamble = [...lines];
    return { preamble, sections };
  }

  preamble = lines.slice(0, matches[0].index);

  for (let k = 0; k < matches.length; k++) {
    const curr = matches[k];
    const nextIndex = k + 1 < matches.length ? matches[k + 1].index : lines.length;
    const chunk = lines.slice(curr.index + 1, nextIndex);
    const existing = sections.get(curr.type) || [];
    sections.set(curr.type, [...existing, ...chunk]);
  }

  return { preamble, sections };
}

function hasRecognizableLinkedInProfileStructure(
  mainPartition: ReturnType<typeof partitionSections>,
  sidebarPartition: ReturnType<typeof partitionSections>,
  linkedin: string
): boolean {
  const recognizedSections = new Set([
    ...mainPartition.sections.keys(),
    ...sidebarPartition.sections.keys()
  ]);
  const nonExperienceSectionCount = [...recognizedSections]
    .filter(section => section !== 'experience')
    .length;

  return Boolean(
    linkedin
    && recognizedSections.has('contact')
    && nonExperienceSectionCount >= 3
  );
}

function normalizeUrl(url: string): string {
  const cleaned = url.replace(/\(LinkedIn\)/gi, '').replace(/\s+/g, '').trim();
  if (!cleaned) return '';
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function parseContact(contactLines: string[], allFallbackLines: string[]): { email: string; linkedin: string } {
  const candidateLines = contactLines.length > 0 ? contactLines : allFallbackLines;
  const emailMatch = candidateLines.map(l => l.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)).find(Boolean);
  const email = emailMatch ? emailMatch[0] : '';

  const cleaned = candidateLines
    .filter(line => line !== email)
    .join('')
    .replace(/\(LinkedIn\)/gi, '')
    .replace(/\s+/g, '');
  const match = cleaned.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-z0-9_-]+)/i);
  return { email, linkedin: normalizeUrl(match?.[0] || '') };
}

function parseCertifications(lines: string[], warnings: string[]): string[] {
  const combined: string[] = [];
  for (const raw of lines) {
    const line = normalizeLinkedInLine(raw);
    if (!line) continue;
    if (/^Specialization$/i.test(line) && combined.length > 0) {
      combined[combined.length - 1] = `${combined[combined.length - 1]} Specialization`;
    } else {
      combined.push(line);
    }
  }
  return dedupe(combined, 'certification', warnings);
}

function dedupe(values: string[], warningLabel: string, warnings: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values.map(normalizeLinkedInLine).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      warnings.push(`Duplicate ${warningLabel} removed: ${value}`);
      continue;
    }
    seen.add(key);
    output.push(value);
  }
  return output;
}

function looksLikeOrganization(value: string): boolean {
  const line = value.trim();
  if (!line || BULLET_RE.test(line) || parseDateRange(line) || DURATION_RE.test(line)) return false;
  if (/[.!?]$/.test(line)) return false;
  if (line.length > 80 || line.split(/\s+/).length > 8) return false;
  return true;
}

export function parseDateRange(line: string): { startDate: string; endDate: string | null; yearRange: string } | null {
  const trimmed = normalizeLinkedInLine(line);
  if (!trimmed) return null;

  const fullMatch = trimmed.match(FULL_DATE_RANGE_RE);
  if (fullMatch) {
    const startM = parseMonthIndex(fullMatch[1]);
    const startY = fullMatch[2];
    if (!startM) return null;
    const startDate = `${startY}-${String(startM).padStart(2, '0')}`;

    let endDate: string | null = null;
    if (new RegExp(`^${PRESENT_PART}$`, 'i').test(fullMatch[3])) {
      endDate = null;
    } else {
      const endM = parseMonthIndex(fullMatch[4]);
      const endY = fullMatch[5];
      if (endM && endY) {
        endDate = `${endY}-${String(endM).padStart(2, '0')}`;
      }
    }
    const yearRange = trimmed.replace(/\s*\([^)]*\)$/, '').replace(/\s*·.*$/, '').trim();
    return { startDate, endDate, yearRange };
  }

  const yearMatch = trimmed.match(YEAR_ONLY_RANGE_RE);
  if (yearMatch) {
    const startY = yearMatch[1];
    const startDate = `${startY}-01`;
    let endDate: string | null = null;
    if (new RegExp(`^${PRESENT_PART}$`, 'i').test(yearMatch[2])) {
      endDate = null;
    } else {
      endDate = `${yearMatch[3]}-12`;
    }
    const yearRange = trimmed.replace(/\s*\([^)]*\)$/, '').replace(/\s*·.*$/, '').trim();
    return { startDate, endDate, yearRange };
  }

  return null;
}

function mergeBullets(lines: string[]): string[] {
  const bullets: string[] = [];
  let current = '';
  for (const rawLine of lines) {
    const line = normalizeLinkedInLine(rawLine);
    if (!line) continue;
    if (BULLET_RE.test(line)) {
      if (current) bullets.push(current);
      current = line.replace(BULLET_RE, '').trim();
    } else if (current) {
      current = `${current} ${line}`.trim();
    }
  }
  if (current) bullets.push(current);
  return bullets;
}

export function parseExperience(lines: string[]): ParsedExperience[] {
  const dateEntries = lines
    .map((line, index) => ({ line, index, parsed: parseDateRange(line) }))
    .filter((entry): entry is { line: string; index: number; parsed: NonNullable<ReturnType<typeof parseDateRange>> } => Boolean(entry.parsed));

  if (dateEntries.length === 0) {
    return [];
  }

  const prelim = dateEntries.map((entry, recordIndex) => {
    const roleIndex = entry.index - 1;
    let companyIndex = roleIndex - 1;
    if (companyIndex >= 0 && DURATION_RE.test(lines[companyIndex])) companyIndex -= 1;

    const previousDateIndex = recordIndex > 0 ? dateEntries[recordIndex - 1].index : -1;
    const candidate = companyIndex > previousDateIndex ? lines[companyIndex] : '';
    const hasNewCompany = Boolean(candidate && looksLikeOrganization(candidate));

    return {
      dateIndex: entry.index,
      roleIndex,
      companyIndex: hasNewCompany ? companyIndex : -1,
      parsed: entry.parsed
    };
  });

  const records: ParsedExperience[] = [];
  let currentCompany = '';
  for (let i = 0; i < prelim.length; i += 1) {
    const item = prelim[i];
    if (item.companyIndex >= 0) currentCompany = lines[item.companyIndex];
    const next = prelim[i + 1];
    const endIndex = next ? (next.companyIndex >= 0 ? next.companyIndex : next.roleIndex) : lines.length;
    const afterDate = lines.slice(item.dateIndex + 1, endIndex);
    let location = '';
    if (afterDate[0] && !BULLET_RE.test(afterDate[0]) && !parseDateRange(afterDate[0])) {
      location = afterDate.shift() || '';
    }
    const bullets = mergeBullets(afterDate);
    records.push({
      organization: currentCompany || 'Organization not detected',
      role: lines[item.roleIndex] || 'Role not detected',
      startDate: item.parsed.startDate,
      endDate: item.parsed.endDate,
      yearRange: item.parsed.yearRange,
      location,
      bullets
    });
  }
  return records;
}

export function detectTechnologies(text: string): string[] {
  return KNOWN_TECH.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function inferSystemDomain(role: string, bullets: string[]): string {
  const corpus = `${role} ${bullets.join(' ')}`.toLowerCase();
  if (corpus.includes('full stack') || corpus.includes('full-stack')) return 'Full-Stack Systems';
  if (corpus.includes('react native') || corpus.includes('mobile')) return 'Mobile & Frontend Applications';
  if (corpus.includes('backend') || corpus.includes('api')) return 'Backend & API Systems';
  if (corpus.includes('web')) return 'Web Systems';
  return 'Professional Software Development';
}

function dateScore(value: string | null): number {
  if (value === null) return Number.MAX_SAFE_INTEGER;
  return Number(value.replace('-', ''));
}

export function toExperienceNodes(experience: ParsedExperience[]): ExperienceNode[] {
  const sorted = [...experience].sort((a, b) => {
    const byEnd = dateScore(b.endDate) - dateScore(a.endDate);
    if (byEnd !== 0) return byEnd;
    return dateScore(b.startDate) - dateScore(a.startDate);
  });

  const groups = new Map<string, ParsedExperience[]>();
  for (const item of sorted) {
    const key = item.organization.toLowerCase();
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  const progressionOrder = new Map<ParsedExperience, number>();
  for (const group of groups.values()) {
    [...group]
      .sort((a, b) => dateScore(a.startDate) - dateScore(b.startDate))
      .forEach((item, index) => progressionOrder.set(item, index + 1));
  }

  return sorted.map((item, index) => {
    const groupKey = item.organization.toLowerCase();
    const grouped = (groups.get(groupKey)?.length || 0) > 1;
    const corpus = `${item.role} ${item.bullets.join(' ')}`;
    const tech = detectTechnologies(corpus);
    const promoted = item.bullets.find(bullet => /promoted\s+from/i.test(bullet));
    return {
      id: `exp-${String(index + 1).padStart(2, '0')}-${slug(`${item.organization}-${item.role}`)}`,
      code: `EXP-${String(index + 1).padStart(2, '0')}`,
      yearRange: item.yearRange,
      role: item.role,
      organization: item.organization,
      location: item.location,
      systemDomain: inferSystemDomain(item.role, item.bullets),
      keyOutputs: item.bullets,
      systemsArchitected: [],
      technologies: tech,
      gridPosition: { x: -140 + (index % 3) * 140, y: -40 + Math.floor(index / 3) * 120 },
      provenance: 'CURATED',
      startDate: item.startDate,
      endDate: item.endDate,
      progressionGroup: grouped ? slug(item.organization) : undefined,
      progressionOrder: grouped ? progressionOrder.get(item) : undefined,
      promotionNote: promoted ? 'PROMOTED FROM PREVIOUS ROLE' : undefined
    };
  });
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function firstSentence(text: string): string {
  const match = normalizeLinkedInLine(text).match(/^(.+?[.!?])(?:\s|$)/);
  return match?.[1] || normalizeLinkedInLine(text);
}

export function parseLinkedInProfileText(mainInput: string[], sidebarInput: string[]): ParsedLinkedInProfile {
  const inputLines = [...mainInput, ...sidebarInput];
  if (inputLines.length > MAX_LINKEDIN_INPUT_LINES) {
    throw new Error(`LinkedIn text exceeds the ${MAX_LINKEDIN_INPUT_LINES}-line import limit.`);
  }
  const inputCharacters = inputLines.reduce((total, line) => total + line.length, 0);
  if (inputCharacters > MAX_LINKEDIN_INPUT_CHARACTERS) {
    throw new Error(`LinkedIn text exceeds the ${MAX_LINKEDIN_INPUT_CHARACTERS}-character import limit.`);
  }
  const mainLines = normalizeLinkedInLines(mainInput);
  const sidebarLines = normalizeLinkedInLines(sidebarInput);

  if (mainLines.length === 0 && sidebarLines.length === 0) {
    throw new Error('No extractable text found in PDF. The file may be scanned, encrypted, or empty.');
  }

  const warnings: string[] = [];

  const mainPartition = partitionSections(mainLines);
  const sidebarPartition = partitionSections(sidebarLines);

  const preamble = mainPartition.preamble.length > 0 ? mainPartition.preamble : sidebarPartition.preamble;
  const name = preamble[0]?.trim() || '';
  if (!name) {
    throw new Error('Profile identity (operator name) could not be detected from the PDF header.');
  }

  let location = '';
  let headline = '';
  if (preamble.length === 2) {
    headline = preamble[1];
  } else if (preamble.length > 2) {
    location = preamble[preamble.length - 1];
    headline = preamble.slice(1, -1).join(' ');
  }

  const summary = mainPartition.sections.get('summary')?.join(' ') || sidebarPartition.sections.get('summary')?.join(' ') || '';

  const education = [
    ...(mainPartition.sections.get('education') || []),
    ...(sidebarPartition.sections.get('education') || [])
  ];
  if (education.length > 1) {
    warnings.push('Education entries are retained as raw lines for owner review; the importer does not merge ambiguous school records.');
  }

  const contactLines = [
    ...(sidebarPartition.sections.get('contact') || []),
    ...(mainPartition.sections.get('contact') || [])
  ];
  const contact = parseContact(contactLines, [...sidebarLines, ...mainLines]);

  const skillLines = [
    ...(sidebarPartition.sections.get('skills') || []),
    ...(mainPartition.sections.get('skills') || [])
  ];
  const topSkills = dedupe(skillLines, 'skill', warnings);

  const certLines = [
    ...(sidebarPartition.sections.get('certifications') || []),
    ...(mainPartition.sections.get('certifications') || [])
  ];
  const certifications = parseCertifications(certLines, warnings);

  const hasExperienceSection = mainPartition.sections.has('experience') || sidebarPartition.sections.has('experience');
  const experienceLines = [
    ...(mainPartition.sections.get('experience') || []),
    ...(sidebarPartition.sections.get('experience') || [])
  ];
  const parsedExperience = parseExperience(experienceLines);

  if (hasExperienceSection && parsedExperience.length === 0) {
    throw new Error('LinkedIn Experience section was found, but no valid role or date records could be parsed.');
  }

  if (!hasExperienceSection) {
    if (!hasRecognizableLinkedInProfileStructure(mainPartition, sidebarPartition, contact.linkedin)) {
      throw new Error('PDF does not contain enough recognizable LinkedIn profile structure to import safely.');
    }
    warnings.push(NO_EXPERIENCE_WARNING);
  }

  return {
    name,
    headline,
    location,
    summary: normalizeLinkedInLine(summary).slice(0, MAX_LINKEDIN_SUMMARY_LENGTH),
    email: contact.email,
    linkedin: contact.linkedin,
    topSkills: topSkills.slice(0, MAX_LINKEDIN_PROFILE_ENTRIES),
    certifications: certifications.slice(0, MAX_LINKEDIN_PROFILE_ENTRIES),
    education: education.slice(0, MAX_LINKEDIN_PROFILE_ENTRIES),
    experience: parsedExperience.slice(0, MAX_LINKEDIN_PROFILE_ENTRIES),
    warnings
  };
}

export function buildGeneratedOwnerProfile(parsed: ParsedLinkedInProfile, githubTarget: string, importedAt: string): GeneratedOwnerProfile {
  const role = parsed.headline.split('|')[0]?.trim() || parsed.experience[0]?.role || 'Software Developer';
  const stack = dedupe(
    [...parsed.topSkills, ...detectTechnologies(`${parsed.headline} ${parsed.summary}`)],
    'technology',
    []
  );
  return {
    source: {
      kind: 'linkedin_pdf',
      importedAt,
      reviewed: true,
      warnings: parsed.warnings
    },
    githubTarget,
    operator: {
      name: parsed.name,
      role,
      location: parsed.location,
      focus: firstSentence(parsed.summary),
      primaryStack: stack,
      systemManifesto: parsed.summary,
      contact: {
        email: parsed.email,
        linkedin: parsed.linkedin
      }
    },
    experience: toExperienceNodes(parsed.experience),
    skills: parsed.topSkills,
    certifications: parsed.certifications,
    education: parsed.education.map(raw => ({ raw }))
  };
}
