import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Sun,
  CalendarDays,
  Plus,
  Sparkles,
  Trash2,
  X,
  ChevronRight,
  Inbox,
  CheckCheck,
  Database,
  Tag,
  Pencil,
  Link as LinkIcon,
} from 'lucide-react';
import { RoutineTask, TaskSpan, AppSettings } from './types';
import { db, initializeDatabase, persistDatabase, DatabaseSchema } from './services/db';
import { evaluateTaskResets, getLogicalDate } from './services/resetLogic';
import { getDeadlineStatus, sanitizeUrl, openExternalUrl } from './services/deadline';
import {
  KeyboardSelection,
  TaskColumns,
  moveVertical,
  moveColumn,
  getNextSelectionAfterToggle,
  resolveSelectionAfterListChange,
  isEditableElement,
} from './services/keyboardNavigation';
import { ProgressIndicator } from './components/ProgressIndicator';
import { TodayCompletionCard } from './components/TodayCompletionCard';

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
// 月曜スタート (1: 月, 2: 火, 3: 水, 4: 木, 5: 金, 6: 土, 0: 日)
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

// 月曜起点インデックス (0: 月, 1: 火, 2: 水, 3: 木, 4: 金, 5: 土, 6: 日)
export const getDayWeekIndex = (day: number): number => {
  return day === 0 ? 6 : day - 1;
};

// 曜日ごとの7色カラー定義 (Solarized Light に調和するカラーパレット)
export const DAY_COLORS: Record<
  number,
  { label: string; badge: string; activeBadge: string; border: string; buttonBg: string }
> = {
  1: {
    // 月: バイオレット (月夜)
    label: '月',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    activeBadge: 'bg-violet-600 text-white border-violet-600 font-bold shadow-xs',
    border: 'border-violet-300',
    buttonBg: 'bg-violet-600 text-white',
  },
  2: {
    // 火: レッド/コーラル (火・情熱)
    label: '火',
    badge: 'bg-red-100 text-red-700 border-red-200',
    activeBadge: 'bg-red-600 text-white border-red-600 font-bold shadow-xs',
    border: 'border-red-300',
    buttonBg: 'bg-red-600 text-white',
  },
  3: {
    // 水: シアン/アクア (水・清涼)
    label: '水',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    activeBadge: 'bg-cyan-600 text-white border-cyan-600 font-bold shadow-xs',
    border: 'border-cyan-300',
    buttonBg: 'bg-cyan-600 text-white',
  },
  4: {
    // 木: グリーン (木・自然)
    label: '木',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeBadge: 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs',
    border: 'border-emerald-300',
    buttonBg: 'bg-emerald-600 text-white',
  },
  5: {
    // 金: アンバー/ゴールド (金・華やかさ)
    label: '金',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    activeBadge: 'bg-amber-500 text-white border-amber-500 font-bold shadow-xs',
    border: 'border-amber-300',
    buttonBg: 'bg-amber-500 text-white',
  },
  6: {
    // 土: オレンジ/テラコッタ (土・大地)
    label: '土',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    activeBadge: 'bg-orange-500 text-white border-orange-500 font-bold shadow-xs',
    border: 'border-orange-300',
    buttonBg: 'bg-orange-500 text-white',
  },
  0: {
    // 日: ローズ/マゼンタ (太陽・休日)
    label: '日',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
    activeBadge: 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs',
    border: 'border-rose-300',
    buttonBg: 'bg-rose-600 text-white',
  },
};

// タグ別のスタイル
const getTagBadgeClass = (tag: string) => {
  switch (tag) {
    case 'アニメ':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case '漫画':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case '家事':
      return 'bg-stone-100 text-stone-700 border-stone-200';
    case '健康':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case '習慣':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case '情報収集':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    default:
      return 'bg-yellow-50 text-stone-600 border-stone-200';
  }
};

const PRESET_TAGS = ['アニメ', '漫画', '家事', '健康', '習慣', '情報収集', 'お金', 'メンテ'];

// 月次タスクの近づいたら目立つステータス判定
export const getMonthlyStatus = (monthlyDay: number | undefined, currentDay: number) => {
  if (!monthlyDay) return null;
  const diff = monthlyDay - currentDay;

  if (diff === 0) {
    return {
      type: 'today',
      label: '本日目安！',
      badgeClass: 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs animate-pulse',
      borderClass: 'border-rose-400 ring-2 ring-rose-400/40 bg-rose-50/60 shadow-xs',
      textClass: 'text-rose-950 font-bold',
    };
  }
  if (diff > 0 && diff <= 3) {
    return {
      type: 'approaching',
      label: `あと ${diff} 日 (${monthlyDay}日)`,
      badgeClass: 'bg-amber-500 text-white font-bold border-amber-500 shadow-2xs',
      borderClass: 'border-amber-400 ring-1 ring-amber-400/30 bg-amber-50/50',
      textClass: 'text-amber-950 font-bold',
    };
  }
  if (diff < 0) {
    return {
      type: 'passed',
      label: `${monthlyDay}日目安 (経過)`,
      badgeClass: 'bg-stone-200 text-stone-600 border-stone-300',
      borderClass: 'border-stone-300/80 bg-stone-50/30',
      textClass: 'text-stone-700',
    };
  }
  // 4日以上先
  return {
    type: 'upcoming',
    label: `毎月 ${monthlyDay} 日`,
    badgeClass: 'bg-[#eee8d5] text-[#268bd2] border-[#dcd3bc]',
    borderClass: 'border-[#e6deca]',
    textClass: 'text-[#073642]',
  };
};

export default function App() {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ dayResetHour: 4 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isDoneDragOver, setIsDoneDragOver] = useState(false);
  const [isTodoDragOver, setIsTodoDragOver] = useState(false);

  // 新規タスクフォーム用ステート
  const [newTitle, setNewTitle] = useState('');
  const [newSpan, setNewSpan] = useState<TaskSpan>('daily');
  const [newWeeklyType, setNewWeeklyType] = useState<'anytime' | 'day_of_week'>('anytime');
  const [newSelectedDays, setNewSelectedDays] = useState<number[]>([1]); // デフォルト月曜
  const [newMonthlyDay, setNewMonthlyDay] = useState<string>(''); // 月次タスクの目安日
  const [newTags, setNewTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);
  const [keyboardSelection, setKeyboardSelection] = useState<KeyboardSelection>({
    column: 'todo',
    taskId: null,
  });
  const [lastToggledTaskId, setLastToggledTaskId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const spacePressedRef = useRef(false);

  const setCardRef = (id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
    } else {
      cardRefs.current.delete(id);
    }
  };

  // 自動リセット評価（起動時 ＆ ウィンドウフォーカス時）
  const checkResets = (currentData: DatabaseSchema) => {
    const result = evaluateTaskResets(
      currentData.tasks,
      currentData.settings,
      currentData.resetState
    );
    if (result.hasChanged) {
      currentData.tasks = result.updatedTasks;
      currentData.resetState = result.newResetState;
      persistDatabase();
      setTasks(result.updatedTasks);
    } else {
      if (!currentData.resetState) {
        currentData.resetState = result.newResetState;
        persistDatabase();
      }
      setTasks(currentData.tasks);
    }
  };

  // Lowdb 初期化 ＆ ウィンドウフォーカス時の自動リセット監視
  useEffect(() => {
    initializeDatabase().then((data) => {
      if (data.settings) {
        setSettings(data.settings);
      }
      checkResets(data);
      setIsLoaded(true);
    });

    const handleFocus = () => {
      if (db.data) {
        checkResets(db.data);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 論理日付 & 曜日 (設定のリセット時刻を考慮: 例 深夜4:00までは前日夜扱い)
  const logicalDate = useMemo(() => {
    return getLogicalDate(new Date(), settings.dayResetHour);
  }, [settings.dayResetHour]);

  const currentDayOfWeek = logicalDate.getDay();
  const currentDayOfMonth = logicalDate.getDate();
  const dateStr = logicalDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const logicalDateStr = useMemo(() => {
    const y = logicalDate.getFullYear();
    const m = String(logicalDate.getMonth() + 1).padStart(2, '0');
    const d = String(logicalDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [logicalDate]);

  // タスクの分類
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.isCompleted),
    [tasks]
  );
  // Daily：本日該当分（daysOfWeek未指定・全曜日、または本日曜日を含む）
  const uncompletedDailyToday = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isCompleted &&
          t.span === 'daily' &&
          (!t.daysOfWeek || t.daysOfWeek.length === 0 || t.daysOfWeek.includes(currentDayOfWeek))
      ),
    [tasks, currentDayOfWeek]
  );
  // Daily：他曜日控え分（daysOfWeekが指定されており、本日曜日を含まない）
  const uncompletedDailyOtherDays = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isCompleted &&
          t.span === 'daily' &&
          t.daysOfWeek &&
          t.daysOfWeek.length > 0 &&
          !t.daysOfWeek.includes(currentDayOfWeek)
      ),
    [tasks, currentDayOfWeek]
  );
  // 週間：今週いつでも
  const uncompletedWeeklyAnytime = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isCompleted &&
          t.span === 'weekly' &&
          (t.weeklyType === 'anytime' || !t.daysOfWeek || t.daysOfWeek.length === 0)
      ),
    [tasks]
  );
  // 週間：曜日指定（未消化・過去の曜日）
  const uncompletedWeeklyOverdue = useMemo(() => {
    const currentIdx = getDayWeekIndex(currentDayOfWeek);
    return tasks
      .filter(
        (t) =>
          !t.isCompleted &&
          t.span === 'weekly' &&
          t.weeklyType === 'day_of_week' &&
          t.daysOfWeek &&
          t.daysOfWeek.length > 0 &&
          !t.daysOfWeek.includes(currentDayOfWeek) &&
          t.daysOfWeek.some((d) => getDayWeekIndex(d) < currentIdx)
      )
      .sort((a, b) => {
        const minA = Math.min(...(a.daysOfWeek || []).map(getDayWeekIndex));
        const minB = Math.min(...(b.daysOfWeek || []).map(getDayWeekIndex));
        return minA - minB;
      });
  }, [tasks, currentDayOfWeek]);

  // 週間：曜日指定（本日該当分）
  const uncompletedWeeklyToday = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isCompleted &&
          t.span === 'weekly' &&
          t.weeklyType === 'day_of_week' &&
          t.daysOfWeek?.includes(currentDayOfWeek)
      ),
    [tasks, currentDayOfWeek]
  );

  // 週間：今週消化するタスク（未消化 → 本日 → いつでも）
  const uncompletedWeeklyActive = useMemo(
    () => [
      ...uncompletedWeeklyOverdue,
      ...uncompletedWeeklyToday,
      ...uncompletedWeeklyAnytime,
    ],
    [uncompletedWeeklyOverdue, uncompletedWeeklyToday, uncompletedWeeklyAnytime]
  );

  // 週間：曜日指定（他曜日・明日以降の未来曜日控え）
  const uncompletedWeeklyUpcoming = useMemo(() => {
    const currentIdx = getDayWeekIndex(currentDayOfWeek);
    return tasks
      .filter(
        (t) =>
          !t.isCompleted &&
          t.span === 'weekly' &&
          t.weeklyType === 'day_of_week' &&
          t.daysOfWeek &&
          t.daysOfWeek.length > 0 &&
          !t.daysOfWeek.includes(currentDayOfWeek) &&
          t.daysOfWeek.every((d) => getDayWeekIndex(d) > currentIdx)
      )
      .sort((a, b) => {
        const minA = Math.min(...(a.daysOfWeek || []).map(getDayWeekIndex));
        const minB = Math.min(...(b.daysOfWeek || []).map(getDayWeekIndex));
        return minA - minB;
      });
  }, [tasks, currentDayOfWeek]);
  const uncompletedMonthly = useMemo(
    () => tasks.filter((t) => !t.isCompleted && t.span === 'monthly'),
    [tasks]
  );

  // キーボード操作用の表示順IDリスト
  const todoTaskIds = useMemo(
    () =>
      [
        ...uncompletedDailyToday,
        ...uncompletedDailyOtherDays,
        ...uncompletedWeeklyActive,
        ...uncompletedWeeklyUpcoming,
        ...uncompletedMonthly,
      ].map((t) => t.id),
    [
      uncompletedDailyToday,
      uncompletedDailyOtherDays,
      uncompletedWeeklyActive,
      uncompletedWeeklyUpcoming,
      uncompletedMonthly,
    ]
  );

  const doneTaskIds = useMemo(() => completedTasks.map((t) => t.id), [completedTasks]);

  const taskColumns = useMemo<TaskColumns>(
    () => ({ todoIds: todoTaskIds, doneIds: doneTaskIds }),
    [todoTaskIds, doneTaskIds]
  );

  // リスト変化時に存在しない選択IDを正規化
  useEffect(() => {
    setKeyboardSelection((prev) => {
      const next = resolveSelectionAfterListChange(prev, taskColumns);
      if (next.column === prev.column && next.taskId === prev.taskId) {
        return prev;
      }
      return next;
    });
  }, [taskColumns]);

  // 選択中タスクへの自動スクロール追従
  useEffect(() => {
    if (!keyboardSelection.taskId) return;
    const el = cardRefs.current.get(keyboardSelection.taskId);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [keyboardSelection.taskId]);

  // 本日のノルマ対象タスク（本日該当のDaily ＋ 今日の曜日に該当する曜日指定Weeklyタスク）
  const todayTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.span === 'daily') {
          return (
            !t.daysOfWeek ||
            t.daysOfWeek.length === 0 ||
            t.daysOfWeek.includes(currentDayOfWeek)
          );
        }
        if (
          t.span === 'weekly' &&
          t.weeklyType === 'day_of_week' &&
          t.daysOfWeek?.includes(currentDayOfWeek)
        ) {
          return true;
        }
        return false;
      }),
    [tasks, currentDayOfWeek]
  );

  const todayTotal = todayTasks.length;
  const todayDone = todayTasks.filter((t) => t.isCompleted).length;
  const progressPercent = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 100;
  const isTodayAllDone = todayTotal > 0 && todayDone === todayTotal;

  // タスク更新＆Lowdbへの自動永続化
  const syncTasks = async (nextTasks: RoutineTask[]) => {
    setTasks(nextTasks);
    if (db.data) {
      db.data.tasks = nextTasks;
      await persistDatabase();
    }
  };

  // タスクのトグル（完了・未完了切り替え）
  const toggleTask = (
    id: string,
    options?: { fromKeyboard?: boolean; isUndo?: boolean }
  ) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;

    const nextIsCompleted = !target.isCompleted;
    const updated = tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            isCompleted: nextIsCompleted,
            completedAt: nextIsCompleted ? new Date().toISOString() : null,
          }
        : t
    );

    if (options?.isUndo) {
      setLastToggledTaskId(null);
      setKeyboardSelection({
        column: nextIsCompleted ? 'done' : 'todo',
        taskId: id,
      });
    } else {
      setLastToggledTaskId(id);
      if (options?.fromKeyboard || keyboardSelection.taskId === id) {
        setKeyboardSelection((prev) => getNextSelectionAfterToggle(prev, taskColumns, id));
      }
    }

    syncTasks(updated);
  };

  // グローバルキーボードナビゲーション・タスク消化ショートカット
  useEffect(() => {
    if (!isLoaded) return;

    const blurActiveElement = () => {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
      ) {
        document.activeElement.blur();
      }
    };

    const activateCurrentOrSelectFirst = () => {
      if (keyboardSelection.taskId) {
        toggleTask(keyboardSelection.taskId, { fromKeyboard: true });
      } else {
        setKeyboardSelection((prev) => moveVertical(prev, taskColumns, 1));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAddModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsAddModalOpen(false);
          setEditingTask(null);
        }
        return;
      }

      if (e.isComposing || isEditableElement(e.target)) {
        return;
      }

      const lowerKey = e.key.toLowerCase();
      const isCtrlOrMetaZ =
        (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && lowerKey === 'z';
      const isPlainU =
        !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && lowerKey === 'u';

      if (isCtrlOrMetaZ || isPlainU) {
        if (lastToggledTaskId && tasks.some((t) => t.id === lastToggledTaskId)) {
          e.preventDefault();
          toggleTask(lastToggledTaskId, { isUndo: true });
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key === 'ArrowDown' || (!e.shiftKey && lowerKey === 'j')) {
        e.preventDefault();
        blurActiveElement();
        setKeyboardSelection((prev) => moveVertical(prev, taskColumns, 1));
        return;
      }

      if (e.key === 'ArrowUp' || (!e.shiftKey && lowerKey === 'k')) {
        e.preventDefault();
        blurActiveElement();
        setKeyboardSelection((prev) => moveVertical(prev, taskColumns, -1));
        return;
      }

      if (e.key === 'ArrowRight' || (!e.shiftKey && lowerKey === 'l')) {
        e.preventDefault();
        blurActiveElement();
        setKeyboardSelection((prev) => moveColumn(prev, taskColumns, 'done'));
        return;
      }

      if (e.key === 'ArrowLeft' || (!e.shiftKey && lowerKey === 'h')) {
        e.preventDefault();
        blurActiveElement();
        setKeyboardSelection((prev) => moveColumn(prev, taskColumns, 'todo'));
        return;
      }

      const isInteractiveTarget =
        e.target instanceof Element && Boolean(e.target.closest('button, a'));

      if (e.key === 'Enter') {
        if (isInteractiveTarget || e.repeat) return;
        e.preventDefault();
        activateCurrentOrSelectFirst();
        return;
      }

      if (e.key === ' ') {
        if (isInteractiveTarget) return;
        e.preventDefault();
        if (!e.repeat) {
          spacePressedRef.current = true;
        }
        return;
      }

      if (!e.shiftKey && lowerKey === 'o') {
        if (isInteractiveTarget) return;
        if (keyboardSelection.taskId) {
          const selectedTask = tasks.find((t) => t.id === keyboardSelection.taskId);
          if (selectedTask?.url) {
            e.preventDefault();
            openExternalUrl(selectedTask.url);
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (keyboardSelection.taskId !== null) {
          e.preventDefault();
          setKeyboardSelection((prev) => ({ ...prev, taskId: null }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isAddModalOpen) {
        spacePressedRef.current = false;
        return;
      }

      if (e.key === ' ' && spacePressedRef.current) {
        spacePressedRef.current = false;
        if (e.isComposing || isEditableElement(e.target)) return;
        if (e.target instanceof Element && e.target.closest('button, a')) return;
        e.preventDefault();
        activateCurrentOrSelectFirst();
      }
    };

    const handleWindowBlur = () => {
      spacePressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isLoaded, isAddModalOpen, keyboardSelection, taskColumns, tasks, lastToggledTaskId]);

  // タスク削除
  const deleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = tasks.filter((t) => t.id !== id);
    syncTasks(updated);
  };

  // モーダルを開く（新規作成）
  const openAddModal = () => {
    setEditingTask(null);
    setNewTitle('');
    setNewSpan('daily');
    setNewWeeklyType('anytime');
    setNewSelectedDays([1, 2, 3, 4, 5, 6, 0]); // デフォルト全曜日
    setNewMonthlyDay('');
    setNewTags([]);
    setCustomTagInput('');
    setNewUrl('');
    setNewDeadline('');
    setIsAddModalOpen(true);
  };

  // モーダルを開く（編集）
  const openEditModal = (task: RoutineTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setNewTitle(task.title);
    setNewSpan(task.span);
    setNewWeeklyType(task.weeklyType || 'anytime');
    setNewSelectedDays(
      task.daysOfWeek && task.daysOfWeek.length > 0
        ? [...task.daysOfWeek]
        : task.span === 'daily'
        ? [1, 2, 3, 4, 5, 6, 0]
        : [1]
    );
    setNewMonthlyDay(task.monthlyDay ? String(task.monthlyDay) : '');
    setNewTags(task.tags ? [...task.tags] : []);
    setCustomTagInput('');
    setNewUrl(task.url || '');
    setNewDeadline(task.deadline || '');
    setIsAddModalOpen(true);
  };

  // タスク保存（新規・編集両対応）
  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // カスタムタグの追加
    const finalTags = [...newTags];
    if (customTagInput.trim() && !finalTags.includes(customTagInput.trim())) {
      finalTags.push(customTagInput.trim());
    }

    const parsedMonthlyDay =
      newSpan === 'monthly' && newMonthlyDay.trim()
        ? Math.min(31, Math.max(1, parseInt(newMonthlyDay.trim(), 10)))
        : undefined;

    const parsedDaysOfWeek =
      newSpan === 'daily'
        ? newSelectedDays.length === 7 || newSelectedDays.length === 0
          ? undefined
          : [...newSelectedDays].sort()
        : newSpan === 'weekly' && newWeeklyType === 'day_of_week'
        ? [...newSelectedDays].sort()
        : undefined;

    const sanitizedUrl = sanitizeUrl(newUrl);
    const sanitizedDeadline = newDeadline.trim() || undefined;

    if (editingTask) {
      // 既存タスクの更新
      const updated = tasks.map((t) => {
        if (t.id === editingTask.id) {
          return {
            ...t,
            title: newTitle.trim(),
            span: newSpan,
            weeklyType: newSpan === 'weekly' ? newWeeklyType : undefined,
            daysOfWeek: parsedDaysOfWeek,
            monthlyDay: parsedMonthlyDay,
            tags: finalTags.length > 0 ? finalTags : undefined,
            url: sanitizedUrl,
            deadline: sanitizedDeadline,
          };
        }
        return t;
      });
      syncTasks(updated);
    } else {
      // 新規タスクの追加
      const newTask: RoutineTask = {
        id: `task-${Date.now()}`,
        title: newTitle.trim(),
        span: newSpan,
        weeklyType: newSpan === 'weekly' ? newWeeklyType : undefined,
        daysOfWeek: parsedDaysOfWeek,
        monthlyDay: parsedMonthlyDay,
        tags: finalTags.length > 0 ? finalTags : undefined,
        url: sanitizedUrl,
        deadline: sanitizedDeadline,
        isCompleted: false,
      };
      syncTasks([newTask, ...tasks]);
    }

    setIsAddModalOpen(false);
    setEditingTask(null);
  };

  // 曜日選択トグル
  const toggleDaySelection = (day: number) => {
    setNewSelectedDays((prev) =>
      prev.includes(day)
        ? prev.length > 1
          ? prev.filter((d) => d !== day)
          : prev
        : [...prev, day]
    );
  };

  // タグトグル
  const toggleTagSelection = (tag: string) => {
    setNewTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };


  // Drag & Drop ハンドラ
  const handleDragStart = (id: string) => {
    setDraggedTaskId(id);
  };

  const handleDropOnDone = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDoneDragOver(false);
    if (!draggedTaskId) return;

    const updated = tasks.map((t) =>
      t.id === draggedTaskId
        ? { ...t, isCompleted: true, completedAt: new Date().toISOString() }
        : t
    );
    syncTasks(updated);
    setDraggedTaskId(null);
  };

  const handleDropOnTodo = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTodoDragOver(false);
    if (!draggedTaskId) return;

    const updated = tasks.map((t) =>
      t.id === draggedTaskId
        ? { ...t, isCompleted: false, completedAt: null }
        : t
    );
    syncTasks(updated);
    setDraggedTaskId(null);
  };

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#fdf6e3] text-[#657b83]">
        <div className="w-10 h-10 rounded-xl bg-[#eee8d5] border border-[#d3c8ab] flex items-center justify-center animate-pulse mb-3">
          <Sparkles className="w-5 h-5 text-[#268bd2]" />
        </div>
        <p className="text-xs font-medium tracking-wide">Hibique データを読み込み中...</p>
      </div>
    );
  }

  return (
    <>
      <div
        inert={isAddModalOpen}
        className="flex flex-col h-screen w-screen bg-[#fdf6e3] text-[#586e75] font-sans selection:bg-[#268bd2]/20"
      >
        {/* ── ヘッダー (Solarized Light: Cream / Ivory) ── */}
        <header className="flex-none px-6 py-3.5 bg-[#fbf5e6] border-b border-[#e6deca] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#268bd2] to-[#2aa198] flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-[#073642]">
                  Hibique
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#eee8d5] text-[#268bd2] border border-[#d3c8ab] font-semibold">
                  日々キュー
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#859900]/10 text-[#859900] border border-[#859900]/30 font-medium flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  <span>Lowdb (JSON)</span>
                </span>
              </div>
              <p className="text-xs text-[#839496] flex items-center gap-1.5 mt-0.5">
                <span className="font-medium text-[#657b83]">📅 {dateStr}</span>
                <span>•</span>
                <span>月曜始まり (日終)</span>
                <span>•</span>
                <span>リセット: 毎日 04:00</span>
              </p>
            </div>
          </div>

          {/* 進捗プログレス ＆ アクション */}
          <div className="flex items-center gap-5">
            <ProgressIndicator
              todayDone={todayDone}
              todayTotal={todayTotal}
              progressPercent={progressPercent}
              isTodayAllDone={isTodayAllDone}
              totalCompletedCount={completedTasks.length}
            />

            {/* アクションボタン */}
            <div>
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#268bd2] hover:bg-[#1f78b8] active:scale-95 rounded-lg shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>タスク追加</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── メインカンバン領域 ── */}
        <main className="flex-1 grid grid-cols-12 gap-5 p-5 overflow-hidden">
          {/* ── 左側：未完了カラム (To Do) ── */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setIsTodoDragOver(true);
            }}
            onDragLeave={() => setIsTodoDragOver(false)}
            onDrop={handleDropOnTodo}
            className={`col-span-7 flex flex-col rounded-2xl bg-[#fbf5e6]/80 border ${
              isTodoDragOver
                ? 'border-[#268bd2] bg-[#268bd2]/10 ring-2 ring-[#268bd2]/30'
                : 'border-[#e6deca]'
            } overflow-hidden shadow-xs backdrop-blur-sm transition`}
          >
            <div className="px-5 py-3 bg-[#f5eece]/90 border-b border-[#e6deca] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#268bd2]" />
                <h2 className="text-sm font-bold text-[#073642]">
                  未完了 (To Do)
                </h2>
              </div>
              <span className="text-xs text-[#586e75] bg-[#eee8d5] px-2 py-0.5 rounded-full border border-[#dcd3bc] font-medium">
                残り {uncompletedDailyToday.length + uncompletedDailyOtherDays.length + uncompletedWeeklyActive.length + uncompletedWeeklyUpcoming.length + uncompletedMonthly.length} 件
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* ── 1. Daily (毎日・定期ルーティーン) ── */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#b58900] mb-2 px-1 tracking-wider uppercase">
                  <Sun className="w-3.5 h-3.5" />
                  <span>今日のルーティーン (Daily)</span>
                  <span className="text-[#839496] font-normal ml-auto">
                    {uncompletedDailyToday.length} 件
                  </span>
                </div>
                <div className="space-y-1.5">
                  {uncompletedDailyToday.length === 0 ? (
                    todayTotal > 0 && isTodayAllDone ? (
                      <TodayCompletionCard todayDone={todayDone} />
                    ) : todayTotal > 0 && !isTodayAllDone ? (
                      <div className="p-3.5 rounded-xl border border-dashed border-[#859900]/40 bg-[#859900]/5 text-center text-xs text-[#586e75] flex items-center justify-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#859900]" />
                        <span>今日のDailyルーティーンは完了！ 続いて本日の曜日タスクへどうぞ ✨</span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-dashed border-[#dcd3bc] text-center text-xs text-[#839496]">
                        本日のノルマ対象タスクはありません
                      </div>
                    )
                  ) : (
                    uncompletedDailyToday.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        currentDayOfWeek={currentDayOfWeek}
                        currentDayOfMonth={currentDayOfMonth}
                        logicalDateStr={logicalDateStr}
                        isSelected={
                          keyboardSelection.column === 'todo' &&
                          keyboardSelection.taskId === task.id
                        }
                        cardRef={(el) => setCardRef(task.id, el)}
                        onToggle={() => toggleTask(task.id)}
                        onEdit={(e) => openEditModal(task, e)}
                        onDelete={(e) => deleteTask(task.id, e)}
                        onDragStart={() => handleDragStart(task.id)}
                      />
                    ))
                  )}
                </div>

                {/* 他曜日のデイリー（本日はお休み / 控え） */}
                {uncompletedDailyOtherDays.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#e6deca]/60">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#839496] mb-1.5 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#93a1a1]" />
                      <span>他曜日のデイリー (本日はお休み / 控え)</span>
                      <span className="text-[10px] text-[#93a1a1] ml-1 font-normal">※前倒し消化も可能</span>
                      <span className="text-[#93a1a1] font-normal ml-auto">
                        {uncompletedDailyOtherDays.length} 件
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {uncompletedDailyOtherDays.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          currentDayOfWeek={currentDayOfWeek}
                          currentDayOfMonth={currentDayOfMonth}
                          logicalDateStr={logicalDateStr}
                          isSelected={
                            keyboardSelection.column === 'todo' &&
                            keyboardSelection.taskId === task.id
                          }
                          cardRef={(el) => setCardRef(task.id, el)}
                          onToggle={() => toggleTask(task.id)}
                          onEdit={(e) => openEditModal(task, e)}
                          onDelete={(e) => deleteTask(task.id, e)}
                          onDragStart={() => handleDragStart(task.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── 2. Weekly (今週のタスク) ── */}
              <div className="p-3.5 rounded-2xl bg-[#f5eed6] border border-[#e6deca]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#268bd2] mb-3 px-1 tracking-wider uppercase">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>今週のタスク (Weekly)</span>
                  <span className="text-[#839496] text-[11px] font-normal ml-auto">
                    月曜〜日曜で消化
                  </span>
                </div>

                {/* メイン: 今週消化するタスク (未消化 + 本日 + いつでも) */}
                <div className="space-y-1.5">
                  {uncompletedWeeklyActive.length === 0 ? (
                    <div className="p-3 rounded-xl border border-dashed border-[#dcd3bc] text-center text-xs text-[#839496]">
                      今週消化するタスクはありません
                    </div>
                  ) : (
                    uncompletedWeeklyActive.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        currentDayOfWeek={currentDayOfWeek}
                        currentDayOfMonth={currentDayOfMonth}
                        logicalDateStr={logicalDateStr}
                        isSelected={
                          keyboardSelection.column === 'todo' &&
                          keyboardSelection.taskId === task.id
                        }
                        cardRef={(el) => setCardRef(task.id, el)}
                        onToggle={() => toggleTask(task.id)}
                        onEdit={(e) => openEditModal(task, e)}
                        onDelete={(e) => deleteTask(task.id, e)}
                        onDragStart={() => handleDragStart(task.id)}
                      />
                    ))
                  )}
                </div>

                {/* サブ: 他曜日のルーティーン (今週の控え・明日以降) */}
                {uncompletedWeeklyUpcoming.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#e6deca]/60">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#839496] mb-1.5 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#93a1a1]" />
                      <span>他曜日のルーティーン (今週の控え)</span>
                      <span className="text-[10px] text-[#93a1a1] ml-1 font-normal">※前倒し消化も可能</span>
                      <span className="text-[#93a1a1] font-normal ml-auto">
                        {uncompletedWeeklyUpcoming.length} 件
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {uncompletedWeeklyUpcoming.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          currentDayOfWeek={currentDayOfWeek}
                          currentDayOfMonth={currentDayOfMonth}
                          logicalDateStr={logicalDateStr}
                          isSelected={
                            keyboardSelection.column === 'todo' &&
                            keyboardSelection.taskId === task.id
                          }
                          cardRef={(el) => setCardRef(task.id, el)}
                          onToggle={() => toggleTask(task.id)}
                          onEdit={(e) => openEditModal(task, e)}
                          onDelete={(e) => deleteTask(task.id, e)}
                          onDragStart={() => handleDragStart(task.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── 3. Monthly (今月のタスク) ── */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#d33682] mb-2 px-1 tracking-wider uppercase">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>今月のタスク (Monthly)</span>
                  <span className="text-[#839496] font-normal ml-auto">
                    {uncompletedMonthly.length} 件
                  </span>
                </div>
                <div className="space-y-1.5">
                  {uncompletedMonthly.length === 0 ? (
                    <div className="p-3 rounded-xl border border-dashed border-[#dcd3bc] text-center text-xs text-[#839496]">
                      今月のタスクはありません
                    </div>
                  ) : (
                    uncompletedMonthly.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        currentDayOfWeek={currentDayOfWeek}
                        currentDayOfMonth={currentDayOfMonth}
                        logicalDateStr={logicalDateStr}
                        isSelected={
                          keyboardSelection.column === 'todo' &&
                          keyboardSelection.taskId === task.id
                        }
                        cardRef={(el) => setCardRef(task.id, el)}
                        onToggle={() => toggleTask(task.id)}
                        onEdit={(e) => openEditModal(task, e)}
                        onDelete={(e) => deleteTask(task.id, e)}
                        onDragStart={() => handleDragStart(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── 右側：完了カラム (Done) ── */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setIsDoneDragOver(true);
            }}
            onDragLeave={() => setIsDoneDragOver(false)}
            onDrop={handleDropOnDone}
            className={`col-span-5 flex flex-col rounded-2xl bg-[#fbf5e6]/80 border ${
              isDoneDragOver
                ? 'border-[#859900] bg-[#859900]/10 ring-2 ring-[#859900]/30'
                : 'border-[#e6deca]'
            } overflow-hidden shadow-xs backdrop-blur-sm transition`}
          >
            <div className="px-5 py-3 bg-[#f5eece]/90 border-b border-[#e6deca] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-[#859900]" />
                <h2 className="text-sm font-bold text-[#073642]">
                  完了 (Done)
                </h2>
              </div>
              <span className="text-xs text-[#859900] bg-[#859900]/10 px-2 py-0.5 rounded-full border border-[#859900]/30 font-semibold">
                {completedTasks.length} 件 完了
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {completedTasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#839496] border border-dashed border-[#dcd3bc] rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-[#93a1a1] mb-2 opacity-60" />
                  <p className="text-xs font-medium text-[#657b83]">左のタスクをクリックするか、</p>
                  <p className="text-xs">ここへドラッグして完了へ放り込もう！</p>
                  <p className="text-[11px] text-[#93a1a1] mt-2">※日曜から月曜のリセット時までここに残ります</p>
                </div>
              ) : (
                completedTasks.map((task) => (
                  <DoneTaskCard
                    key={task.id}
                    task={task}
                    currentDayOfMonth={currentDayOfMonth}
                    logicalDateStr={logicalDateStr}
                    isSelected={
                      keyboardSelection.column === 'done' &&
                      keyboardSelection.taskId === task.id
                    }
                    cardRef={(el) => setCardRef(task.id, el)}
                    onToggle={() => toggleTask(task.id)}
                    onEdit={(e) => openEditModal(task, e)}
                    onDelete={(e) => deleteTask(task.id, e)}
                    onDragStart={() => handleDragStart(task.id)}
                  />
                ))
              )}
            </div>
          </section>
        </main>

        {/* ── キーボード操作ガイド ── */}
        <footer className="flex-none px-5 py-2 bg-[#fbf5e6] border-t border-[#e6deca] text-[11px] text-[#657b83] flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">↑↓</kbd>
            <span>/</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">j</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">k</kbd>
            <span className="ml-0.5">移動</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">←→</kbd>
            <span>/</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">h</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">l</kbd>
            <span className="ml-0.5">完了/未完了</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">Enter</kbd>
            <span>/</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">Space</kbd>
            <span className="ml-0.5">消化・戻す</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">o</kbd>
            <span className="ml-0.5">URLを開く</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">u</kbd>
            <span className="ml-0.5">元に戻す</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#eee8d5] border border-[#dcd3bc] text-[#073642] font-mono text-[10px]">Esc</kbd>
            <span className="ml-0.5">選択解除</span>
          </span>
        </footer>
      </div>

      {/* ── 新規追加 / 編集モーダル ── */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4"
        >
          <div className="w-full max-w-md bg-[#fffdf7] border border-[#dcd3bc] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3
                id="task-modal-title"
                className="text-base font-bold text-[#073642] flex items-center gap-2"
              >
                {editingTask ? (
                  <>
                    <Pencil className="w-4 h-4 text-[#268bd2]" />
                    <span>ルーティーンを編集</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-[#268bd2]" />
                    <span>新しいルーティーンを追加</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                aria-label="モーダルを閉じる"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingTask(null);
                }}
                className="text-[#839496] hover:text-[#073642] p-1 rounded-lg hover:bg-[#eee8d5] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#586e75] mb-1.5">
                  タスク名
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例: 可燃ゴミ出し、アニメ視聴、爪切り"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-[#fdf6e3] border border-[#dcd3bc] rounded-xl text-sm text-[#073642] placeholder-[#93a1a1] focus:outline-none focus:border-[#268bd2] focus:ring-1 focus:ring-[#268bd2] transition"
                />
              </div>

              {/* タグ選択 */}
              <div>
                <label className="block text-xs font-semibold text-[#586e75] mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#268bd2]" />
                  <span>タグ (コンテンツ・カテゴリ)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_TAGS.map((tag) => {
                    const isSelected = newTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTagSelection(tag)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium ${
                          isSelected
                            ? 'bg-[#268bd2] text-white border-[#268bd2] shadow-2xs'
                            : 'bg-[#eee8d5] text-[#586e75] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                        }`}
                      >
                        {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  placeholder="自由なタグを入力 (例: ゲーム、読書)"
                  className="w-full px-3 py-1.5 bg-[#fdf6e3] border border-[#dcd3bc] rounded-lg text-xs text-[#073642] placeholder-[#93a1a1] focus:outline-none focus:border-[#268bd2]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#586e75] mb-1.5">
                  周期スパン
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'daily', label: '毎日 (Daily)' },
                      { key: 'weekly', label: '今週 (Weekly)' },
                      { key: 'monthly', label: '今月 (Monthly)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      type="button"
                      key={opt.key}
                      onClick={() => setNewSpan(opt.key)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border transition ${
                        newSpan === opt.key
                          ? 'bg-[#268bd2]/15 text-[#268bd2] border-[#268bd2] font-bold'
                          : 'bg-[#eee8d5] text-[#657b83] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily選択時：実行曜日セレクタ */}
              {newSpan === 'daily' && (
                <div className="p-3.5 rounded-xl bg-[#fbf5e6] border border-[#e6deca] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#586e75]">
                      実行曜日
                    </label>
                    {/* クイック選択プリセット */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewSelectedDays([1, 2, 3, 4, 5, 6, 0])}
                        className={`px-2 py-0.5 text-[10px] rounded-md border font-medium transition ${
                          newSelectedDays.length === 7
                            ? 'bg-[#268bd2] text-white border-[#268bd2] font-bold'
                            : 'bg-[#eee8d5] text-[#657b83] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                        }`}
                      >
                        毎日
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSelectedDays([1, 2, 3, 4, 5])}
                        className={`px-2 py-0.5 text-[10px] rounded-md border font-medium transition ${
                          newSelectedDays.length === 5 &&
                          [1, 2, 3, 4, 5].every((d) => newSelectedDays.includes(d))
                            ? 'bg-[#268bd2] text-white border-[#268bd2] font-bold'
                            : 'bg-[#eee8d5] text-[#657b83] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                        }`}
                      >
                        平日 (月〜金)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSelectedDays([6, 0])}
                        className={`px-2 py-0.5 text-[10px] rounded-md border font-medium transition ${
                          newSelectedDays.length === 2 &&
                          [6, 0].every((d) => newSelectedDays.includes(d))
                            ? 'bg-[#268bd2] text-white border-[#268bd2] font-bold'
                            : 'bg-[#eee8d5] text-[#657b83] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                        }`}
                      >
                        週末 (土日)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {ORDERED_DAYS.map((d) => {
                      const isSelected = newSelectedDays.includes(d);
                      const colorDef = DAY_COLORS[d];
                      return (
                        <button
                          type="button"
                          key={d}
                          onClick={() => toggleDaySelection(d)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                            isSelected
                              ? colorDef.buttonBg + ' shadow-xs'
                              : 'bg-[#eee8d5] text-[#839496] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                          }`}
                        >
                          {DAY_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[#839496]">
                    {newSelectedDays.length === 7
                      ? '※毎日深夜4:00に未完了へ自動リセットされます'
                      : '※指定曜日の深夜4:00に自動リセットされ、対象外の曜日は今日のノルマに含まれません'}
                  </p>
                </div>
              )}

              {/* Weekly選択時のみ：週間タイプ選択（いつでも vs 曜日指定） */}
              {newSpan === 'weekly' && (
                <div className="p-3.5 rounded-xl bg-[#fbf5e6] border border-[#e6deca] space-y-3">
                  <label className="block text-xs font-semibold text-[#586e75]">
                    週間タスクのタイプ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewWeeklyType('anytime')}
                      className={`px-3 py-2 text-xs rounded-lg border transition text-left ${
                        newWeeklyType === 'anytime'
                          ? 'bg-[#268bd2]/15 text-[#268bd2] border-[#268bd2] font-bold'
                          : 'bg-[#eee8d5] text-[#657b83] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                      }`}
                    >
                      <div className="font-semibold">今週いつでも</div>
                      <div className="text-[10px] text-[#839496] font-normal">週に1回完了でOK</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewWeeklyType('day_of_week')}
                      className={`px-3 py-2 text-xs rounded-lg border transition text-left ${
                        newWeeklyType === 'day_of_week'
                          ? 'bg-[#6c71c4]/15 text-[#6c71c4] border-[#6c71c4] font-bold'
                          : 'bg-[#eee8d5] text-[#657b83] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                      }`}
                    >
                      <div className="font-semibold">曜日指定</div>
                      <div className="text-[10px] text-[#839496] font-normal">特定の曜日に消化</div>
                    </button>
                  </div>

                  {/* 曜日指定の場合の7色カラフル曜日セレクタ */}
                  {newWeeklyType === 'day_of_week' && (
                    <div className="pt-1">
                      <div className="text-[11px] font-medium text-[#586e75] mb-1.5">
                        該当する曜日（月〜日・7色選択）:
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {ORDERED_DAYS.map((d) => {
                          const isSelected = newSelectedDays.includes(d);
                          const colorDef = DAY_COLORS[d];
                          return (
                            <button
                              type="button"
                              key={d}
                              onClick={() => toggleDaySelection(d)}
                              className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                                isSelected
                                  ? colorDef.buttonBg + ' shadow-xs'
                                  : 'bg-[#eee8d5] text-[#839496] border-[#dcd3bc] hover:bg-[#e4dcbf]'
                              }`}
                            >
                              {DAY_LABELS[d]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Monthly選択時のみ：目安日（特定日）入力 */}
              {newSpan === 'monthly' && (
                <div className="p-3.5 rounded-xl bg-[#fbf5e6] border border-[#e6deca] space-y-2">
                  <label className="block text-xs font-semibold text-[#586e75]">
                    毎月の目安日（任意・近づくとハイライト）
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#586e75] font-medium">毎月</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={newMonthlyDay}
                      onChange={(e) => setNewMonthlyDay(e.target.value)}
                      placeholder="例: 25 (給料日/クレカ), 27 (家賃)"
                      className="w-24 px-3 py-1.5 bg-[#fdf6e3] border border-[#dcd3bc] rounded-lg text-xs text-[#073642] placeholder-[#93a1a1] focus:outline-none focus:border-[#268bd2] text-center"
                    />
                    <span className="text-xs text-[#586e75] font-medium">日頃</span>
                    <span className="text-[10px] text-[#839496] ml-2">※3日前〜当日に目立つようになります</span>
                  </div>
                </div>
              )}

              {/* 巡回先URL & 終了期日（全スパン共通・任意） */}
              <div className="p-3.5 rounded-xl bg-[#fbf5e6] border border-[#e6deca] space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#586e75] mb-1.5 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-[#268bd2]" />
                    <span>巡回先URL (任意)</span>
                  </label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="例: https://camp-fire.jp/projects/... または blog.example.com"
                    className="w-full px-3 py-1.5 bg-[#fdf6e3] border border-[#dcd3bc] rounded-lg text-xs text-[#073642] placeholder-[#93a1a1] focus:outline-none focus:border-[#268bd2]"
                  />
                  <p className="text-[10px] text-[#839496] mt-1">
                    ※カード上のチェーンアイコンからワンクリックで巡回先サイトを開けます
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#586e75] mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#268bd2]" />
                    <span>終了期日・目標日 (任意)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="px-3 py-1.5 bg-[#fdf6e3] border border-[#dcd3bc] rounded-lg text-xs text-[#073642] focus:outline-none focus:border-[#268bd2]"
                    />
                    {newDeadline && (
                      <button
                        type="button"
                        onClick={() => setNewDeadline('')}
                        className="px-2 py-1 text-[11px] text-[#dc322f] hover:bg-[#dc322f]/10 rounded-md transition"
                      >
                        日付クリア
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[#839496] mt-1">
                    ※期日が近づくとバッジや警告枠が表示されます（期日後も自動削除はされず手動で整理できます）
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingTask(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-[#657b83] hover:text-[#073642] hover:bg-[#eee8d5] rounded-xl transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#268bd2] hover:bg-[#1f78b8] disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition"
                >
                  {editingTask ? '変更を保存' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── 未完了タスクカード ──
function TaskCard({
  task,
  currentDayOfWeek,
  currentDayOfMonth,
  logicalDateStr,
  isSelected,
  cardRef,
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: RoutineTask;
  currentDayOfWeek: number;
  currentDayOfMonth: number;
  logicalDateStr: string;
  isSelected: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  onToggle: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDragStart: () => void;
}) {
  const isWeeklyScheduled = task.span === 'weekly' && task.weeklyType === 'day_of_week';
  const isDailyScheduled =
    task.span === 'daily' &&
    Boolean(task.daysOfWeek && task.daysOfWeek.length > 0 && task.daysOfWeek.length < 7);
  const isScheduled = isWeeklyScheduled || isDailyScheduled;
  const currentDayIndex = getDayWeekIndex(currentDayOfWeek);
  const isTodayScheduledTask = isScheduled && task.daysOfWeek?.includes(currentDayOfWeek);
  // 過去の曜日で未消化かどうかの判定 (Weeklyの曜日指定タスク)
  const isOverdueScheduledTask =
    isWeeklyScheduled &&
    !isTodayScheduledTask &&
    Boolean(task.daysOfWeek?.some((d) => getDayWeekIndex(d) < currentDayIndex));
  const isOtherDayScheduledTask =
    isScheduled && !isTodayScheduledTask && !isOverdueScheduledTask;
  const monthlyStatus =
    task.span === 'monthly' ? getMonthlyStatus(task.monthlyDay, currentDayOfMonth) : null;
  const deadlineStatus = getDeadlineStatus(task.deadline, logicalDateStr);

  // カードのボーダーと背景の動的スタイル
  let cardBorderClass = 'border-[#e6deca] hover:border-[#d3c8ab] bg-[#fffdf7] hover:bg-white shadow-2xs';
  if (deadlineStatus?.isToday) {
    cardBorderClass = 'border-rose-400 ring-1 ring-rose-400/30 bg-[#fffbfb] hover:bg-white shadow-xs';
  } else if (deadlineStatus?.isApproaching) {
    cardBorderClass = 'border-amber-400 ring-1 ring-amber-400/30 bg-[#fffdf5] hover:bg-white shadow-2xs';
  } else if (isTodayScheduledTask) {
    cardBorderClass = 'border-[#268bd2] ring-1 ring-[#268bd2]/30 shadow-xs bg-[#fffdf7] hover:bg-white';
  } else if (isOverdueScheduledTask) {
    cardBorderClass = 'border-amber-400 ring-1 ring-amber-400/30 bg-[#fffdf5] hover:bg-white shadow-2xs';
  } else if (isOtherDayScheduledTask) {
    cardBorderClass = 'border-dashed border-[#dcd3bc] bg-[#fbf5e6]/50 hover:bg-[#fffdf7] hover:border-[#b4bdbe] opacity-75 hover:opacity-100 shadow-none';
  } else if (monthlyStatus) {
    cardBorderClass = `${monthlyStatus.borderClass} hover:brightness-98 shadow-2xs`;
  }

  // タイトル文字色
  let titleColorClass = 'text-[#073642] group-hover:text-[#002b36]';
  if (deadlineStatus?.isToday) {
    titleColorClass = 'text-rose-950 font-bold group-hover:text-rose-900';
  } else if (deadlineStatus?.isApproaching) {
    titleColorClass = 'text-amber-950 font-semibold group-hover:text-amber-900';
  } else if (isOverdueScheduledTask) {
    titleColorClass = 'text-amber-950 font-semibold group-hover:text-amber-900';
  } else if (isOtherDayScheduledTask) {
    titleColorClass = 'text-[#657b83] font-medium group-hover:text-[#073642]';
  } else if (monthlyStatus) {
    titleColorClass = monthlyStatus.textClass;
  }

  const actionRevealClass = `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${
    isSelected ? 'opacity-100' : ''
  }`;

  return (
    <div
      ref={cardRef}
      data-task-id={task.id}
      data-selected={isSelected ? 'true' : undefined}
      draggable
      onDragStart={onDragStart}
      onClick={onToggle}
      className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer active:scale-[0.99] transition duration-150 border ${cardBorderClass} ${
        isSelected
          ? 'outline-2 outline-offset-2 outline-[#268bd2] bg-[#f4f9fd] opacity-100'
          : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${task.title} を${isOtherDayScheduledTask ? '前倒し完了' : '完了'}にする`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`${
            isOtherDayScheduledTask
              ? 'text-[#b4bdbe] group-hover:text-[#93a1a1] hover:!text-[#268bd2]'
              : isOverdueScheduledTask
              ? 'text-amber-500 hover:text-amber-600'
              : 'text-[#93a1a1] hover:text-[#268bd2]'
          } transition`}
        >
          <Circle className="w-4 h-4 stroke-[2]" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold transition ${titleColorClass}`}>
              {task.title}
            </span>
            {task.url && (
              <button
                type="button"
                aria-label={`${task.title} の巡回先URLを開く`}
                onClick={(e) => {
                  e.stopPropagation();
                  openExternalUrl(task.url);
                }}
                className="p-1 text-[#268bd2] hover:text-[#1f78b8] hover:bg-[#268bd2]/15 rounded-md transition shrink-0 inline-flex items-center justify-center cursor-pointer"
                title={`巡回先を開く: ${task.url}`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {isTodayScheduledTask && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#268bd2]/15 text-[#268bd2] border border-[#268bd2]/30 font-bold tracking-wide">
                本日
              </span>
            )}
            {isOverdueScheduledTask && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500 text-white border border-amber-600 font-bold tracking-wide shadow-2xs">
                未消化
              </span>
            )}
            {isOtherDayScheduledTask && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#eee8d5] text-[#839496] border border-[#dcd3bc] font-normal">
                他曜日
              </span>
            )}
            {monthlyStatus && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md border font-semibold ${monthlyStatus.badgeClass}`}>
                {monthlyStatus.label}
              </span>
            )}
            {deadlineStatus && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md border flex items-center gap-1 font-medium ${deadlineStatus.badgeClass}`}
                title={`期日: ${task.deadline} (残り${deadlineStatus.remainingDays}日)`}
              >
                <Calendar className="w-2.5 h-2.5 shrink-0" />
                <span>{deadlineStatus.label}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {/* タグ表示 */}
            {task.tags &&
              task.tags.map((tag) => (
                <span
                  key={tag}
                  className={`text-[10px] px-1.5 py-0.2 rounded-md border font-medium ${
                    isOtherDayScheduledTask ? 'opacity-80' : ''
                  } ${getTagBadgeClass(tag)}`}
                >
                  #{tag}
                </span>
              ))}

            {/* 曜日指定タスクの場合の7色カラフル曜日バッジ */}
            {isScheduled && task.daysOfWeek && task.daysOfWeek.length > 0 && (
              <div className="flex items-center gap-1">
                {ORDERED_DAYS.map((d) => {
                  const isTarget = task.daysOfWeek?.includes(d);
                  if (!isTarget) return null;
                  const isToday = d === currentDayOfWeek;
                  const isPast = getDayWeekIndex(d) < currentDayIndex;
                  const colorDef = DAY_COLORS[d];
                  return (
                    <span
                      key={d}
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                        isToday
                          ? colorDef.activeBadge
                          : isPast && isOverdueScheduledTask
                          ? `${colorDef.badge} ring-1 ring-amber-400 font-extrabold`
                          : colorDef.badge
                      } ${isOtherDayScheduledTask ? 'opacity-85' : ''}`}
                    >
                      {DAY_LABELS[d]}
                    </span>
                  );
                })}
              </div>
            )}

            {/* 週間いつでもタスクの場合 */}
            {task.span === 'weekly' && task.weeklyType === 'anytime' && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#268bd2]/10 text-[#268bd2] border border-[#268bd2]/20 font-medium">
                週に1度
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className={`${actionRevealClass} text-xs text-[#268bd2] font-medium flex items-center gap-0.5 transition`}>
          <span>
            {isSelected
              ? isOtherDayScheduledTask
                ? '前倒し完了 [Enter]'
                : '完了へ [Enter]'
              : isOtherDayScheduledTask
              ? '前倒し完了へ'
              : '完了へ'}
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
        <button
          type="button"
          aria-label={`${task.title} を編集`}
          onClick={onEdit}
          className={`${actionRevealClass} p-1 text-[#93a1a1] hover:text-[#268bd2] hover:bg-[#268bd2]/10 rounded transition`}
          title="編集"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label={`${task.title} を削除`}
          onClick={onDelete}
          className={`${actionRevealClass} p-1 text-[#93a1a1] hover:text-[#dc322f] hover:bg-[#dc322f]/10 rounded transition`}
          title="削除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── 完了タスクカード ──
function DoneTaskCard({
  task,
  currentDayOfMonth: _currentDayOfMonth,
  logicalDateStr,
  isSelected,
  cardRef,
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: RoutineTask;
  currentDayOfMonth: number;
  logicalDateStr: string;
  isSelected: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  onToggle: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDragStart: () => void;
}) {
  const deadlineStatus = getDeadlineStatus(task.deadline, logicalDateStr);
  const actionRevealClass = `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${
    isSelected ? 'opacity-100' : ''
  }`;

  return (
    <div
      ref={cardRef}
      data-task-id={task.id}
      data-selected={isSelected ? 'true' : undefined}
      draggable
      onDragStart={onDragStart}
      onClick={onToggle}
      className={`group flex items-center justify-between p-3 border rounded-xl cursor-pointer active:scale-[0.99] transition duration-150 shadow-2xs ${
        isSelected
          ? 'bg-[#eee8d5] border-[#268bd2] outline-2 outline-offset-2 outline-[#268bd2]'
          : 'bg-[#f5eece]/70 hover:bg-[#eee8d5] border-[#e6deca] hover:border-[#d3c8ab]'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${task.title} を未完了に戻す`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="text-[#859900] transition"
        >
          <CheckCircle2 className="w-4 h-4 fill-[#859900]/20 stroke-[2.2]" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-normal text-[#839496] line-through group-hover:text-[#657b83] transition">
              {task.title}
            </span>
            {task.url && (
              <button
                type="button"
                aria-label={`${task.title} の巡回先URLを開く`}
                onClick={(e) => {
                  e.stopPropagation();
                  openExternalUrl(task.url);
                }}
                className="p-1 text-[#268bd2] hover:text-[#1f78b8] hover:bg-[#268bd2]/15 rounded-md transition shrink-0 inline-flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer"
                title={`巡回先を開く: ${task.url}`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {deadlineStatus && (
              <span
                className="text-[9px] px-1.5 py-0.1 rounded border border-[#dcd3bc] bg-[#eee8d5] text-[#839496] font-medium"
                title={`期日: ${task.deadline}`}
              >
                {deadlineStatus.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {/* 曜日またはスパンバッジ */}
            {(task.span === 'weekly' && task.weeklyType === 'day_of_week' && task.daysOfWeek) ||
            (task.span === 'daily' && task.daysOfWeek && task.daysOfWeek.length > 0 && task.daysOfWeek.length < 7) ? (
              <div className="flex items-center gap-1">
                {ORDERED_DAYS.map((d) => {
                  if (!task.daysOfWeek?.includes(d)) return null;
                  const colorDef = DAY_COLORS[d];
                  return (
                    <span
                      key={d}
                      className={`text-[9px] px-1 py-0.1 rounded border font-semibold ${colorDef.badge}`}
                    >
                      {DAY_LABELS[d]}
                    </span>
                  );
                })}
              </div>
            ) : task.span === 'monthly' && task.monthlyDay ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#eee8d5] text-[#d33682] border border-[#dcd3bc] font-semibold">
                毎月 {task.monthlyDay} 日
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#eee8d5] text-[#657b83] border border-[#dcd3bc] font-medium">
                {task.span === 'daily'
                  ? '毎日'
                  : task.span === 'weekly'
                  ? '今週'
                  : '今月'}
              </span>
            )}

            {/* タグ表示 */}
            {task.tags &&
              task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] px-1.5 py-0.2 rounded bg-[#eee8d5] text-[#839496] font-medium"
                >
                  #{tag}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className={`${actionRevealClass} text-xs text-[#657b83] font-medium transition`}>
          {isSelected ? '元に戻す [Enter]' : '元に戻す'}
        </span>
        <button
          type="button"
          aria-label={`${task.title} を編集`}
          onClick={onEdit}
          className={`${actionRevealClass} p-1 text-[#93a1a1] hover:text-[#268bd2] hover:bg-[#268bd2]/10 rounded transition`}
          title="編集"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label={`${task.title} を削除`}
          onClick={onDelete}
          className={`${actionRevealClass} p-1 text-[#93a1a1] hover:text-[#dc322f] hover:bg-[#dc322f]/10 rounded transition`}
          title="削除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
