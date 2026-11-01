/**
 * 期限ステータスの型定義
 */
export interface DeadlineStatus {
  formattedDeadline: string; // e.g. "11/20"
  remainingDays: number; // 残り日数 (負の値は期限切れ)
  label: string; // 表示ラベル
  badgeClass: string; // バッジのスタイル
  isOverdue: boolean; // 期限切れかどうか
  isToday: boolean; // 本日が締切日かどうか
  isApproaching: boolean; // 3日以内の締切接近中かどうか
}

/**
 * 期限ステータスを計算する純粋関数
 * @param deadline "YYYY-MM-DD" 形式の期限日文字列
 * @param referenceDateStr "YYYY-MM-DD" 形式の論理基準日文字列
 */
export function getDeadlineStatus(
  deadline: string | undefined,
  referenceDateStr: string
): DeadlineStatus | null {
  if (!deadline) return null;

  // YYYY-MM-DD のパース（タイムゾーンの影響を排除するため日付部分を数値分解）
  const [dYear, dMonth, dDay] = deadline.split('-').map(Number);
  const [rYear, rMonth, rDay] = referenceDateStr.split('-').map(Number);

  if (!dYear || !dMonth || !dDay || !rYear || !rMonth || !rDay) {
    return null;
  }

  const deadlineUtc = Date.UTC(dYear, dMonth - 1, dDay);
  const referenceUtc = Date.UTC(rYear, rMonth - 1, rDay);

  const diffMs = deadlineUtc - referenceUtc;
  const remainingDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const formattedDeadline = `${dMonth}/${dDay}`;

  if (remainingDays < 0) {
    return {
      formattedDeadline,
      remainingDays,
      label: '期限終了',
      badgeClass: 'bg-[#eee8d5] text-[#839496] border-[#dcd3bc] font-medium opacity-80',
      isOverdue: true,
      isToday: false,
      isApproaching: false,
    };
  }

  if (remainingDays === 0) {
    return {
      formattedDeadline,
      remainingDays,
      label: '本日締切!',
      badgeClass: 'bg-rose-500 text-white border-rose-600 font-bold shadow-2xs animate-pulse',
      isOverdue: false,
      isToday: true,
      isApproaching: false,
    };
  }

  if (remainingDays <= 3) {
    return {
      formattedDeadline,
      remainingDays,
      label: `${formattedDeadline} (あと${remainingDays}日)`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold ring-1 ring-amber-400/40 shadow-2xs',
      isOverdue: false,
      isToday: false,
      isApproaching: true,
    };
  }

  return {
    formattedDeadline,
    remainingDays,
    label: `${formattedDeadline} (あと${remainingDays}日)`,
    badgeClass: 'bg-[#eee8d5] text-[#586e75] border-[#dcd3bc] font-medium',
    isOverdue: false,
    isToday: false,
    isApproaching: false,
  };
}

/**
 * URLを安全な形式（http:// または https://）に整形・検証する
 */
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // スキームがない場合は https:// を補完
  return `https://${trimmed}`;
}

/**
 * 外部ブラウザでURLを開く
 * Tauri環境ではネイティブコマンド open_external_url を呼び出し、
 * ブラウザ環境では window.open にフォールバックする
 */
export async function openExternalUrl(url: string | undefined): Promise<void> {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return;

  try {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_external_url', { url: sanitized });
      return;
    }
  } catch (error) {
    console.warn('Failed to open URL via Tauri invoke, falling back to window.open', error);
  }

  if (typeof window !== 'undefined') {
    window.open(sanitized, '_blank', 'noopener,noreferrer');
  }
}
