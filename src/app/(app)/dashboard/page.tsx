import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProblemsTable } from '@/components/problems-table';

export const metadata: Metadata = {
  title: 'Problems',
  description: 'Every DSA problem you track, with its next review date.',
};

function DashboardFallback() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="border-b border-border pb-8">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton mt-5 h-12 w-72" />
        <div className="skeleton mt-4 h-4 w-96 max-w-full" />
      </div>
      <div className="skeleton mt-8 h-8 w-80 max-w-full" />
      <div className="card mt-5 h-[420px]" />
    </div>
  );
}

// Suspense is required because the table reads its filters from useSearchParams.
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <ProblemsTable />
    </Suspense>
  );
}
