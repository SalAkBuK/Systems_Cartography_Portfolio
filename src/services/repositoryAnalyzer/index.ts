import { ProjectData } from '../../types';
import { analyzeDocumentation } from './documentationAnalyzer';
import { analyzeDependencies } from './dependencyAnalyzer';
import { analyzeTesting } from './testAnalyzer';
import { analyzeArchitecture } from './architectureAnalyzer';
import { mergeRepositoryEvidence } from './evidenceMerger';
import { RawRepositoryInspection } from './types';

export * from './types';
export * from './documentationAnalyzer';
export * from './dependencyAnalyzer';
export * from './testAnalyzer';
export * from './architectureAnalyzer';
export * from './evidenceMerger';

export interface AnalyzeRepositoryOptions {
  repo: {
    id: number;
    name: string;
    description: string | null;
    html_url: string;
    homepage: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string | null;
    topics: string[];
    size: number;
    archived: boolean;
    default_branch: string;
    license: { spdx_id?: string; name?: string } | null;
    owner: { login: string };
    pushed_at?: string;
  };
  inspection?: RawRepositoryInspection;
  index?: number;
  total?: number;
}

/**
 * Main pipeline coordinator: analyzes repository artifacts and produces unified ProjectData
 */
export function analyzeRepository(
  repoOrOptions: AnalyzeRepositoryOptions | AnalyzeRepositoryOptions['repo'],
  index: number = 0,
  total: number = 1,
  inspectionParam?: RawRepositoryInspection
): ProjectData {
  let options: AnalyzeRepositoryOptions;
  if ('repo' in (repoOrOptions as AnalyzeRepositoryOptions) && (repoOrOptions as AnalyzeRepositoryOptions).repo) {
    options = repoOrOptions as AnalyzeRepositoryOptions;
  } else {
    options = {
      repo: repoOrOptions as AnalyzeRepositoryOptions['repo'],
      index,
      total,
      inspection: inspectionParam
    };
  }

  const { repo, index: idx = 0, total: tot = 1 } = options;

  const inspection: RawRepositoryInspection = {
    repoName: repo.name,
    owner: repo.owner?.login || '',
    defaultBranch: repo.default_branch || 'main',
    language: repo.language,
    topics: repo.topics || [],
    description: repo.description,
    sizeKb: repo.size || 0,
    stargazersCount: repo.stargazers_count || 0,
    forksCount: repo.forks_count || 0,
    openIssuesCount: repo.open_issues_count || 0,
    licenseSpdx: repo.license?.spdx_id || null,
    ...(options.inspection || {})
  };

  const documentation = analyzeDocumentation(inspection);
  const dependencies = analyzeDependencies(inspection);
  const testing = analyzeTesting(inspection, dependencies, documentation);
  const architecture = analyzeArchitecture(inspection, documentation, dependencies);

  return mergeRepositoryEvidence({
    repo,
    index: idx,
    total: tot,
    inspection,
    documentation,
    dependencies,
    architecture,
    testing
  });
}
