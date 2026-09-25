import { RoutineTask, AppSettings } from '../types';

export interface ResetState {
  lastDailyDate: string; // YYYY-MM-DD (論理日)
  lastWeeklyStart: string; // YYYY-MM-DD (論理週の月曜日)
  lastMonthlyKey: string; // YYYY-MM (論理月)
}

/**
 * リセット時刻（デフォルト深夜4:00）を考慮した論理日時を返す
 * 例: 2026-09-26 02:00 -> 4時間前 = 2026-09-25 22:00（論理日は2026-09-25）
 */
export function getLogicalDate(now: Date = new Date(), resetHour: number = 4): Date {
  const logical = new Date(now.getTime() - resetHour * 60 * 60 * 1000);
  return logical;
}

/**
 * 論理日の YYYY-MM-DD 文字列を取得
 */
export function getLogicalDateString(logicalDate: Date): string {
  const y = logicalDate.getFullYear();
  const m = String(logicalDate.getMonth() + 1).padStart(2, '0');
  const d = String(logicalDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 論理週の月曜日の YYYY-MM-DD 文字列を取得 (月曜始まり)
 */
export function getLogicalWeekStart(logicalDate: Date): string {
  const d = new Date(logicalDate.getFullYear(), logicalDate.getMonth(), logicalDate.getDate());
  const day = d.getDay(); // 0: 日, 1: 月, ..., 6: 土
  const diffToMonday = day === 0 ? -6 : 1 - day; // 日曜なら6日前、それ以外は 1 - day
  d.setDate(d.getDate() + diffToMonday);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

/**
 * 論理月の YYYY-MM 文字列を取得
 */
export function getLogicalMonthKey(logicalDate: Date): string {
  const y = logicalDate.getFullYear();
  const m = String(logicalDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * 現在時刻から最新の ResetState を生成
 */
export function getCurrentResetState(now: Date = new Date(), resetHour: number = 4): ResetState {
  const logical = getLogicalDate(now, resetHour);
  return {
    lastDailyDate: getLogicalDateString(logical),
    lastWeeklyStart: getLogicalWeekStart(logical),
    lastMonthlyKey: getLogicalMonthKey(logical),
  };
}

export interface ResetEvaluationResult {
  updatedTasks: RoutineTask[];
  newResetState: ResetState;
  hasChanged: boolean;
  dailyReset: boolean;
  weeklyReset: boolean;
  monthlyReset: boolean;
}

/**
 * 起動時やフォーカス時に前回の ResetState と現在時刻を比較し、
 * 必要に応じて各タスクを未完了へリセットする純粋関数
 */
export function evaluateTaskResets(
  tasks: RoutineTask[],
  settings: AppSettings,
  lastState?: ResetState | null,
  now: Date = new Date()
): ResetEvaluationResult {
  const currentState = getCurrentResetState(now, settings.dayResetHour ?? 4);

  // 初回起動時（前回の記録がない場合）は現在の状態をセットしてリセットはしない
  if (!lastState) {
    return {
      updatedTasks: tasks,
      newResetState: currentState,
      hasChanged: false,
      dailyReset: false,
      weeklyReset: false,
      monthlyReset: false,
    };
  }

  const dailyReset = lastState.lastDailyDate !== currentState.lastDailyDate;
  const weeklyReset = lastState.lastWeeklyStart !== currentState.lastWeeklyStart;
  const monthlyReset = lastState.lastMonthlyKey !== currentState.lastMonthlyKey;

  if (!dailyReset && !weeklyReset && !monthlyReset) {
    return {
      updatedTasks: tasks,
      newResetState: lastState,
      hasChanged: false,
      dailyReset: false,
      weeklyReset: false,
      monthlyReset: false,
    };
  }

  const updatedTasks = tasks.map((task) => {
    let shouldReset = false;

    if (dailyReset && task.span === 'daily') {
      shouldReset = true;
    }
    if (weeklyReset && task.span === 'weekly') {
      shouldReset = true;
    }
    if (monthlyReset && task.span === 'monthly') {
      shouldReset = true;
    }

    if (shouldReset && task.isCompleted) {
      return {
        ...task,
        isCompleted: false,
        completedAt: null,
      };
    }
    return task;
  });

  return {
    updatedTasks,
    newResetState: currentState,
    hasChanged: true,
    dailyReset,
    weeklyReset,
    monthlyReset,
  };
}
