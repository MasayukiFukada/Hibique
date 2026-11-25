import test from 'node:test';
import assert from 'node:assert/strict';
import {
  moveVertical,
  moveColumn,
  getNextSelectionAfterToggle,
  resolveSelectionAfterListChange,
  type TaskColumns,
} from './keyboardNavigation.ts';

const sampleColumns: TaskColumns = {
  todoIds: ['t1', 't2', 't3'],
  doneIds: ['d1', 'd2'],
};

test('moveVertical selects first on down and last on up when unselected', () => {
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: null }, sampleColumns, 1),
    { column: 'todo', taskId: 't1' }
  );
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: null }, sampleColumns, -1),
    { column: 'todo', taskId: 't3' }
  );
});

test('moveVertical moves within column and clamps at boundaries', () => {
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: 't1' }, sampleColumns, 1),
    { column: 'todo', taskId: 't2' }
  );
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: 't3' }, sampleColumns, 1),
    { column: 'todo', taskId: 't3' }
  );
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: 't1' }, sampleColumns, -1),
    { column: 'todo', taskId: 't1' }
  );
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: 't3' }, sampleColumns, -1),
    { column: 'todo', taskId: 't2' }
  );
});

test('moveVertical falls back to the other column when current column is empty', () => {
  const onlyDone: TaskColumns = { todoIds: [], doneIds: ['d1', 'd2'] };
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: null }, onlyDone, 1),
    { column: 'done', taskId: 'd1' }
  );
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: null }, onlyDone, -1),
    { column: 'done', taskId: 'd2' }
  );
});

test('moveVertical returns null taskId when both columns are empty', () => {
  const emptyColumns: TaskColumns = { todoIds: [], doneIds: [] };
  assert.deepEqual(
    moveVertical({ column: 'todo', taskId: null }, emptyColumns, 1),
    { column: 'todo', taskId: null }
  );
});

test('moveColumn switches columns preserving index and clamping to target length', () => {
  // index 0 -> index 0
  assert.deepEqual(
    moveColumn({ column: 'todo', taskId: 't1' }, sampleColumns, 'done'),
    { column: 'done', taskId: 'd1' }
  );
  // index 2 -> clamped to index 1
  assert.deepEqual(
    moveColumn({ column: 'todo', taskId: 't3' }, sampleColumns, 'done'),
    { column: 'done', taskId: 'd2' }
  );
  // done index 1 -> todo index 1
  assert.deepEqual(
    moveColumn({ column: 'done', taskId: 'd2' }, sampleColumns, 'todo'),
    { column: 'todo', taskId: 't2' }
  );
});

test('moveColumn keeps current selection if target column is empty or already focused', () => {
  const emptyDone: TaskColumns = { todoIds: ['t1', 't2'], doneIds: [] };
  assert.deepEqual(
    moveColumn({ column: 'todo', taskId: 't2' }, emptyDone, 'done'),
    { column: 'todo', taskId: 't2' }
  );
  assert.deepEqual(
    moveColumn({ column: 'todo', taskId: 't2' }, sampleColumns, 'todo'),
    { column: 'todo', taskId: 't2' }
  );
  assert.deepEqual(
    moveColumn({ column: 'todo', taskId: null }, sampleColumns, 'done'),
    { column: 'done', taskId: 'd1' }
  );
});

test('getNextSelectionAfterToggle advances to next item or steps back from tail', () => {
  // first item toggled -> second becomes first
  assert.deepEqual(
    getNextSelectionAfterToggle({ column: 'todo', taskId: 't1' }, sampleColumns, 't1'),
    { column: 'todo', taskId: 't2' }
  );
  // middle item toggled -> third takes middle position
  assert.deepEqual(
    getNextSelectionAfterToggle({ column: 'todo', taskId: 't2' }, sampleColumns, 't2'),
    { column: 'todo', taskId: 't3' }
  );
  // tail item toggled -> steps back to previous item
  assert.deepEqual(
    getNextSelectionAfterToggle({ column: 'todo', taskId: 't3' }, sampleColumns, 't3'),
    { column: 'todo', taskId: 't2' }
  );
  // last remaining item toggled -> null
  assert.deepEqual(
    getNextSelectionAfterToggle(
      { column: 'done', taskId: 'd1' },
      { todoIds: ['t1'], doneIds: ['d1'] },
      'd1'
    ),
    { column: 'done', taskId: null }
  );
});

test('resolveSelectionAfterListChange keeps valid or null selection and normalizes missing ids', () => {
  assert.deepEqual(
    resolveSelectionAfterListChange({ column: 'todo', taskId: null }, sampleColumns),
    { column: 'todo', taskId: null }
  );
  assert.deepEqual(
    resolveSelectionAfterListChange({ column: 'todo', taskId: 't2' }, sampleColumns),
    { column: 'todo', taskId: 't2' }
  );
  assert.deepEqual(
    resolveSelectionAfterListChange(
      { column: 'todo', taskId: 'deleted-id' },
      sampleColumns
    ),
    { column: 'todo', taskId: 't1' }
  );
  assert.deepEqual(
    resolveSelectionAfterListChange(
      { column: 'todo', taskId: 'deleted-id' },
      { todoIds: [], doneIds: ['d1'] }
    ),
    { column: 'todo', taskId: null }
  );
});
