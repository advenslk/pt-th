import { useState } from 'react';
import type { TelemetryPoint } from '../../types/panel';

interface TelemetryChartProps {
  data: TelemetryPoint[];
  height?: number;
}

export function TelemetryChart({ data, height = 190 }: TelemetryChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-[#777777] dark:text-zinc-400" style={{ height }}>
        Collecting live resource telemetry...
      </div>
    );
  }

  const width = 640;
  const padX = 28;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const getCoords = (values: number[], maxVal = 100) => {
    return values.map((v, idx) => {
      const x = padX + (idx / Math.max(1, values.length - 1)) * innerW;
      const clamped = Math.max(0, Math.min(maxVal, v));
      const y = padY + innerH - (clamped / maxVal) * innerH;
      return { x, y, val: v };
    });
  };

  const cpuCoords = getCoords(data.map((d) => d.cpu), 100);
  const memCoords = getCoords(data.map((d) => d.memoryPercent), 100);

  const toLinePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const toAreaPath = (pts: { x: number; y: number }[]) => {
    const line = toLinePath(pts);
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${first.x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;
  };

  const activePoint = hoverIdx !== null ? data[hoverIdx] : data[data.length - 1];
  const activeCpu = hoverIdx !== null ? cpuCoords[hoverIdx] : cpuCoords[cpuCoords.length - 1];
  const activeMem = hoverIdx !== null ? memCoords[hoverIdx] : memCoords[memCoords.length - 1];

  return (
    <div className="relative w-full select-none">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6] shadow-[0_1px_4px_rgba(139,92,246,0.5)]" aria-hidden="true" />
            <span className="mx-label-3d text-[#777777] dark:text-zinc-400">CPU Load</span>
            <span className="font-display font-bold tabular-nums text-[#171717] dark:text-zinc-100">
              {activePoint.cpu.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#06B6D4] shadow-[0_1px_4px_rgba(6,182,212,0.5)]" aria-hidden="true" />
            <span className="mx-label-3d text-[#777777] dark:text-zinc-400">Memory Allocation</span>
            <span className="font-display font-bold tabular-nums text-[#171717] dark:text-zinc-100">
              {activePoint.memoryPercent.toFixed(1)}%
            </span>
          </div>
        </div>
        <span className="font-display font-medium text-[11px] tabular-nums text-[#777777] dark:text-zinc-500">
          {activePoint.time}
        </span>
      </div>

      <div className="mx-well-3d p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full overflow-visible"
          style={{ height }}
          onMouseLeave={() => setHoverIdx(null)}
        >
        <defs>
          <linearGradient id="mxCpuGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="mxMemGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padY + innerH - (tick / 100) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                className="stroke-black/[0.06] dark:stroke-white/[0.06]"
                strokeWidth="1"
              />
              <text
                x={0}
                y={y + 3}
                className="fill-[#777777] dark:fill-zinc-500 font-display font-medium text-[9px] tabular-nums"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        <path d={toAreaPath(memCoords)} fill="url(#mxMemGrad)" />
        <path d={toAreaPath(cpuCoords)} fill="url(#mxCpuGrad)" />

        <path
          d={toLinePath(memCoords)}
          fill="none"
          stroke="#06B6D4"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={toLinePath(cpuCoords)}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hoverIdx !== null && (
          <line
            x1={activeCpu.x}
            y1={padY}
            x2={activeCpu.x}
            y2={padY + innerH}
            className="stroke-black/20 dark:stroke-white/20"
            strokeDasharray="3 3"
          />
        )}

        <circle cx={activeMem.x} cy={activeMem.y} r="3.5" fill="#06B6D4" className="stroke-white dark:stroke-[#19191F]" strokeWidth="1.5" />
        <circle cx={activeCpu.x} cy={activeCpu.y} r="3.5" fill="#8B5CF6" className="stroke-white dark:stroke-[#19191F]" strokeWidth="1.5" />

        {data.map((_, idx) => {
          const sliceW = innerW / Math.max(1, data.length - 1);
          const x = padX + idx * sliceW - sliceW / 2;
          return (
            <rect
              key={idx}
              x={Math.max(padX, x)}
              y={padY}
              width={sliceW}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(idx)}
            />
          );
        })}
        </svg>
      </div>
    </div>
  );
}
