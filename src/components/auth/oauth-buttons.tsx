'use client';

import { LoaderCircle } from 'lucide-react';
import { GitHubIcon } from '@/components/landing/primitives';
import type { AuthFlow, OAuthProvider } from './use-auth-flow';

const PROVIDERS: { id: OAuthProvider; label: string; icon: React.ReactNode }[] = [
  { id: 'github', label: 'GitHub', icon: <GitHubIcon size={17} /> },
];

export function OAuthButtons({ flow }: { flow: AuthFlow }) {
  return (
    <div className="grid grid-cols-1 gap-2.5">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="btn btn-outline h-11"
          onClick={() => flow.handleOAuthSignIn(p.id)}
          disabled={flow.isAnyLoading}
          aria-busy={flow.oauthLoading === p.id || undefined}
          aria-label={`Continue with ${p.label}`}
        >
          {flow.oauthLoading === p.id ? <LoaderCircle size={17} className="animate-spin" aria-hidden /> : p.icon}
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
