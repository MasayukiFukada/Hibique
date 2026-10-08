import React from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface TodayCompletionCardProps {
  todayDone: number;
}

export const TodayCompletionCard: React.FC<TodayCompletionCardProps> = ({ todayDone }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#859900]/35 bg-gradient-to-br from-[#fcf8ec] via-[#f7f2e4] to-[#ede5cf] p-6 text-center shadow-xs transition-all duration-300">
      {/* 背景の淡い装飾グロー */}
      <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-[#859900]/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[#b58900]/10 blur-2xl" />

      {/* ── 夜のリラックス ＆ 達成イラスト (SVGアート) ── */}
      <div className="relative mx-auto mb-4 flex h-28 w-28 items-center justify-center">
        {/* イラストコンテナ */}
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full drop-shadow-[0_2px_8px_rgba(181,137,0,0.18)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 背景の柔らかな円盤 */}
          <circle cx="60" cy="60" r="48" fill="#eee8d5" fillOpacity="0.75" />
          <circle cx="60" cy="60" r="46" stroke="#dcd3bc" strokeWidth="1" strokeDasharray="3 3" />

          {/* 三日月 (Crescent Moon) */}
          <path
            d="M50 30C50 47.6731 64.3269 62 82 62C83.743 62 85.4518 61.8596 87.1186 61.5901C83.2104 72.338 72.8465 80 60.5 80C44.7599 80 32 67.2401 32 51.5C32 40.2307 38.5636 30.5054 48.0934 26.0402C49.3364 27.2796 50 28.5835 50 30Z"
            fill="url(#moonGrad)"
          />

          {/* 温かいマグカップ (Cozy Mug) */}
          <rect x="52" y="66" width="28" height="22" rx="4" fill="#073642" />
          {/* マグカップの取っ手 */}
          <path
            d="M80 71C84.4183 71 88 73.6863 88 77C88 80.3137 84.4183 83 80 83"
            stroke="#073642"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* マグカップの湯気 */}
          <path
            d="M59 59C58 56 61 54 60 51"
            stroke="#b58900"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 1"
          />
          <path
            d="M66 58C65 55 68 53 67 50"
            stroke="#859900"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 1"
          />
          <path
            d="M73 59C72 56 75 54 74 51"
            stroke="#b58900"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 1"
          />

          {/* きらめく星々 (Stars & Sparkles) */}
          {/* メインの星 */}
          <path
            d="M78 28L80 34L86 36L80 38L78 44L76 38L70 36L76 34L78 28Z"
            fill="#b58900"
          />
          {/* 小さな星1 */}
          <path
            d="M34 38L35.5 42L39.5 43.5L35.5 45L34 49L32.5 45L28.5 43.5L32.5 42L34 38Z"
            fill="#268bd2"
          />
          {/* 小さな星2 */}
          <circle cx="88" cy="48" r="2" fill="#859900" />
          <circle cx="38" cy="62" r="1.5" fill="#b58900" />
          <circle cx="48" cy="88" r="2" fill="#2aa198" />

          {/* グラデーション定義 */}
          <defs>
            <linearGradient id="moonGrad" x1="32" y1="26" x2="87" y2="80" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f3c642" />
              <stop offset="1" stopColor="#cb4b16" />
            </linearGradient>
          </defs>
        </svg>

        {/* 達成チェックバッジ */}
        <div className="absolute -bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#859900] text-white shadow-sm ring-3 ring-[#fcf8ec]">
          <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
        </div>
      </div>

      {/* ── メッセージ ── */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#859900]/15 px-3 py-1 text-xs font-bold text-[#859900] border border-[#859900]/30 shadow-2xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span>All Done! 本日のタスク完了</span>
        </div>
        <h3 className="text-sm font-bold tracking-tight text-[#073642]">
          今日のルーティーンはすべて完了しました
        </h3>
        <p className="text-xs text-[#657b83]">
          今夜のノルマは完璧に達成されました。どうぞ、ごゆっくり自分の時間をお楽しみください 🌙☕️
        </p>
      </div>

      {/* ── 完了サマリータグ ── */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="rounded-lg bg-[#eee8d5] px-2.5 py-1 text-[11px] font-medium text-[#586e75] border border-[#dcd3bc]">
          本日達成: <strong className="font-bold text-[#859900]">{todayDone}件</strong> (100%)
        </span>
        <span className="text-[11px] text-[#93a1a1]">右側の「完了」エリアに記録されています</span>
      </div>
    </div>
  );
};
