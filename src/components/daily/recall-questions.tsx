'use client';

// Recall questions shown before the notes are revealed. They can be generated with
// AI from the item and the user's notes, regenerated, or edited by hand.

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { Pencil, Sparkles } from 'lucide-react';

export function RecallQuestions({ problem }: { problem: { id: string; recallQuestions?: string[] | null } }) {
  const { mutate } = useSWRConfig();
  const [questions, setQuestions] = useState<string[]>(Array.isArray(problem.recallQuestions) ? problem.recallQuestions : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const fieldId = `rq-${problem.id}`;

  const refreshCaches = () =>
    mutate(
      (key: unknown) =>
        typeof key === 'string' && (key.startsWith('/api/daily') || key.startsWith('/api/problems') || key === '/api/concepts'),
      undefined,
      { revalidate: true },
    );

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/problems/${problem.id}/questions`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 503 && json.code === 'AI_NOT_CONFIGURED') {
        setUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Could not generate questions');
      setQuestions(json.questions);
      refreshCaches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate questions');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/problems/${problem.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: draft.split('\n') }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not save');
      setQuestions(json.questions);
      setEditing(false);
      refreshCaches();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const startEditing = (text: string) => {
    setDraft(text);
    setEditing(true);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div onClick={stop} onKeyDown={stop} className="mb-4 text-[14px] text-foreground">
      {editing ? (
        <div className="grid gap-2">
          <label htmlFor={fieldId} className="label mb-0">
            One question per line (up to 5)
          </label>
          <textarea
            id={fieldId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="field"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : questions.length > 0 ? (
        <>
          <p className="label">Answer these from memory</p>
          <ol className="flex flex-col gap-1.5">
            {questions.map((q, i) => (
              <li key={q} className="flex gap-3 leading-relaxed">
                <span aria-hidden className="w-5 shrink-0 pt-px font-mono text-[12px] text-ember">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-1">
            {!unavailable && (
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="btn btn-ghost btn-sm"
                aria-label="Regenerate recall questions with AI"
              >
                <Sparkles size={13} strokeWidth={1.75} aria-hidden /> {busy ? 'Generating…' : 'Regenerate'}
              </button>
            )}
            <button
              type="button"
              onClick={() => startEditing(questions.join('\n'))}
              className="btn btn-ghost btn-sm"
              aria-label="Edit recall questions"
            >
              <Pencil size={13} strokeWidth={1.75} aria-hidden /> Edit
            </button>
          </div>
        </>
      ) : unavailable ? (
        <p className="text-[13px] text-muted-foreground">
          AI questions aren&apos;t set up on this server (add ANTHROPIC_API_KEY).{' '}
          <button type="button" onClick={() => startEditing('')} className="link-underline text-foreground">
            Write your own
          </button>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generate} disabled={busy} className="btn btn-outline btn-sm">
            <Sparkles size={13} strokeWidth={1.75} aria-hidden className="text-ember" />
            {busy ? 'Generating questions…' : 'Generate recall questions with AI'}
          </button>
          <button type="button" onClick={() => startEditing('')} className="btn btn-ghost btn-sm">
            <Pencil size={13} strokeWidth={1.75} aria-hidden /> Write your own
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
