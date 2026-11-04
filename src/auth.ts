import NextAuth, { CredentialsSignin } from 'next-auth'
import type { Account, Profile, User } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GitHubProvider from 'next-auth/providers/github'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimits, getClientIp, AUTH_LIMITS } from '@/lib/rate-limit'
import { checkTokenFreshness } from '@/lib/auth-session'
import { siteConfig } from '@/config/site'

// Error codes surfaced on the login screen through signIn()'s `code`.
class EmailNotVerified extends CredentialsSignin {
  code = 'email_not_verified'
}

class RateLimited extends CredentialsSignin {
  code = 'rate_limited'
}

const normalizeEmail = (email: string) => email.toLowerCase().trim()

/** True only when GitHub reports `email` as verified for the signed-in GitHub user. */
async function isGitHubEmailVerified(accessToken: string | undefined, email: string): Promise<boolean> {
  if (!accessToken) return false
  try {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': `${siteConfig.name}-app`,
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return false
    const emails = (await res.json()) as { email: string; verified: boolean }[]
    return Array.isArray(emails) && emails.some((e) => e.verified && e.email.toLowerCase() === email)
  } catch {
    return false
  }
}

/** Email + password sign-in: rate limited, and only verified accounts get in. */
async function authorizeCredentials(credentials: Partial<Record<string, unknown>> | undefined, request: Request | undefined) {
  const rawEmail = credentials?.email
  const password = credentials?.password
  if (!rawEmail || !password) return null
  const email = normalizeEmail(String(rawEmail))

  const ip = request?.headers ? getClientIp(request.headers) : 'unknown'
  const limited = await checkRateLimits([
    { key: `signin:ip:${ip}`, ...AUTH_LIMITS.signInPerIp },
    { key: `signin:email-ip:${email}:${ip}`, ...AUTH_LIMITS.signInPerEmailIp },
  ])
  if (!limited.ok) throw new RateLimited()

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.password) return null
  if (!(await bcrypt.compare(String(password), user.password))) return null

  // Revealed only after a correct password, so it doesn't leak which emails exist.
  if (!user.emailVerified) throw new EmailNotVerified()

  return user
}

/**
 * OAuth sign-in for an email that may already have an account. Links the
 * provider to that account, but only for provider-verified emails, and removes
 * any password set by someone who never proved they own the email (the
 * "sign up first, wait for the owner to use GitHub" takeover).
 */
async function allowOAuthSignIn(user: User, account: Account, _profile: Profile | undefined): Promise<boolean> {
  if (!user.email) return false

  const email = normalizeEmail(user.email)
  const existing = await prisma.user.findUnique({ where: { email }, include: { accounts: true } })
  // New user: let Auth.js create it (events.createUser marks it verified).
  if (!existing) return true

  // GitHub lets people add emails they haven't verified, so check before linking by email.
  if (account.provider === 'github') {
    const alreadyLinked = existing.accounts.some(
      (a) => a.provider === 'github' && a.providerAccountId === account.providerAccountId
    )
    if (!alreadyLinked && !(await isGitHubEmailVerified(account.access_token, email))) return false
  }

  // The provider has now proved who owns this email. A password on an
  // unverified account was set by someone who never proved it, so drop it;
  // the real owner can set one later with "Forgot password".
  if (!existing.emailVerified) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { emailVerified: new Date(), password: null },
    })
  }

  const linked = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
  })
  if (linked) return true

  await prisma.account.create({
    data: {
      userId: existing.id,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      access_token: account.access_token ?? null,
      refresh_token: account.refresh_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
      session_state: (account.session_state as string) ?? null,
    },
  })
  return true
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: (credentials, request) => authorizeCredentials(credentials, request),
    }),
  ],
  events: {
    // Auth.js creates OAuth users with emailVerified: null. The provider has
    // proved the email, so mark it verified; otherwise /api/auth/signup would
    // treat the account as unclaimed, and allowOAuthSignIn would later wipe a
    // password the user set in Settings.
    async createUser({ user }) {
      if (!user.id) return
      try {
        await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
      } catch (e) {
        console.error('[auth] could not mark new OAuth user verified:', e)
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Credentials users were fully checked in authorize().
        if (!account || account.provider === 'credentials') return !!user?.email
        return await allowOAuthSignIn(user, account, profile)
      } catch (error) {
        console.error('[auth] signIn callback error:', error)
        return false
      }
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        const now = Date.now()
        token.id = user.id
        token.email = user.email
        token.issuedAt = now
        // Set only at a real sign-in (never backfilled), so "recently signed in" checks are safe.
        token.signedInAt = now
        token.pwCheckedAt = now
        return token
      }
      // After an email or name change the client calls update() to refresh the session.
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, name: true },
        })
        if (!fresh) return null
        token.email = fresh.email
        token.name = fresh.name
      }
      // null ends the session (e.g. the password changed elsewhere).
      return checkTokenFreshness(token)
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
})
