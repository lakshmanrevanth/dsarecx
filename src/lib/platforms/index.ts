import { leetcodeResolver } from './leetcode';
import { codeforcesResolver } from './codeforces';
import { codechefResolver } from './codechef';
import { gfgResolver } from './gfg';
import { hackerrankResolver } from './hackerrank';
import type { PlatformResolver } from './types';

/** Every supported platform resolver, keyed by the Prisma `Platform` enum value. */
export const resolvers: Record<string, PlatformResolver> = {
  LEETCODE: leetcodeResolver,
  CODEFORCES: codeforcesResolver,
  CODECHEF: codechefResolver,
  GFG: gfgResolver,
  HACKERRANK: hackerrankResolver,
};

/** The resolver for a platform, or null when the platform has none. */
export function getResolver(platform: string): PlatformResolver | null {
  return Object.prototype.hasOwnProperty.call(resolvers, platform) ? resolvers[platform] : null;
}
