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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_PATTERN = MONTHS.join('|');
const DATE_RANGE_RE = new RegExp(`^(${MONTH_PATTERN})\\s+(\\d{4})\\s*[-–—]\\s*(Present|(${MONTH_PATTERN})\\s+(\\d{4}))(?:\\s*\\([^)]*\\))?$`, 'i');
const DURATION_RE = /^\d+\s+(?:yr|yrs|year|years|mo|mos|month|months)(?:\s+\d+\s+(?:mo|mos|month|months))?$/i;
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

function section(lines: string[], heading: string, nextHeading?: string): string[] {
  const start = lines.findIndex(line => line.toLowerCase() === heading.toLowerCase());
  if (start < 0) return [];
  const tail = lines.slice(start + 1);
  if (!nextHeading) return tail;
  const end = tail.findIndex(line => line.toLowerCase() === nextHeading.toLowerCase());
  return end < 0 ? tail : tail.slice(0, end);
}

function normalizeUrl(url: string): string {
  const cleaned = url.replace(/\(LinkedIn\)/gi, '').replace(/\s+/g, '').trim();
  if (!cleaned) return '';
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function parseContact(sidebarLines: string[]): { email: string; linkedin: string } {
  const contact = section(sidebarLines, 'Contact', 'Top Skills');
  const email = contact.find(line => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line)) || '';
  const urlCandidate = contact
    .filter(line => line !== email)
    .join('')
    .replace(/\(LinkedIn\)/gi, '');
  const match = urlCandidate.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-z0-9_-]+\/?/i);
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
  if (!line || BULLET_RE.test(line) || DATE_RANGE_RE.test(line) || DURATION_RE.test(line)) return false;
  if (/[.!?]$/.test(line)) return false;
  if (line.length > 80 || line.split(/\s+/).length > 8) return false;
  return true;
}

function monthIndex(name: string): number {
  return MONTHS.findIndex(month => month.toLowerCase() === name.toLowerCase()) + 1;
}

function parseDateRange(line: string): { startDate: string; endDate: string | null; yearRange: string } | null {
  const normalized = normalizeLinkedInLine(line).replace(/\s+\([^)]*\)$/, '');
  const match = normalized.match(new RegExp(`^(${MONTH_PATTERN})\\s+(\\d{4})\\s*-\\s*(Present|(${MONTH_PATTERN})\\s+(\\d{4}))$`, 'i'));
  if (!match) return null;
  const startDate = `${match[2]}-${String(monthIndex(match[1])).padStart(2, '0')}`;
  const endDate = match[3].toLowerCase() === 'present'
    ? null
    : `${match[5]}-${String(monthIndex(match[4])).padStart(2, '0')}`;
  return { startDate, endDate, yearRange: normalized };
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

function parseExperience(lines: string[]): ParsedExperience[] {
  const dateEntries = lines
    .map((line, index) => ({ line, index, parsed: parseDateRange(line) }))
    .filter((entry): entry is { line: string; index: number; parsed: NonNullable<ReturnType<typeof parseDateRange>> } => Boolean(entry.parsed));

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
    if (afterDate[0] && !BULLET_RE.test(afterDate[0]) && !DATE_RANGE_RE.test(afterDate[0])) {
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
  const mainLines = normalizeLinkedInLines(mainInput);
  const sidebarLines = normalizeLinkedInLines(sidebarInput);
  const warnings: string[] = [];

  const summaryIndex = mainLines.findIndex(line => line.toLowerCase() === 'summary');
  const experienceIndex = mainLines.findIndex(line => line.toLowerCase() === 'experience');
  const educationIndex = mainLines.findIndex(line => line.toLowerCase() === 'education');
  const preamble = summaryIndex > 0 ? mainLines.slice(0, summaryIndex) : [];
  const name = preamble[0] || '';
  const location = preamble.length > 1 ? preamble[preamble.length - 1] : '';
  const headline = preamble.slice(1, -1).join(' ');
  const summary = summaryIndex >= 0 && experienceIndex > summaryIndex
    ? mainLines.slice(summaryIndex + 1, experienceIndex).join(' ')
    : '';
  const experienceLines = experienceIndex >= 0
    ? mainLines.slice(experienceIndex + 1, educationIndex > experienceIndex ? educationIndex : undefined)
    : [];
  const education = educationIndex >= 0 ? mainLines.slice(educationIndex + 1) : [];

  const contact = parseContact(sidebarLines);
  const topSkills = dedupe(section(sidebarLines, 'Top Skills', 'Certifications'), 'skill', warnings);
  const certifications = parseCertifications(section(sidebarLines, 'Certifications'), warnings);
  const parsedExperience = parseExperience(experienceLines);
  if (!parsedExperience.length) warnings.push('No experience entries were detected. Review the PDF layout or extracted text.');
  if (education.length > 1) warnings.push('Education entries are retained as raw lines for owner review; the importer does not merge ambiguous school records.');

  return {
    name,
    headline,
    location,
    summary: normalizeLinkedInLine(summary),
    email: contact.email,
    linkedin: contact.linkedin,
    topSkills,
    certifications,
    education,
    experience: parsedExperience,
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
