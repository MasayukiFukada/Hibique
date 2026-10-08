import React from 'react';
import { Sparkles, CheckCheck } from 'lucide-react';

interface ProgressIndicatorProps {
  todayDone: number;
  todayTotal: number;
  progressPercent: number;
  isTodayAllDone: boolean;
  totalCompletedCount: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  todayDone,
  todayTotal,
  progressPercent,
  isTodayAllDone,
  totalCompletedCount,
}) => {
  const size = 50;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // 進捗率に応じたグラデーションの定義
  const getGradientStops = () => {
    if (isTodayAllDone) {
      // 100% 達成時: エメラルドグリーンからゴールド/アンバーへの祝祭グラデーション
      return (
        <>
          <stop offset="0%" stopColor="#859900" />
          <stop offset="100%" stopColor="#b58900" />
        </>
      );
    }
    if (progressPercent >= 70) {
      // 70%以上: スカイブルーからエメラルドグリーンへ
      return (
        <>
          <stop offset="0%" stopColor="#268bd2" />
          <stop offset="100%" stopColor="#859900" />
        </>
      );
    }
    if (progressPercent >= 30) {
      // 30%〜69%: シアンからスカイブルーへ
      return (
        <>
          <stop offset="0%" stopColor="#2aa198" />
          <stop offset="100%" stopColor="#268bd2" />
        </>
      );
    }
    // 0%〜29%: 静かなティールからシアンへ
    return (
      <>
        <stop offset="0%" stopColor="#586e75" />
        <stop offset="100%" stopColor="#2aa198" />
      </>
    );
  };

  return (
    <div
      className={`flex items-center gap-3.5 px-3.5 py-1.5 rounded-2xl border transition-all duration-300 ${
        isTodayAllDone
          ? 'bg-gradient-to-r from-[#eee8d5] via-[#f9f5ea] to-[#eee8d5] border-[#859900]/40 shadow-xs'
          : 'bg-[#eee8d5]/80 border-[#dcd3bc]'
      }`}
    >
      {/* 円形リングインジケーター */}
      <div className="relative flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className={`transform -rotate-90 ${
            isTodayAllDone ? 'filter drop-shadow-[0_0_6px_rgba(133,153,0,0.35)]' : ''
          }`}
        >
          <defs>
            <linearGradient id="headerProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              {getGradientStops()}
            </linearGradient>
          </defs>
          {/* 背景のサークル */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#dfd6be"
            strokeWidth={strokeWidth}
          />
          {/* プログレスサークル */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="url(#headerProgressGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* リング中央のアイコン / パーセント */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isTodayAllDone ? (
            <div className="flex items-center justify-center text-[#859900]">
              <CheckCheck className="w-4 h-4 stroke-[2.5]" />
            </div>
          ) : (
            <span className="text-[11px] font-bold tracking-tight text-[#073642]">
              {progressPercent}%
            </span>
          )}
        </div>
      </div>

      {/* テキスト情報 */}
      <div className="text-right">
        <div className="text-[11px] font-medium text-[#839496] flex items-center justify-end gap-1">
          <span>本日のノルマ</span>
          {isTodayAllDone && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#859900] font-bold bg-[#859900]/10 px-1.5 py-0.5 rounded-full border border-[#859900]/30 animate-pulse">
              <Sparkles className="w-2.5 h-2.5" />
              達成！
            </span>
          )}
        </div>
        <div className="text-xs font-bold text-[#073642] flex items-center justify-end gap-1">
          <span className={isTodayAllDone ? 'text-[#859900]' : 'text-[#268bd2]'}>
            {todayDone} / {todayTotal}
          </span>
          <span className="text-[10px] font-normal text-[#657b83]">完了</span>
          {totalCompletedCount > todayDone && (
            <span
              className="text-[10px] text-[#93a1a1] ml-0.5 font-normal"
              title={`いつでもタスク・月次など今日枠外の消化タスクを含む合計: ${totalCompletedCount}件完了`}
            >
              (全{totalCompletedCount})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
