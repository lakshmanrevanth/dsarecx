import type { StudyItemWithFlags } from '@/lib/study';

export type LearnedEntry = {
  id: string;
  title: string;
  platform: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  url: string;
  dateSolved: string;
  createdAt: string;
};

export type DueEntry = {
  id: string;
  title: string;
  platform: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  isOverdue: boolean;
  daysOverdue: number;
};

/** GET /api/today */
export type TodayData = {
  today: string;
  timezone: string;
  learned: { dsa: LearnedEntry[]; systemDesign: LearnedEntry[] };
  revisedCount: number;
  due: { count: number; items: DueEntry[] };
  toLearn: StudyItemWithFlags[];
  streak: { currentStreak: number; bestStreak: number; todayReviewed: number; dailyGoal: number; goalMet: boolean };
};

export type KindFilter = 'ALL' | 'DSA' | 'SYSTEM_DESIGN';
