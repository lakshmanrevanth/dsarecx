// Pure builders for GET/POST /api/export: the JSON backup (v2) and the CSV export.

import { siteConfig } from '@/config/site';
import { EXPORT_CSV_HEADERS } from '@/lib/import-utils';
import { readCustomFields, toCustomColumn } from '@/lib/custom-columns';
import type { StudyItemDto } from '@/lib/study';

export const BACKUP_VERSION = 2;

export type ExportProblemRow = {
  platform: string;
  problemNumber: number;
  code: string | null;
  title: string;
  url: string;
  difficulty: string;
  topic: string;
  tags: string[];
  dateSolved: Date;
  notes: string | null;
  customFields: unknown;
  isFavorite: boolean;
  status: string;
  currentStep: number;
  nextRevisionAt: Date;
  revisionCount: number;
  createdAt: Date;
  lists: { name: string }[];
  revisions: {
    revisedAt: Date;
    confidence: string;
    type: string;
    stepBefore: number;
    stepAfter: number;
  }[];
};

export type ExportColumnRow = { id: string; name: string; type: string; options: unknown; order: number };

/** Cells starting with = + - @ tab or CR get a leading ' so spreadsheets don't evaluate them. */
export function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One RFC 4180 CSV cell, formula-guarded and quoted when needed. */
export function csvCell(value: unknown): string {
  const text = guardFormula(value === null || value === undefined ? '' : String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

/** Values for EXPORT_CSV_HEADERS, keyed by their `field`. */
function csvValues(p: ExportProblemRow): Record<string, unknown> {
  return {
    title: p.title,
    platform: p.platform,
    problemNumber: p.problemNumber,
    code: p.code ?? '',
    difficulty: p.difficulty,
    topic: p.topic,
    tags: p.tags.join('; '),
    url: p.url === '#' ? '' : p.url,
    dateSolved: dayKey(p.dateSolved),
    notes: p.notes ?? '',
    status: p.status,
    currentStep: p.currentStep,
    nextRevisionAt: dayKey(p.nextRevisionAt),
    revisionCount: p.revisionCount,
    isFavorite: p.isFavorite ? 'yes' : '',
    lists: names(p.lists).join('; '),
  };
}

export function buildCsv(problems: ExportProblemRow[], columns: ExportColumnRow[]): string {
  const customNames = [...columns].sort((a, b) => a.order - b.order).map((c) => c.name);
  const rows: unknown[][] = [[...EXPORT_CSV_HEADERS.map((h) => h.header), ...customNames]];
  for (const p of problems) {
    const values = csvValues(p);
    const custom = readCustomFields(p.customFields);
    rows.push([...EXPORT_CSV_HEADERS.map((h) => values[h.field]), ...customNames.map((n) => custom[n] ?? '')]);
  }
  // Leading BOM so Excel opens the file as UTF-8.
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function buildBackup(input: {
  user: { name: string | null; email: string } | null;
  preferences: Record<string, unknown>;
  columns: ExportColumnRow[];
  lists: { name: string }[];
  problems: ExportProblemRow[];
  streakLogs: { date: Date; completed: boolean }[];
  /** The to-learn list (empty for a partial export). */
  studyItems?: StudyItemDto[];
  partial: boolean;
  now?: Date;
}) {
  return {
    version: BACKUP_VERSION,
    app: siteConfig.name,
    exportedAt: (input.now ?? new Date()).toISOString(),
    partial: input.partial,
    user: input.user,
    preferences: input.preferences,
    columns: input.columns.map((row) => {
      const { name, type, options, order } = toCustomColumn(row);
      return { name, type, options, order };
    }),
    lists: names(input.lists),
    totalProblems: input.problems.length,
    problems: input.problems.map((p) => ({
      platform: p.platform,
      problemNumber: p.problemNumber,
      code: p.code,
      title: p.title,
      url: p.url,
      difficulty: p.difficulty,
      topic: p.topic,
      tags: p.tags,
      dateSolved: p.dateSolved.toISOString(),
      notes: p.notes,
      customFields: readCustomFields(p.customFields),
      isFavorite: p.isFavorite,
      status: p.status,
      currentStep: p.currentStep,
      nextRevisionAt: p.nextRevisionAt.toISOString(),
      revisionCount: p.revisionCount,
      createdAt: p.createdAt.toISOString(),
      lists: names(p.lists),
      revisions: p.revisions.map((r) => ({
        revisedAt: r.revisedAt.toISOString(),
        confidence: r.confidence,
        type: r.type,
        stepBefore: r.stepBefore,
        stepAfter: r.stepAfter,
      })),
    })),
    streakLogs: input.streakLogs.map((s) => ({ date: dayKey(s.date), completed: s.completed })),
    studyItems: (input.studyItems ?? []).map((s) => ({
      kind: s.kind,
      title: s.title,
      url: s.url,
      platform: s.platform,
      identifier: s.identifier,
      difficulty: s.difficulty,
      topic: s.topic,
      note: s.note,
      targetDate: s.targetDate,
      order: s.order,
      createdAt: s.createdAt,
    })),
  };
}
