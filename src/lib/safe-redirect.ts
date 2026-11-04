// Post-login redirects may only point at pages on this site.
// "/dashboard" is fine; "https://evil.com", "//evil.com" and "/\evil.com" are not.
export function safeCallbackUrl(value: string | null | undefined, fallback = '/today'): string {
  if (!value) return fallback;
  const isLocalPath = value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
  return isLocalPath ? value : fallback;
}
