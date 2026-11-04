import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth/auth-screen';

// useSearchParams (callbackUrl, error) needs a Suspense boundary.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="paper min-h-[100dvh]" />}>
      <AuthScreen />
    </Suspense>
  );
}
