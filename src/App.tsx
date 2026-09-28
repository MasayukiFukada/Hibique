import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { RoutineTask, TaskSpan, AppSettings } from './types';
import { db, initializeDatabase, persistDatabase, DatabaseSchema } from './services/db';
import { evaluateTaskResets, getLogicalDate } from './services/resetLogic';

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
// 月曜スタート (1: 月, 2: 火, 3: 水, 4: 木, 5: 金, 6: 土, 0: 日)
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

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
  const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);

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

  // タスクの分類
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.isCompleted),
    [tasks]
  );
  const uncompletedDaily = useMemo(
    () => tasks.filter((t) => !t.isCompleted && t.span === 'daily'),
    [tasks]
  );
  // 週間：いつでも
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
  // 週間：曜日指定
  const uncompletedWeeklyScheduled = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isCompleted &&
          t.span === 'weekly' &&
          t.weeklyType === 'day_of_week' &&
          t.daysOfWeek &&
          t.daysOfWeek.length > 0
      ),
    [tasks]
  );
  // 週間：曜日指定（本日該当分）
  const uncompletedWeeklyToday = useMemo(
    () =>
      uncompletedWeeklyScheduled.filter((t) =>
        t.daysOfWeek?.includes(currentDayOfWeek)
      ),
    [uncompletedWeeklyScheduled, currentDayOfWeek]
  );
  // 週間：曜日指定（他曜日・控え分）
  const uncompletedWeeklyOtherDays = useMemo(
    () =>
      uncompletedWeeklyScheduled.filter(
        (t) => !t.daysOfWeek?.includes(currentDayOfWeek)
      ),
    [uncompletedWeeklyScheduled, currentDayOfWeek]
  );
  const uncompletedMonthly = useMemo(
    () => tasks.filter((t) => !t.isCompleted && t.span === 'monthly'),
    [tasks]
  );

  // 本日のノルマ対象タスク（Daily ＋ 今日の曜日に該当する曜日指定タスク）
  const todayTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.span === 'daily') return true;
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
  const toggleTask = (id: string) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextState = !t.isCompleted;
        return {
          ...t,
          isCompleted: nextState,
          completedAt: nextState ? new Date().toISOString() : null,
        };
      }
      return t;
    });
    syncTasks(updated);
  };

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
    setNewSelectedDays([1]);
    setNewMonthlyDay('');
    setNewTags([]);
    setCustomTagInput('');
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
      task.daysOfWeek && task.daysOfWeek.length > 0 ? [...task.daysOfWeek] : [1]
    );
    setNewMonthlyDay(task.monthlyDay ? String(task.monthlyDay) : '');
    setNewTags(task.tags ? [...task.tags] : []);
    setCustomTagInput('');
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

    if (editingTask) {
      // 既存タスクの更新
      const updated = tasks.map((t) => {
        if (t.id === editingTask.id) {
          return {
            ...t,
            title: newTitle.trim(),
            span: newSpan,
            weeklyType: newSpan === 'weekly' ? newWeeklyType : undefined,
            daysOfWeek:
              newSpan === 'weekly' && newWeeklyType === 'day_of_week'
                ? newSelectedDays.sort()
                : undefined,
            monthlyDay: parsedMonthlyDay,
            tags: finalTags.length > 0 ? finalTags : undefined,
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
        daysOfWeek:
          newSpan === 'weekly' && newWeeklyType === 'day_of_week'
            ? newSelectedDays.sort()
            : undefined,
        monthlyDay: parsedMonthlyDay,
        tags: finalTags.length > 0 ? finalTags : undefined,
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
    <div className="flex flex-col h-screen w-screen bg-[#fdf6e3] text-[#586e75] font-sans selection:bg-[#268bd2]/20">
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
          <div className="flex items-center gap-3 bg-[#eee8d5]/80 px-3.5 py-1.5 rounded-xl border border-[#dcd3bc]">
            <div className="text-right">
              <div className="text-[11px] font-medium text-[#839496] flex items-center justify-end gap-1">
                <span>本日のノルマ</span>
                {isTodayAllDone && (
                  <span className="text-[10px] text-[#859900] font-bold">達成！</span>
                )}
              </div>
              <div className="text-xs font-bold text-[#268bd2]">
                {todayDone} / {todayTotal}{' '}
                <span className="text-[11px] font-normal text-[#657b83]">
                  ({progressPercent}%)
                </span>
                {completedTasks.length > todayDone && (
                  <span
                    className="text-[10px] text-[#93a1a1] ml-1 font-normal"
                    title={`いつでもタスク・月次など今日枠外の消化タスクを含む合計: ${completedTasks.length}件完了`}
                  >
                    (全完了 {completedTasks.length})
                  </span>
                )}
              </div>
            </div>
            <div className="w-24 h-2 bg-[#dfd6be] rounded-full overflow-hidden p-0.5 border border-[#d3c8ab]">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isTodayAllDone
                    ? 'bg-[#859900]'
                    : 'bg-gradient-to-r from-[#268bd2] to-[#859900]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

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
              残り {uncompletedDaily.length + uncompletedWeeklyAnytime.length + uncompletedWeeklyScheduled.length + uncompletedMonthly.length} 件
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* ── 1. Daily (毎日) ── */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#b58900] mb-2 px-1 tracking-wider uppercase">
                <Sun className="w-3.5 h-3.5" />
                <span>今日のルーティーン (Daily)</span>
                <span className="text-[#839496] font-normal ml-auto">
                  {uncompletedDaily.length} 件
                </span>
              </div>
              <div className="space-y-1.5">
                {uncompletedDaily.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-[#dcd3bc] text-center text-xs text-[#839496]">
                    今日のルーティーンはすべて完了！ 🎉
                  </div>
                ) : (
                  uncompletedDaily.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      currentDayOfWeek={currentDayOfWeek}
                      currentDayOfMonth={currentDayOfMonth}
                      onToggle={() => toggleTask(task.id)}
                      onEdit={(e) => openEditModal(task, e)}
                      onDelete={(e) => deleteTask(task.id, e)}
                      onDragStart={() => handleDragStart(task.id)}
                    />
                  ))
                )}
              </div>
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

              {/* サブグループ A: 今週いつでも (Anytime) */}
              <div className="mb-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#586e75] mb-1.5 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#268bd2]" />
                  <span>今週いつでも (週1回でOK)</span>
                  <span className="text-[#839496] font-normal ml-auto">
                    {uncompletedWeeklyAnytime.length} 件
                  </span>
                </div>
                <div className="space-y-1.5">
                  {uncompletedWeeklyAnytime.length === 0 ? (
                    <div className="p-2.5 rounded-xl border border-dashed border-[#dcd3bc] text-center text-[11px] text-[#839496]">
                      今週のフリータスクはありません
                    </div>
                  ) : (
                    uncompletedWeeklyAnytime.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        currentDayOfWeek={currentDayOfWeek}
                        currentDayOfMonth={currentDayOfMonth}
                        onToggle={() => toggleTask(task.id)}
                        onEdit={(e) => openEditModal(task, e)}
                        onDelete={(e) => deleteTask(task.id, e)}
                        onDragStart={() => handleDragStart(task.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* サブグループ B: 曜日ルーティーン (Day-of-Week) */}
              <div className="space-y-3">
                {/* 1. 今日の曜日ルーティーン */}
                {uncompletedWeeklyToday.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#268bd2] mb-1.5 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#268bd2] animate-pulse" />
                      <span>本日の曜日ルーティーン ({DAY_LABELS[currentDayOfWeek]}曜)</span>
                      <span className="text-[#839496] font-normal ml-auto">
                        {uncompletedWeeklyToday.length} 件
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {uncompletedWeeklyToday.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          currentDayOfWeek={currentDayOfWeek}
                          currentDayOfMonth={currentDayOfMonth}
                          onToggle={() => toggleTask(task.id)}
                          onEdit={(e) => openEditModal(task, e)}
                          onDelete={(e) => deleteTask(task.id, e)}
                          onDragStart={() => handleDragStart(task.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. 他曜日のルーティーン（今週の控え） */}
                {uncompletedWeeklyOtherDays.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#839496] mb-1.5 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#93a1a1]" />
                      <span>他曜日のルーティーン (今週の控え)</span>
                      <span className="text-[10px] text-[#93a1a1] ml-1 font-normal">※前倒し消化も可能</span>
                      <span className="text-[#93a1a1] font-normal ml-auto">
                        {uncompletedWeeklyOtherDays.length} 件
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {uncompletedWeeklyOtherDays.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          currentDayOfWeek={currentDayOfWeek}
                          currentDayOfMonth={currentDayOfMonth}
                          onToggle={() => toggleTask(task.id)}
                          onEdit={(e) => openEditModal(task, e)}
                          onDelete={(e) => deleteTask(task.id, e)}
                          onDragStart={() => handleDragStart(task.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* どちらも0件の場合 */}
                {uncompletedWeeklyToday.length === 0 && uncompletedWeeklyOtherDays.length === 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#586e75] mb-1.5 px-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6c71c4]" />
                      <span>曜日ルーティーン (各曜日に消化)</span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-dashed border-[#dcd3bc] text-center text-[11px] text-[#839496]">
                      曜日指定タスクはありません
                    </div>
                  </div>
                )}
              </div>
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

      {/* ── 新規追加 / 編集モーダル ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="w-full max-w-md bg-[#fffdf7] border border-[#dcd3bc] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#073642] flex items-center gap-2">
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
    </div>
  );
}

// ── 未完了タスクカード ──
function TaskCard({
  task,
  currentDayOfWeek,
  currentDayOfMonth,
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: RoutineTask;
  currentDayOfWeek: number;
  currentDayOfMonth: number;
  onToggle: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDragStart: () => void;
}) {
  const isWeeklyScheduled = task.span === 'weekly' && task.weeklyType === 'day_of_week';
  const isTodayWeeklyTask = isWeeklyScheduled && task.daysOfWeek?.includes(currentDayOfWeek);
  const isOtherDayWeeklyTask = isWeeklyScheduled && !task.daysOfWeek?.includes(currentDayOfWeek);
  const monthlyStatus =
    task.span === 'monthly' ? getMonthlyStatus(task.monthlyDay, currentDayOfMonth) : null;

  // カードのボーダーと背景の動的スタイル
  let cardBorderClass = 'border-[#e6deca] hover:border-[#d3c8ab] bg-[#fffdf7] hover:bg-white shadow-2xs';
  if (isTodayWeeklyTask) {
    cardBorderClass = 'border-[#268bd2] ring-1 ring-[#268bd2]/30 shadow-xs bg-[#fffdf7] hover:bg-white';
  } else if (isOtherDayWeeklyTask) {
    cardBorderClass = 'border-dashed border-[#dcd3bc] bg-[#fbf5e6]/50 hover:bg-[#fffdf7] hover:border-[#b4bdbe] opacity-75 hover:opacity-100 shadow-none';
  } else if (monthlyStatus) {
    cardBorderClass = `${monthlyStatus.borderClass} hover:brightness-98 shadow-2xs`;
  }

  // タイトル文字色
  let titleColorClass = 'text-[#073642] group-hover:text-[#002b36]';
  if (isOtherDayWeeklyTask) {
    titleColorClass = 'text-[#657b83] font-medium group-hover:text-[#073642]';
  } else if (monthlyStatus) {
    titleColorClass = monthlyStatus.textClass;
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onToggle}
      className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer active:scale-[0.99] transition duration-150 border ${cardBorderClass}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`${
            isOtherDayWeeklyTask
              ? 'text-[#b4bdbe] group-hover:text-[#93a1a1] hover:!text-[#268bd2]'
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
            {isTodayWeeklyTask && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#268bd2]/15 text-[#268bd2] border border-[#268bd2]/30 font-bold tracking-wide">
                本日
              </span>
            )}
            {isOtherDayWeeklyTask && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#eee8d5] text-[#839496] border border-[#dcd3bc] font-normal">
                他曜日
              </span>
            )}
            {monthlyStatus && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md border font-semibold ${monthlyStatus.badgeClass}`}>
                {monthlyStatus.label}
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
                    isOtherDayWeeklyTask ? 'opacity-80' : ''
                  } ${getTagBadgeClass(tag)}`}
                >
                  #{tag}
                </span>
              ))}

            {/* 曜日指定タスクの場合の7色カラフル曜日バッジ */}
            {isWeeklyScheduled && task.daysOfWeek && task.daysOfWeek.length > 0 && (
              <div className="flex items-center gap-1">
                {ORDERED_DAYS.map((d) => {
                  const isTarget = task.daysOfWeek?.includes(d);
                  if (!isTarget) return null;
                  const isToday = d === currentDayOfWeek;
                  const colorDef = DAY_COLORS[d];
                  return (
                    <span
                      key={d}
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                        isToday ? colorDef.activeBadge : colorDef.badge
                      } ${isOtherDayWeeklyTask ? 'opacity-85' : ''}`}
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
        <span className="opacity-0 group-hover:opacity-100 text-xs text-[#268bd2] font-medium flex items-center gap-0.5 transition">
          <span>{isOtherDayWeeklyTask ? '前倒し完了へ' : '完了へ'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 p-1 text-[#93a1a1] hover:text-[#268bd2] hover:bg-[#268bd2]/10 rounded transition"
          title="編集"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-[#93a1a1] hover:text-[#dc322f] hover:bg-[#dc322f]/10 rounded transition"
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
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: RoutineTask;
  currentDayOfMonth: number;
  onToggle: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onToggle}
      className="group flex items-center justify-between p-3 bg-[#f5eece]/70 hover:bg-[#eee8d5] border border-[#e6deca] hover:border-[#d3c8ab] rounded-xl cursor-pointer active:scale-[0.99] transition duration-150 shadow-2xs"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="text-[#859900] transition"
        >
          <CheckCircle2 className="w-4 h-4 fill-[#859900]/20 stroke-[2.2]" />
        </button>
        <div>
          <span className="text-sm font-normal text-[#839496] line-through group-hover:text-[#657b83] transition">
            {task.title}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {/* 曜日またはスパンバッジ */}
            {task.span === 'weekly' && task.weeklyType === 'day_of_week' && task.daysOfWeek ? (
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
        <span className="opacity-0 group-hover:opacity-100 text-xs text-[#657b83] font-medium transition">
          元に戻す
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 p-1 text-[#93a1a1] hover:text-[#268bd2] hover:bg-[#268bd2]/10 rounded transition"
          title="編集"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-[#93a1a1] hover:text-[#dc322f] hover:bg-[#dc322f]/10 rounded transition"
          title="削除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
