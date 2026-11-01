export type TaskSpan = 'daily' | 'weekly' | 'monthly';

export interface RoutineTask {
  id: string;
  title: string;
  span: TaskSpan;
  weeklyType?: 'anytime' | 'day_of_week'; // 週間タスクの種別
  daysOfWeek?: number[]; // 0: Sun, 1: Mon, ..., 6: Sat (Dailyの実行曜日指定、またはWeeklyの曜日指定)
  monthlyDay?: number; // 月次タスクの目安日付 (1〜31日)
  isCompleted: boolean;
  completedAt?: string | null;
  category?: string;
  tags?: string[];
  url?: string; // 巡回先URL (任意)
  deadline?: string; // 終了期日・目標日 (YYYY-MM-DD, 任意)
}

export interface AppSettings {
  dayResetHour: number; // e.g. 4 (4:00 AM)
}
