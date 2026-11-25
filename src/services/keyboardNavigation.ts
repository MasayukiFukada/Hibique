export type ColumnType = 'todo' | 'done';

export interface KeyboardSelection {
  column: ColumnType;
  taskId: string | null;
}

export interface TaskColumns {
  todoIds: string[];
  doneIds: string[];
}

function getColumnIds(columns: TaskColumns, column: ColumnType): string[] {
  return column === 'todo' ? columns.todoIds : columns.doneIds;
}

/**
 * 選択位置を上下方向に移動する。
 * 現在のカラムが空の場合はもう一方のカラムへフォールバックする。
 */
export function moveVertical(
  selection: KeyboardSelection,
  columns: TaskColumns,
  delta: 1 | -1
): KeyboardSelection {
  const currentIds = getColumnIds(columns, selection.column);
  if (currentIds.length === 0) {
    const fallbackColumn: ColumnType = selection.column === 'todo' ? 'done' : 'todo';
    const fallbackIds = getColumnIds(columns, fallbackColumn);
    if (fallbackIds.length === 0) {
      return { column: selection.column, taskId: null };
    }
    const fallbackIndex = delta > 0 ? 0 : fallbackIds.length - 1;
    return { column: fallbackColumn, taskId: fallbackIds[fallbackIndex] };
  }

  const currentIndex = selection.taskId ? currentIds.indexOf(selection.taskId) : -1;
  if (currentIndex === -1) {
    const nextIndex = delta > 0 ? 0 : currentIds.length - 1;
    return { column: selection.column, taskId: currentIds[nextIndex] };
  }

  const clampedIndex = Math.max(0, Math.min(currentIds.length - 1, currentIndex + delta));
  return { column: selection.column, taskId: currentIds[clampedIndex] };
}

/**
 * 選択位置を指定されたカラム（未完了 / 完了）へ移動する。
 * 移動先が空の場合は現在の選択を維持する。
 */
export function moveColumn(
  selection: KeyboardSelection,
  columns: TaskColumns,
  targetColumn: ColumnType
): KeyboardSelection {
  const targetIds = getColumnIds(columns, targetColumn);
  if (targetIds.length === 0) {
    return selection;
  }

  if (
    selection.column === targetColumn &&
    selection.taskId !== null &&
    targetIds.includes(selection.taskId)
  ) {
    return selection;
  }

  const sourceIds = getColumnIds(columns, selection.column);
  const sourceIndex = selection.taskId ? sourceIds.indexOf(selection.taskId) : -1;
  const targetIndex = sourceIndex >= 0 ? Math.min(sourceIndex, targetIds.length - 1) : 0;

  return { column: targetColumn, taskId: targetIds[targetIndex] };
}

/**
 * タスクの完了/未完了切り替え直後に、次の選択位置を算出する。
 * 連続消化しやすいように同じインデックス位置（末尾なら1つ上）を選択する。
 */
export function getNextSelectionAfterToggle(
  selection: KeyboardSelection,
  columns: TaskColumns,
  toggledTaskId: string
): KeyboardSelection {
  let targetColumn: ColumnType | null = null;
  if (columns.todoIds.includes(toggledTaskId)) {
    targetColumn = 'todo';
  } else if (columns.doneIds.includes(toggledTaskId)) {
    targetColumn = 'done';
  }

  if (!targetColumn) {
    return resolveSelectionAfterListChange(selection, columns);
  }

  const sourceIds = getColumnIds(columns, targetColumn);
  const removedIndex = sourceIds.indexOf(toggledTaskId);
  const remaining = sourceIds.filter((id) => id !== toggledTaskId);

  if (remaining.length === 0) {
    return { column: targetColumn, taskId: null };
  }

  const nextIndex = Math.min(removedIndex, remaining.length - 1);
  return { column: targetColumn, taskId: remaining[nextIndex] };
}

/**
 * タスク一覧の更新（削除・リセットなど）後に選択状態を整合させる。
 */
export function resolveSelectionAfterListChange(
  selection: KeyboardSelection,
  columns: TaskColumns
): KeyboardSelection {
  if (selection.taskId === null) {
    return selection;
  }

  const currentIds = getColumnIds(columns, selection.column);
  if (currentIds.includes(selection.taskId)) {
    return selection;
  }

  if (currentIds.length > 0) {
    return { column: selection.column, taskId: currentIds[0] };
  }

  return { column: selection.column, taskId: null };
}

/**
 * テキスト入力中の要素かどうかを判定する。
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  return target.isContentEditable;
}
