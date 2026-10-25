import { useId } from 'react';
import { ACCENT, GLYPH_WIDTH, LABEL_FONT, NAVY } from './style';

// Caption frame in the top-right corner of the schematic, as on docs/img/02–04 (slide style).
const BOX = { x: 596, y: 22, w: 380 };
const PAD = { x: 16, top: 14, bottom: 10 };
const ACCENT_BAR = 4;
const TITLE_SIZE = 20;
const BULLET_SIZE = 14.5;
const BULLET_INDENT = 22;

/** Greedy word wrap to lines of at most `maxChars` characters. */
function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

export function StepCaption({ title, bullets }: { title: string; bullets: string[] }) {
  const clipId = `caption${useId().replace(/:/g, '')}`;
  const titleLines = wrapText(title, Math.floor(BOX.w / (TITLE_SIZE * GLYPH_WIDTH)));
  const bulletChars = Math.floor((BOX.w - BULLET_INDENT) / (BULLET_SIZE * GLYPH_WIDTH));
  let y = BOX.y + TITLE_SIZE;
  const title_ = titleLines.map((text) => {
    const el = { text, y };
    y += TITLE_SIZE * 1.25;
    return el;
  });
  y += 8;
  const items = bullets.map((b) => {
    const lines = wrapText(b, bulletChars).map((text) => {
      const el = { text, y };
      y += BULLET_SIZE * 1.35;
      return el;
    });
    y += 6;
    return lines;
  });
  const frame = { x: BOX.x - PAD.x, y: BOX.y - PAD.top, w: BOX.w + 2 * PAD.x, h: y - BOX.y + PAD.top + PAD.bottom - BULLET_SIZE };
  return (
    // Keyed by the title in the parent: a new step remounts the group and replays the fade-in.
    <g className="step-caption" fontFamily={LABEL_FONT} fill="#111827" pointerEvents="none">
      <rect x={frame.x + 1.5} y={frame.y + 3} width={frame.w} height={frame.h} rx={8} fill="#0b1b2b" opacity={0.08} />
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={8} fill="#ffffff" stroke="#dde3ea" strokeWidth={1} />
      <clipPath id={clipId}>
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={8} />
      </clipPath>
      <rect x={frame.x} y={frame.y} width={ACCENT_BAR} height={frame.h} fill={ACCENT} clipPath={`url(#${clipId})`} />
      {title_.map((l, i) => (
        <text key={i} x={BOX.x} y={l.y} fontSize={TITLE_SIZE} fontWeight={700} fill={NAVY}>
          {l.text}
        </text>
      ))}
      {items.map((lines, i) =>
        lines.map((l, j) => (
          <g key={`${i}-${j}`}>
            {j === 0 && <rect x={BOX.x + 2} y={l.y - 9.5} width={9} height={9} rx={2} fill="none" stroke={NAVY} strokeWidth={1.4} />}
            <text x={BOX.x + BULLET_INDENT} y={l.y} fontSize={BULLET_SIZE} fill="#334155">
              {l.text}
            </text>
          </g>
        )),
      )}
    </g>
  );
}
