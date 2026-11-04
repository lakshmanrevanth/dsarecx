// Shared contract for every platform resolver (LeetCode, Codeforces, ...).

export type ProblemMeta = {
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  url: string;
  problemNumber?: number;
  code?: string;
};

export type ResolveResult =
  | { found: true; data: ProblemMeta }
  // 'lookup_failed' means a live source could not be reached (as opposed to a plain miss).
  | { found: false; reason?: 'not_found' | 'lookup_failed' };

export interface PlatformResolver {
  resolve(identifier: string): Promise<ResolveResult>;
}
