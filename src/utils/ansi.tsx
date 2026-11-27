import React from 'react';

export interface AnsiSegment {
  text: string;
  color?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const STANDARD_16: Record<number, string> = {
  30: '#52525B', // readable dark gray on black terminal
  31: '#F87171', // red
  32: '#4ADE80', // green
  33: '#FACC15', // yellow
  34: '#60A5FA', // blue
  35: '#C084FC', // magenta
  36: '#22D3EE', // cyan
  37: '#E4E4E7', // white
  90: '#A1A1AA', // bright black / gray
  91: '#FCA5A5', // bright red
  92: '#86EFAC', // bright green
  93: '#FDE047', // bright yellow
  94: '#93C5FD', // bright blue
  95: '#D8B4FE', // bright magenta
  96: '#67E8F9', // bright cyan
  97: '#FFFFFF', // bright white
};

const BG_16: Record<number, string> = {
  40: '#18181B',
  41: '#991B1B',
  42: '#166534',
  43: '#854D0E',
  44: '#1E40AF',
  45: '#6B21A8',
  46: '#155E75',
  47: '#52525B',
  100: '#3F3F46',
  101: '#DC2626',
  102: '#16A34A',
  103: '#CA8A04',
  104: '#2563EB',
  105: '#9333EA',
  106: '#0891B2',
  107: '#A1A1AA',
};

function ansi256ToHex(n: number): string {
  if (n < 0 || n > 255) return '#E4E4E7';
  if (n < 8) return STANDARD_16[30 + n] || '#E4E4E7';
  if (n < 16) return STANDARD_16[90 + (n - 8)] || '#FFFFFF';
  if (n < 232) {
    const idx = n - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor((idx % 36) / 6);
    const b = idx % 6;
    const toVal = (c: number) => (c === 0 ? 0 : c * 40 + 55);
    return `rgb(${toVal(r)}, ${toVal(g)}, ${toVal(b)})`;
  }
  const gray = (n - 232) * 10 + 8;
  return `rgb(${gray}, ${gray}, ${gray})`;
}

export function cleanControlChars(input: string): string {
  return input
    // Strip OSC sequences (\x1b]...\x07 or \x1b]...\x1b\\)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Strip non-SGR CSI sequences (ending in anything other than 'm')
    .replace(/\x1b\[[0-9;?]*[A-LN-Za-ln-z]/g, '')
    // Keep only last segment after carriage return overwrite if not followed by newline
    .replace(/^.*\r(?!\n)/g, '')
    .replace(/\r/g, '');
}

export function stripAllAnsi(input: string): string {
  return cleanControlChars(input).replace(/\x1b\[[0-9;]*m/g, '');
}

export function parseAnsiSegments(raw: string): AnsiSegment[] {
  const cleaned = cleanControlChars(raw);
  const regex = /\x1b\[([0-9;]*)m/g;
  const segments: AnsiSegment[] = [];

  let state: Omit<AnsiSegment, 'text'> = {};
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: cleaned.slice(lastIndex, match.index), ...state });
    }
    lastIndex = regex.lastIndex;

    const paramsStr = match[1];
    const codes = paramsStr === '' ? [0] : paramsStr.split(';').map((c) => Number(c) || 0);

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === 0) {
        state = {};
      } else if (code === 1) {
        state = { ...state, bold: true };
      } else if (code === 2) {
        state = { ...state, dim: true };
      } else if (code === 3) {
        state = { ...state, italic: true };
      } else if (code === 4) {
        state = { ...state, underline: true };
      } else if (code === 22) {
        state = { ...state, bold: false, dim: false };
      } else if (code === 23) {
        state = { ...state, italic: false };
      } else if (code === 24) {
        state = { ...state, underline: false };
      } else if (code === 39) {
        state = { ...state, color: undefined };
      } else if (code === 49) {
        state = { ...state, bg: undefined };
      } else if (STANDARD_16[code]) {
        state = { ...state, color: STANDARD_16[code] };
      } else if (BG_16[code]) {
        state = { ...state, bg: BG_16[code] };
      } else if (code === 38 || code === 48) {
        const isBg = code === 48;
        const mode = codes[i + 1];
        if (mode === 5 && codes[i + 2] !== undefined) {
          const hex = ansi256ToHex(codes[i + 2]);
          state = isBg ? { ...state, bg: hex } : { ...state, color: hex };
          i += 2;
        } else if (mode === 2 && codes[i + 4] !== undefined) {
          const rgb = `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})`;
          state = isBg ? { ...state, bg: rgb } : { ...state, color: rgb };
          i += 4;
        }
      }
    }
  }

  if (lastIndex < cleaned.length) {
    segments.push({ text: cleaned.slice(lastIndex), ...state });
  }

  return segments;
}

export function AnsiText({ text, fallbackClass }: { text: string; fallbackClass?: string }) {
  const segments = parseAnsiSegments(text);
  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, idx) => {
        const hasStyle = seg.color || seg.bg || seg.bold || seg.dim || seg.italic || seg.underline;
        if (!hasStyle) {
          return (
            <span key={idx} className={fallbackClass}>
              {seg.text}
            </span>
          );
        }
        return (
          <span
            key={idx}
            className={!seg.color ? fallbackClass : undefined}
            style={{
              color: seg.color,
              backgroundColor: seg.bg,
              fontWeight: seg.bold ? 700 : undefined,
              opacity: seg.dim ? 0.65 : undefined,
              fontStyle: seg.italic ? 'italic' : undefined,
              textDecoration: seg.underline ? 'underline' : undefined,
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}
