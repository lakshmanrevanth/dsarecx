'use client';

// Settings: profile, review preferences, intervals, appearance, data,
// feedback, account and the danger zone. One calm column of numbered sections.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { ArrowUpRight, Download, LogOut, Mail, Monitor, Moon, RotateCcw, Sun, Upload } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { useTheme, type Theme } from '@/components/theme-provider';
import { ImportModal } from '@/components/import-modal';
import { PlatformLogo } from '@/lib/platforms/logos';
import type { Platform, UserPreferences } from '@/lib/preferences';
import { cn } from '@/lib/utils';
import { AccountSection } from './account-section';
import { Row, Section, Segmented, StatusText, Switch, requestJson, useSaveState } from './ui';

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'LEETCODE', label: 'LeetCode' },
  { id: 'CODEFORCES', label: 'Codeforces' },
  { id: 'GFG', label: 'GeeksforGeeks' },
  { id: 'HACKERRANK', label: 'HackerRank' },
  { id: 'CODECHEF', label: 'CodeChef' },
];

const DEFAULT_LADDER = [3, 7, 14, 30];
const GOAL_PRESETS = [3, 5, 10, 15];
const NAME_MAX = 60;

// Other pages (daily goal bar, add/import default platform) read these browser copies,
// so keep them in sync with the server.
const LOCAL_MIRRORS = {
  dailyGoal: ['dsarecx_daily_target', 'recall_daily_target'],
  defaultPlatform: ['dsarecx_default_platform', 'recall_default_platform'],
};

function writeLocal(keys: string[], value: string) {
  try {
    for (const k of keys) localStorage.setItem(k, value);
  } catch {
    // storage unavailable
  }
}

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

const FALLBACK_ZONES = [
  'UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Pacific/Honolulu',
];

function allTimeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const list = fn ? fn('timeZone') : [];
    if (list.length > 0) return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    // older browsers
  }
  return FALLBACK_ZONES;
}

const tzLabel = (tz: string) => tz.replace(/_/g, ' ');


/** Client copy of the server's ladder rule: 4 increasing whole numbers, 1-365. */
function ladderError(values: string[]): string | null {
  const nums = values.map((v) => Number(v));
  if (values.some((v) => v.trim() === '') || nums.some((n) => !Number.isInteger(n))) return 'Each interval must be a whole number of days.';
  if (nums.some((n) => n < 1 || n > 365)) return 'Intervals must be between 1 and 365 days.';
  if (nums.some((n, i) => i > 0 && n <= nums[i - 1])) return 'Each interval must be longer than the one before it.';
  return null;
}

const noopSubscribe = () => () => {};

function SettingsSkeleton() {
  return (
    <div className="grid gap-10" aria-busy="true" aria-label="Loading settings">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-t border-border pt-8">
          <div className="skeleton h-3 w-28" />
          {[0, 1].map((j) => (
            <div key={j} className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center sm:gap-8">
              <div className="grid gap-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-64 max-w-full" />
              </div>
              <div className="skeleton h-10 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ThemeControl() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun size={14} strokeWidth={1.75} aria-hidden /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={14} strokeWidth={1.75} aria-hidden /> },
    { value: 'system', label: 'System', icon: <Monitor size={14} strokeWidth={1.75} aria-hidden /> },
  ];
  return <Segmented options={options} value={mounted ? theme : null} onChange={setTheme} labelledBy="theme-label" />;
}

export default function SettingsPage() {
  const { update: updateSession } = useSession();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  const [ladderDraft, setLadderDraft] = useState<string[]>(DEFAULT_LADDER.map(String));
  const [customGoal, setCustomGoal] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);

  const nameSave = useSaveState();
  const goalSave = useSaveState();
  const prefSave = useSaveState();
  const ladderSave = useSaveState();

  const zones = useMemo(() => allTimeZones(), []);
  const [detectedTz] = useState(() => (typeof window === 'undefined' ? null : browserTimeZone()));

  const applyPrefs = useCallback((p: UserPreferences) => {
    setPrefs(p);
    setLadderDraft(p.ladderDays.map(String));
    writeLocal(LOCAL_MIRRORS.dailyGoal, String(p.dailyGoal));
    writeLocal(LOCAL_MIRRORS.defaultPlatform, p.defaultPlatform);
  }, []);

  /** PATCH /api/settings and apply the returned preferences. Throws with the server message. */
  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      const data = await requestJson<{ preferences: UserPreferences; user: { name: string | null } }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      applyPrefs(data.preferences);
      return data;
    },
    [applyPrefs]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await requestJson<{ user: { name: string | null; email: string }; preferences: UserPreferences }>('/api/settings');
      setName(data.user.name || '');
      setSavedName(data.user.name || '');
      setEmail(data.user.email || '');
      applyPrefs(data.preferences);
      // First visit: store the browser's timezone so streaks and "due today" use the right day.
      if (!data.preferences.timezone && detectedTz && zones.includes(detectedTz)) {
        patch({ timezone: detectedTz }).catch(() => undefined);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, [applyPrefs, detectedTz, patch, zones]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  /** Optimistic preference update; reverts if the server rejects it. */
  const savePref = (body: Partial<UserPreferences>, message: string, tracker = prefSave) => {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, ...body });
    void tracker.run(() => patch(body), message).then((ok) => {
      if (!ok) setPrefs(before);
    });
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return nameSave.fail('Name cannot be empty');
    if (trimmed.length > NAME_MAX) return nameSave.fail(`Name must be at most ${NAME_MAX} characters`);
    const ok = await nameSave.run(() => patch({ name: trimmed }), 'Name updated');
    if (ok) {
      setName(trimmed);
      setSavedName(trimmed);
      await updateSession().catch(() => undefined);
    }
  };

  const saveLadder = async () => {
    const err = ladderError(ladderDraft);
    if (err) return ladderSave.fail(err);
    await ladderSave.run(() => patch({ ladderDays: ladderDraft.map(Number) }), 'Intervals saved');
  };

  const resetLadder = async () => {
    setLadderDraft(DEFAULT_LADDER.map(String));
    await ladderSave.run(() => patch({ ladderDays: DEFAULT_LADDER }), 'Intervals reset to 3 / 7 / 14 / 30');
  };

  const setCustom = () => {
    const n = Number(customGoal);
    if (!Number.isInteger(n) || n < 1 || n > 200) return goalSave.fail('Daily goal must be a whole number from 1 to 200');
    setCustomGoal('');
    savePref({ dailyGoal: n }, `Daily goal: ${n}`, goalSave);
  };

  const initial = (name || email || 'U').charAt(0).toUpperCase();
  const ladderValidation = ladderError(ladderDraft);
  const ladderDirty = prefs ? ladderDraft.join() !== prefs.ladderDays.join() : false;
  const tzOptions = prefs?.timezone && !zones.includes(prefs.timezone) ? [prefs.timezone, ...zones] : zones;
  const previewLadder = ladderValidation ? (prefs?.ladderDays ?? DEFAULT_LADDER) : ladderDraft.map(Number);

  return (
    <div className="w-full max-w-3xl pb-20">
      {/* Header */}
      <header className="pb-10">
        <p className="eyebrow">Preferences &amp; account</p>
        <h1 className="display mt-4 text-5xl md:text-6xl">
          Your <em>settings.</em>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Your review schedule, appearance, data backups and account. Changes save as you make them.
        </p>
      </header>

      {loading ? (
        <SettingsSkeleton />
      ) : loadError || !prefs ? (
        <div role="alert" className="border-t border-border pt-8">
          <p className="display text-3xl">Couldn&apos;t load settings.</p>
          <p className="mt-2 text-[14px] text-muted-foreground">{loadError ?? 'Please try again.'}</p>
          <button type="button" className="btn btn-outline mt-5" onClick={load}>
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-12">
          {/* (01) Profile */}
          <Section index={1} id="profile" title="Profile">
            <div className="flex items-center gap-4 py-5">
              <span
                aria-hidden
                className="display grid h-14 w-14 shrink-0 place-items-center rounded-full border border-border bg-card text-3xl text-ember shadow-card"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="display truncate text-2xl">{savedName || 'Your name'}</p>
                <p className="mt-0.5 break-all font-mono text-[12px] text-muted-foreground">{email}</p>
              </div>
            </div>
            <Row label="Display name" htmlFor="display-name" description="Shown in the sidebar and in account emails.">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSaveName();
                }}
              >
                <input
                  id="display-name"
                  type="text"
                  value={name}
                  maxLength={NAME_MAX}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                  className="field flex-1"
                />
                <button
                  type="submit"
                  className="btn btn-outline"
                  disabled={nameSave.state.status === 'saving' || name.trim() === savedName}
                >
                  {nameSave.state.status === 'saving' ? 'Saving…' : 'Save'}
                </button>
              </form>
              <StatusText state={nameSave.state} className="mt-2" />
            </Row>
            <Row label="Sign out" description="End this session on this device.">
              <button type="button" data-sign-out-btn className="btn btn-outline w-full sm:w-auto" onClick={() => signOut({ callbackUrl: '/' })}>
                <LogOut size={16} strokeWidth={1.75} aria-hidden /> Sign out
              </button>
            </Row>
          </Section>

          {/* (02) Review */}
          <Section index={2} id="review" title="Review">
            <Row
              label="Daily revision goal"
              labelId="goal-label"
              align="start"
              description={
                <>
                  Reviews you aim for each day. Current goal: <span className="font-mono text-foreground">{prefs.dailyGoal}</span>.
                </>
              }
            >
              <Segmented
                labelledBy="goal-label"
                value={prefs.dailyGoal}
                options={GOAL_PRESETS.map((n) => ({
                  value: n,
                  ariaLabel: `${n} per day`,
                  label: <span className="font-mono tabular-nums">{n}</span>,
                }))}
                onChange={(n) => {
                  setCustomGoal('');
                  if (n !== prefs.dailyGoal) savePref({ dailyGoal: n }, `Daily goal: ${n}`, goalSave);
                }}
              />
              <div className="mt-2.5 flex items-center gap-2">
                <label htmlFor="custom-goal" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Custom
                </label>
                <input
                  id="custom-goal"
                  type="number"
                  min={1}
                  max={200}
                  inputMode="numeric"
                  placeholder={GOAL_PRESETS.includes(prefs.dailyGoal) ? '1–200' : String(prefs.dailyGoal)}
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (customGoal) setCustom();
                    }
                  }}
                  className="field h-8 w-24 font-mono text-[13px]"
                />
                <button type="button" className="btn btn-outline btn-sm" disabled={!customGoal} onClick={setCustom}>
                  Set
                </button>
              </div>
              <StatusText state={goalSave.state} className="mt-2" />
            </Row>

            <Row
              label="Streak needs the daily goal"
              htmlFor="goal-streak"
              description={`Off: any review keeps your streak. On: a day counts only with ${prefs.dailyGoal} reviews.`}
            >
              <div className="flex sm:justify-end">
                <Switch
                  id="goal-streak"
                  label="Streak counts only when the daily goal is met"
                  checked={prefs.goalBasedStreak}
                  onChange={(v) => savePref({ goalBasedStreak: v }, v ? 'Streak now needs the daily goal' : 'Any review keeps the streak')}
                />
              </div>
            </Row>

            <Row label="Default platform" htmlFor="default-platform" description="Pre-selected when you add a new problem.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2" aria-hidden>
                  <PlatformLogo platform={prefs.defaultPlatform} size={18} padding={1} />
                </span>
                <select
                  id="default-platform"
                  value={prefs.defaultPlatform}
                  onChange={(e) => {
                    const p = PLATFORMS.find((x) => x.id === e.target.value);
                    if (p) savePref({ defaultPlatform: p.id }, `Default platform: ${p.label}`);
                  }}
                  className="field pl-10"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </Row>

            <Row
              label="Timezone"
              htmlFor="timezone"
              align="start"
              description={
                <>
                  Decides when your day starts for streaks and &ldquo;due today&rdquo;.
                  {detectedTz && prefs.timezone !== detectedTz && (
                    <>
                      {' '}
                      This device is on {tzLabel(detectedTz)}.{' '}
                      <button
                        type="button"
                        className="font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-ember"
                        onClick={() => savePref({ timezone: detectedTz }, `Timezone: ${tzLabel(detectedTz)}`)}
                      >
                        Use it
                      </button>
                    </>
                  )}
                </>
              }
            >
              <select
                id="timezone"
                value={prefs.timezone ?? ''}
                onChange={(e) => savePref({ timezone: e.target.value || null }, `Timezone: ${tzLabel(e.target.value || 'automatic')}`)}
                className="field"
              >
                {!prefs.timezone && <option value="">Not set (UTC)</option>}
                {tzOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tzLabel(tz)}
                    {tz === detectedTz ? ' (this device)' : ''}
                  </option>
                ))}
              </select>
            </Row>
            <StatusText state={prefSave.state} className="pt-3" />
          </Section>

          {/* (03) Review intervals */}
          <Section
            index={3}
            id="intervals"
            title="Review intervals"
            description="After each clean recall a problem or concept moves up one step. Set how many days each step waits. Changes apply to future reviews; anything already scheduled keeps its date."
          >
            <div className="py-5">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {ladderDraft.map((v, i) => (
                  <div key={i}>
                    <label htmlFor={`ladder-${i}`} className="label">
                      Step {i + 1}
                    </label>
                    <div className="relative">
                      <input
                        id={`ladder-${i}`}
                        type="number"
                        min={1}
                        max={365}
                        inputMode="numeric"
                        value={v}
                        aria-invalid={!!ladderValidation && ladderDirty}
                        aria-describedby="ladder-hint"
                        onChange={(e) => {
                          const next = [...ladderDraft];
                          next[i] = e.target.value;
                          setLadderDraft(next);
                          ladderSave.reset();
                        }}
                        className={cn(
                          'field pr-7 font-mono tabular-nums',
                          ladderValidation && ladderDirty && 'border-error focus:border-error'
                        )}
                      />
                      <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-faint">
                        d
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p
                id="ladder-hint"
                className={cn('mt-2.5 text-[12.5px]', ladderValidation && ladderDirty ? 'text-error' : 'text-muted-foreground')}
              >
                {ladderValidation && ladderDirty ? ladderValidation : 'Whole days from 1 to 365, each longer than the last.'}
              </p>

              {/* Ladder preview */}
              <ol
                aria-label="Schedule preview"
                className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
              >
                <li>Learn</li>
                {previewLadder.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span aria-hidden className="text-faint">→</span>
                    <span className="chip chip-mono h-6 text-foreground">{d}d</span>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <span aria-hidden className="text-faint">→</span>
                  <span className="text-success">Mastered</span>
                  <span className="normal-case tracking-normal text-faint">· 90-day recheck</span>
                </li>
              </ol>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveLadder}
                  disabled={!ladderDirty || !!ladderValidation || ladderSave.state.status === 'saving'}
                >
                  {ladderSave.state.status === 'saving' ? 'Saving…' : 'Save intervals'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetLadder}
                  disabled={ladderSave.state.status === 'saving' || (prefs.ladderDays.join() === DEFAULT_LADDER.join() && !ladderDirty)}
                >
                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden /> Reset to 3 / 7 / 14 / 30
                </button>
                <StatusText state={ladderSave.state} className="ml-1" />
              </div>
            </div>
          </Section>

          {/* (04) Appearance */}
          <Section index={4} id="appearance" title="Appearance">
            <Row
              label="Theme"
              labelId="theme-label"
              description="System follows your device's light or dark setting. Saved in this browser."
            >
              <ThemeControl />
            </Row>
          </Section>

          {/* (05) Data */}
          <Section index={5} id="data" title="Data">
            <Row
              label="Import"
              description="Bring in a problem list from CSV or Excel, or restore a full JSON backup."
            >
              <button type="button" data-import-btn className="btn btn-outline w-full" onClick={() => setShowImportModal(true)}>
                <Upload size={16} strokeWidth={1.75} aria-hidden /> Import or restore…
              </button>
            </Row>
            <Row
              label="Export"
              description="Download everything as one JSON file: problems, concepts, notes, revisions, lists and streaks. No lock-in."
            >
              <a href="/api/export" data-export-btn className="btn btn-outline w-full">
                <Download size={16} strokeWidth={1.75} aria-hidden /> Export all data (.json)
              </a>
            </Row>
          </Section>

          {/* (06) Feedback */}
          <Section index={6} id="feedback" title="Feedback">
            <Row label="Report a bug or request a feature" description={`Help shape ${siteConfig.name}. Every message is read.`}>
              <div className="flex flex-col gap-2">
                {siteConfig.githubUrl && (
                  <a
                    href={`${siteConfig.githubUrl}/issues/new`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline w-full"
                  >
                    Open a GitHub issue <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                  </a>
                )}
                <a
                  href={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(`${siteConfig.name} feedback`)}`}
                  className="btn btn-outline w-full"
                >
                  <Mail size={16} strokeWidth={1.75} aria-hidden /> Email feedback
                </a>
              </div>
            </Row>
          </Section>

          {/* (07) Account + (08) Danger zone */}
          <AccountSection index={7} onEmailChanged={setEmail} />
        </div>
      )}

      {showImportModal && (
        <ImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(res: { imported: number; skipped: number }) => {
            setImportToast(`Imported ${res.imported} problems${res.skipped > 0 ? ` (${res.skipped} skipped)` : ''}`);
            setTimeout(() => setImportToast(null), 4000);
          }}
        />
      )}

      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6">
        {importToast && (
          <div className="menu pointer-events-auto flex items-center gap-2 px-4 py-3 text-[13.5px]">
            <span className="ember-dot" aria-hidden /> {importToast}
          </div>
        )}
      </div>
    </div>
  );
}
