import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeadlineStatus, sanitizeUrl } from './deadline.ts';

test('getDeadlineStatus returns null if deadline is not provided', () => {
  assert.equal(getDeadlineStatus(undefined, '2026-11-01'), null);
  assert.equal(getDeadlineStatus('', '2026-11-01'), null);
});

test('getDeadlineStatus correctly calculates normal upcoming deadline', () => {
  const result = getDeadlineStatus('2026-11-20', '2026-11-01');
  assert.ok(result);
  assert.equal(result.remainingDays, 19);
  assert.equal(result.label, '11/20 (あと19日)');
  assert.equal(result.isApproaching, false);
  assert.equal(result.isToday, false);
  assert.equal(result.isOverdue, false);
});

test('getDeadlineStatus correctly identifies approaching deadline (<= 3 days)', () => {
  const result = getDeadlineStatus('2026-11-04', '2026-11-01');
  assert.ok(result);
  assert.equal(result.remainingDays, 3);
  assert.equal(result.label, '11/4 (あと3日)');
  assert.equal(result.isApproaching, true);
  assert.equal(result.isToday, false);
  assert.equal(result.isOverdue, false);
});

test('getDeadlineStatus correctly identifies today deadline', () => {
  const result = getDeadlineStatus('2026-11-01', '2026-11-01');
  assert.ok(result);
  assert.equal(result.remainingDays, 0);
  assert.equal(result.label, '本日締切!');
  assert.equal(result.isApproaching, false);
  assert.equal(result.isToday, true);
  assert.equal(result.isOverdue, false);
});

test('getDeadlineStatus correctly identifies overdue deadline', () => {
  const result = getDeadlineStatus('2026-10-31', '2026-11-01');
  assert.ok(result);
  assert.equal(result.remainingDays, -1);
  assert.equal(result.label, '期限終了');
  assert.equal(result.isApproaching, false);
  assert.equal(result.isToday, false);
  assert.equal(result.isOverdue, true);
});

test('sanitizeUrl handles valid URLs and prepends https:// if missing', () => {
  assert.equal(sanitizeUrl(undefined), undefined);
  assert.equal(sanitizeUrl(''), undefined);
  assert.equal(sanitizeUrl('   '), undefined);
  assert.equal(sanitizeUrl('https://example.com/test'), 'https://example.com/test');
  assert.equal(sanitizeUrl('http://example.com'), 'http://example.com');
  assert.equal(sanitizeUrl('example.com/project'), 'https://example.com/project');
});
