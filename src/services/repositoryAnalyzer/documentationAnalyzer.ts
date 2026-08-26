import { EvidenceProvenance, EvidenceSource } from '../../types';
import { AnalyzedDocumentation, RawRepositoryInspection } from './types';

/**
 * Clean raw markdown content: remove badges, html comments, images
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '') // remove HTML comments
    .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '') // remove badge links
    .replace(/!\[.*?\]\(.*?\)/g, '') // remove images
    .replace(/https:\/\/img\.shields\.io\/[^\s\)]+/g, '') // remove shield urls
    .trim();
}

/**
 * Extract sections based on markdown headings
 */
function extractHeadings(markdown: string): Array<{ title: string; level: number; content: string }> {
  const lines = markdown.split('\n');
  const sections: Array<{ title: string; level: number; content: string }> = [];
  
  let currentTitle = 'Introduction';
  let currentLevel = 1;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({
          title: currentTitle,
          level: currentLevel,
          content: currentLines.join('\n').trim()
        });
        currentLines = [];
      }
      currentLevel = headingMatch[1].length;
      currentTitle = headingMatch[2].replace(/[#*_`]/g, '').trim();
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      level: currentLevel,
      content: currentLines.join('\n').trim()
    });
  }

  return sections;
}

/**
 * Extract summary / first substantive paragraph from a section
 */
function extractFirstParagraph(content: string, maxLen = 350): string {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 20 && !p.startsWith('#') && !p.startsWith('```') && !p.startsWith('!'));
  
  if (paragraphs.length === 0) return '';
  const first = paragraphs[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (first.length <= maxLen) return first;
  return first.slice(0, maxLen).replace(/[,;:\s]+[^,;:\s]*$/, '') + '...';
}

/**
 * Extract explicit components described in markdown lists or directory trees
 */
function extractExplicitComponents(markdown: string): AnalyzedDocumentation['explicitComponents'] {
  const components: AnalyzedDocumentation['explicitComponents'] = [];
  const lines = markdown.split('\n');

  // Match patterns like:
  // - `apps/dashboard`: Next.js web application
  // - **Control Server** (`apps/server`): Fastify server owning Playwright browser execution...
  // - `packages/contracts`: Shared TypeScript schemas and event types
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Pattern 1: Monorepo apps / packages bullet
    const monoMatch = line.match(/^[-*]\s+(?:`|\*\*)?((?:apps|packages|services|src)\/[a-zA-Z0-9_\-]+)(?:`|\*\*)?[:\s-]+(.+)$/i);
    if (monoMatch) {
      const path = monoMatch[1];
      const nameParts = path.split('/');
      const rawName = nameParts[nameParts.length - 1];
      const formattedName = rawName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      const desc = monoMatch[2].replace(/[`*]/g, '').trim();
      
      const tech: string[] = [];
      if (/next(?:\.js)?/i.test(desc)) tech.push('Next.js');
      if (/react/i.test(desc) && !tech.includes('Next.js')) tech.push('React');
      if (/fastify/i.test(desc)) tech.push('Fastify');
      if (/express/i.test(desc)) tech.push('Express');
      if (/nest(?:\.js)?/i.test(desc)) tech.push('NestJS');
      if (/playwright/i.test(desc)) tech.push('Playwright');
      if (/sqlite/i.test(desc)) tech.push('SQLite');
      if (/postgres|postgresql/i.test(desc)) tech.push('PostgreSQL');
      if (/prisma/i.test(desc)) tech.push('Prisma');
      if (/tailwind/i.test(desc)) tech.push('Tailwind CSS');
      if (/typescript/i.test(desc)) tech.push('TypeScript');

      let protocol: string | undefined = undefined;
      if (/sse|server-sent events/i.test(desc)) protocol = 'SSE';
      else if (/websocket|socket\.io/i.test(desc)) protocol = 'WebSocket';
      else if (/grpc/i.test(desc)) protocol = 'gRPC';
      else if (/rest|http/i.test(desc)) protocol = 'HTTPS / REST';

      components.push({
        name: formattedName,
        path,
        role: desc.slice(0, 100),
        description: desc,
        tech: tech.length > 0 ? tech : ['TypeScript'],
        protocol
      });
      continue;
    }

    // Pattern 2: Component description bullet like "- **Browser Runner**: Playwright browser execution..."
    const namedMatch = line.match(/^[-*]\s+\*\*([A-Za-z0-9\s/_\-]+)\*\*(?:\s*\(([^)]+)\))?[:\s-]+(.+)$/);
    if (namedMatch) {
      const name = namedMatch[1].trim();
      const parenthetical = namedMatch[2] || '';
      const desc = namedMatch[3].replace(/[`*]/g, '').trim();

      // Skip generic bullet points that aren't system components
      const nonComponentTitles = ['features', 'prerequisites', 'installation', 'license', 'scripts', 'usage', 'getting started', 'requirements', 'notes'];
      if (nonComponentTitles.includes(name.toLowerCase())) continue;

      const tech: string[] = [];
      const combinedText = `${parenthetical} ${desc}`;
      if (/next(?:\.js)?/i.test(combinedText)) tech.push('Next.js');
      if (/react/i.test(combinedText) && !tech.includes('Next.js')) tech.push('React');
      if (/fastify/i.test(combinedText)) tech.push('Fastify');
      if (/express/i.test(combinedText)) tech.push('Express');
      if (/nest(?:\.js)?/i.test(combinedText)) tech.push('NestJS');
      if (/playwright/i.test(combinedText)) tech.push('Playwright');
      if (/sqlite/i.test(combinedText)) tech.push('SQLite');
      if (/postgres|postgresql/i.test(combinedText)) tech.push('PostgreSQL');
      if (/prisma/i.test(combinedText)) tech.push('Prisma');
      if (/socket\.io/i.test(combinedText)) tech.push('Socket.IO');

      let protocol: string | undefined = undefined;
      if (/sse|server-sent events/i.test(combinedText)) protocol = 'SSE';
      else if (/websocket|socket\.io/i.test(combinedText)) protocol = 'WebSocket';
      else if (/grpc/i.test(combinedText)) protocol = 'gRPC';
      else if (/rest|http/i.test(combinedText)) protocol = 'HTTPS / REST';

      components.push({
        name,
        path: parenthetical.startsWith('apps/') || parenthetical.startsWith('packages/') ? parenthetical : undefined,
        role: desc.slice(0, 100),
        description: desc,
        tech: tech.length > 0 ? tech : ['TypeScript'],
        protocol
      });
    }
  }

  return components;
}

/**
 * Extract explicitly documented architectural decisions / tradeoffs from markdown
 */
function extractExplicitDecisions(sections: Array<{ title: string; level: number; content: string }>): AnalyzedDocumentation['explicitDecisions'] {
  const decisions: AnalyzedDocumentation['explicitDecisions'] = [];

  const decisionSections = sections.filter(s => 
    /trade-?offs?|decisions?|architecture decisions?|adr|design decisions?|rationale/i.test(s.title)
  );

  for (const sec of decisionSections) {
    // Case 1: Section itself is a decision, e.g. "Decision: Use ring buffer over channel queues"
    const headingDecisionMatch = sec.title.match(/^(?:Decision|ADR)(?:\s*\d+)?[:\s-]+(.+)$/i);
    if (headingDecisionMatch) {
      const decisionName = headingDecisionMatch[1].trim();
      let rationale = '';
      let tradeoff = 'Documented design trade-off in repository documentation.';

      const rationaleMatch = sec.content.match(/[-*]?\s*(?:\*\*)?Rationale(?:\*\*)?[:\s-]+([^\n]+)/i);
      if (rationaleMatch) rationale = rationaleMatch[1].trim();

      const tradeoffMatch = sec.content.match(/[-*]?\s*(?:\*\*)?Trade-?off(?:\*\*)?[:\s-]+([^\n]+)/i);
      if (tradeoffMatch) tradeoff = tradeoffMatch[1].trim();

      if (!rationale) {
        rationale = extractFirstParagraph(sec.content, 200) || 'Architectural rationale documented in repository README.';
      }

      decisions.push({
        decision: decisionName,
        rationale,
        tradeoff,
        source: {
          sourceType: 'repository_file',
          path: 'README.md',
          section: sec.title
        }
      });
      continue;
    }

    // Case 2: Bullets inside a general "Decisions" section
    const lines = sec.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^[-*]\s+(?:(?:\*\*|`)(.+?)(?:\*\*|`)[:\s-]+)?(.+)$/);
      if (match && match[2] && match[2].length > 25) {
        const title = match[1] || 'Architectural choice';
        const body = match[2].trim();
        
        let decision = title;
        let rationale = body;
        let tradeoff = 'Documented design trade-off in repository documentation.';

        // Check if rationale & tradeoff are explicitly distinguished
        if (body.toLowerCase().includes('tradeoff') || body.toLowerCase().includes('trade-off')) {
          const parts = body.split(/trade-?off[:\s-]+/i);
          if (parts.length > 1) {
            rationale = parts[0].trim();
            tradeoff = parts[1].trim();
          }
        }

        decisions.push({
          decision,
          rationale,
          tradeoff,
          source: {
            sourceType: 'repository_file',
            path: 'README.md',
            section: sec.title
          }
        });
      }
    }
  }

  return decisions;
}

/**
 * Main documentation analysis entry point
 */
export function analyzeDocumentation(inspection: RawRepositoryInspection): AnalyzedDocumentation {
  const rawReadme = inspection.readmeContent;
  if (!rawReadme || rawReadme.trim().length === 0) {
    return {
      challenge: null,
      solution: null,
      architectureNotes: null,
      explicitComponents: [],
      explicitDecisions: [],
      testingNotes: null,
      performanceNotes: null
    };
  }

  const cleaned = cleanMarkdown(rawReadme);
  const sections = extractHeadings(cleaned);

  // 1. Engineering Challenge / Problem
  let challengeText = '';
  let challengeSource: EvidenceSource = { sourceType: 'repository_file', path: 'README.md' };

  const problemSections = sections.filter(s => 
    /why|problem|motivation|background|the challenge|challenge|the problem|objective|context/i.test(s.title)
  );

  if (problemSections.length > 0) {
    challengeText = extractFirstParagraph(problemSections[0].content);
    challengeSource = {
      sourceType: 'repository_file',
      path: 'README.md',
      section: problemSections[0].title
    };
  } else {
    // Fall back to overview / introductory section if it sets up a clear purpose
    const introSection = sections.find(s => /overview|introduction|about|what is/i.test(s.title)) || sections[0];
    if (introSection && introSection.content.length > 40) {
      const p = extractFirstParagraph(introSection.content);
      if (p.length > 30) {
        challengeText = p;
        challengeSource = {
          sourceType: 'repository_file',
          path: 'README.md',
          section: introSection.title
        };
      }
    }
  }

  // 2. Architectural Solution / How it works
  let solutionText = '';
  let solutionSource: EvidenceSource = { sourceType: 'repository_file', path: 'README.md' };

  const archSections = sections.filter(s => 
    /architectur|how it works|system design|design|components|structure|implementation|solution/i.test(s.title)
  );

  if (archSections.length > 0) {
    solutionText = extractFirstParagraph(archSections[0].content);
    solutionSource = {
      sourceType: 'repository_file',
      path: 'README.md',
      section: archSections[0].title
    };
  }

  // 3. Testing notes from documentation
  let testingNotes: string | null = null;
  const testSections = sections.filter(s => /testing|test|verification|quality/i.test(s.title));
  if (testSections.length > 0) {
    testingNotes = extractFirstParagraph(testSections[0].content);
  }

  // 4. Performance / benchmark notes from documentation
  let performanceNotes: string | null = null;
  const perfSections = sections.filter(s => /benchmark|performance|telemetry|load test/i.test(s.title));
  if (perfSections.length > 0) {
    performanceNotes = extractFirstParagraph(perfSections[0].content);
  }

  // 5. Explicit components & decisions
  const explicitComponents = extractExplicitComponents(cleaned);
  const explicitDecisions = extractExplicitDecisions(sections);

  return {
    challenge: challengeText ? {
      text: challengeText,
      provenance: 'VERIFIED',
      source: challengeSource
    } : null,
    solution: solutionText ? {
      text: solutionText,
      provenance: 'VERIFIED',
      source: solutionSource
    } : null,
    architectureNotes: archSections.length > 0 ? {
      text: `Repository README (${archSections[0].title}): ${extractFirstParagraph(archSections[0].content, 200)}`,
      provenance: 'VERIFIED',
      source: solutionSource
    } : null,
    explicitComponents,
    explicitDecisions,
    testingNotes,
    performanceNotes
  };
}
