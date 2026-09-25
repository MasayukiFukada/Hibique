import { RoutineTask } from './types';

export const initialTasks: RoutineTask[] = [
  // ── Daily (毎日) ──
  {
    id: 'task-1',
    title: '筋トレ・ストレッチ',
    span: 'daily',
    isCompleted: false,
    tags: ['健康'],
  },
  {
    id: 'task-2',
    title: '日記を書く (3行メモ)',
    span: 'daily',
    isCompleted: true,
    completedAt: new Date().toISOString(),
    tags: ['習慣'],
  },
  {
    id: 'task-3',
    title: 'RSSフィード・Techニュース巡回',
    span: 'daily',
    isCompleted: true,
    completedAt: new Date().toISOString(),
    tags: ['情報収集'],
  },

  // ── Weekly: 今週いつでも (Anytime) ──
  {
    id: 'task-5',
    title: '部屋全体の掃除機がけ',
    span: 'weekly',
    weeklyType: 'anytime',
    isCompleted: false,
    tags: ['家事'],
  },
  {
    id: 'task-6',
    title: '爪を切る',
    span: 'weekly',
    weeklyType: 'anytime',
    isCompleted: true,
    completedAt: new Date().toISOString(),
    tags: ['セルフケア'],
  },
  {
    id: 'task-11',
    title: '今週の録画アニメ一気見',
    span: 'weekly',
    weeklyType: 'anytime',
    isCompleted: false,
    tags: ['アニメ'],
  },

  // ── Weekly: 曜日指定 (Day of Week) ──
  {
    id: 'task-4',
    title: '週刊少年ジャンプ最新話',
    span: 'weekly',
    weeklyType: 'day_of_week',
    daysOfWeek: [1], // 月曜
    isCompleted: false,
    tags: ['漫画'],
  },
  {
    id: 'task-12',
    title: '週刊少年サンデー最新話',
    span: 'weekly',
    weeklyType: 'day_of_week',
    daysOfWeek: [3], // 水曜
    isCompleted: false,
    tags: ['漫画'],
  },
  {
    id: 'task-13',
    title: '深夜アニメリアタイ視聴',
    span: 'weekly',
    weeklyType: 'day_of_week',
    daysOfWeek: [5], // 金曜
    isCompleted: false,
    tags: ['アニメ'],
  },
  {
    id: 'task-9',
    title: '資源ゴミ・ダンボールまとめ',
    span: 'weekly',
    weeklyType: 'day_of_week',
    daysOfWeek: [3], // 水
    isCompleted: true,
    completedAt: new Date().toISOString(),
    tags: ['家事'],
  },
  {
    id: 'task-10',
    title: 'シーツ・枕カバーの洗濯',
    span: 'weekly',
    weeklyType: 'day_of_week',
    daysOfWeek: [6, 0], // 土・日
    isCompleted: false,
    tags: ['家事'],
  },

  // ── Monthly (毎月) ──
  {
    id: 'task-7',
    title: 'サブスクの整理・クレカ明細チェック',
    span: 'monthly',
    monthlyDay: 25, // 毎月25日（今日！）
    isCompleted: false,
    tags: ['お金'],
  },
  {
    id: 'task-14',
    title: '家賃・光熱費の振込確認',
    span: 'monthly',
    monthlyDay: 27, // 毎月27日（あと2日！）
    isCompleted: false,
    tags: ['お金'],
  },
  {
    id: 'task-8',
    title: 'バックアップの整合性確認',
    span: 'monthly',
    isCompleted: false,
    tags: ['メンテ'],
  },
];
