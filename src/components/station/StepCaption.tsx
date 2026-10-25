import { LABEL_FONT } from './style';

// Caption frame in the top-right corner of the schematic, as on docs/img/02–04.
const BOX = { x: 590, y: 14, w: 396 };
const TITLE_SIZE = 21;
const BULLET_SIZE = 15;
const BULLET_INDENT = 24;
/** Average glyph width relative to the font size (Segoe UI / Calibri), for wrapping without measuring. */
const GLYPH = 0.5;

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
  const titleLines = wrapText(title, Math.floor(BOX.w / (TITLE_SIZE * GLYPH)));
  const bulletChars = Math.floor((BOX.w - BULLET_INDENT) / (BULLET_SIZE * GLYPH));
  let y = BOX.y + TITLE_SIZE;
  const title_ = titleLines.map((text) => {
    const el = { text, y };
    y += TITLE_SIZE * 1.25;
    return el;
  });
  y += 10;
  const items = bullets.map((b) => {
    const lines = wrapText(b, bulletChars).map((text) => {
      const el = { text, y };
      y += BULLET_SIZE * 1.3;
      return el;
    });
    y += 8;
    return lines;
  });
  return (
    <g className="step-caption" fontFamily={LABEL_FONT} fill="#111" pointerEvents="none">
      {title_.map((l, i) => (
        <text key={i} x={BOX.x} y={l.y} fontSize={TITLE_SIZE}>
          {l.text}
        </text>
      ))}
      {items.map((lines, i) =>
        lines.map((l, j) => (
          <g key={`${i}-${j}`}>
            {j === 0 && <rect x={BOX.x + 2} y={l.y - 11} width={10} height={10} fill="none" stroke="#111" strokeWidth={1.2} />}
            <text x={BOX.x + BULLET_INDENT} y={l.y} fontSize={BULLET_SIZE}>
              {l.text}
            </text>
          </g>
        )),
      )}
    </g>
  );
}
