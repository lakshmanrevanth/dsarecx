import { BarChart3, CalendarCheck2, LayoutGrid, Network, NotebookPen, Settings, type LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  /** Shorter label for the mobile dock. */
  short: string;
  href: string;
  icon: LucideIcon;
  /** Shows the due-today count. */
  dueBadge?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Today', short: 'Today', href: '/today', icon: NotebookPen },
  { label: 'Dashboard', short: 'Problems', href: '/dashboard', icon: LayoutGrid },
  { label: 'Daily review', short: 'Daily', href: '/daily', icon: CalendarCheck2, dueBadge: true },
  { label: 'System design', short: 'Design', href: '/concepts', icon: Network },
  { label: 'Stats', short: 'Stats', href: '/stats', icon: BarChart3 },
  { label: 'Settings', short: 'Settings', href: '/settings', icon: Settings },
];

export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
