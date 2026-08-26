import { ProjectData } from '../types';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function canonicalProjectKey(title: string): string {
  const value = normalize(title);
  if (['towerdeskplatform', 'towerdeskbackendclean', 'towerdeskclean'].includes(value)) return 'towerdesk-platform';
  if (['towerdeskapp', 'towerdeskmobileshowcase'].includes(value)) return 'towerdesk-app';
  if (['pillcheck', 'pillcheckpublic'].includes(value)) return 'pillcheck';
  return value;
}

const unique = <T,>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

function mergeEvidence(base: ProjectData, evidence: ProjectData): ProjectData {
  const mergeTextEvidence = (first: string, second: string): string => {
    if (first.includes(second)) return first;
    if (second.includes(first)) return second;
    return `${first} Repository evidence: ${second}`;
  };
  const architectureNotes = mergeTextEvidence(base.architectureNotes, evidence.architectureNotes);
  const resilienceTesting = mergeTextEvidence(base.resilienceTesting, evidence.resilienceTesting);

  return {
    ...base,
    status: evidence.status,
    year: evidence.year === 'CV listed' ? base.year : evidence.year,
    architectureNotes,
    techStack: unique([...base.techStack, ...evidence.techStack], value => value.toLowerCase()),
    subsystems: unique([...base.subsystems, ...evidence.subsystems], item => item.name.toLowerCase()),
    metrics: unique([...base.metrics, ...evidence.metrics], item => `${item.label}:${item.value}`),
    keyDecisions: unique([...base.keyDecisions, ...evidence.keyDecisions], item => item.decision.toLowerCase()),
    resilienceTesting,
    links: {
      ...evidence.links,
      ...base.links,
      github: base.links.github || evidence.links.github
    }
  };
}

/** Keep CV-curated projects first, enrich them with matching public repository evidence,
 * and append repositories that are not represented in the CV. */
export function mergePortfolioProjects(cvProjects: ProjectData[], githubProjects: ProjectData[]): ProjectData[] {
  const remaining = [...githubProjects];
  const merged = cvProjects.map(cvProject => {
    const key = canonicalProjectKey(cvProject.title);
    const matches = remaining.filter(project => canonicalProjectKey(project.title) === key);
    matches.forEach(match => remaining.splice(remaining.indexOf(match), 1));
    return matches.reduce(mergeEvidence, cvProject);
  });
  return [...merged, ...remaining];
}
