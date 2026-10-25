/** Polish plural form for wagon counts: 1 wagon, 2–4 wagony, 5+ wagonów, 12–14 wagonów. */
export function formatWagonCount(n: number): string {
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  let word: string;
  if (n === 1) word = 'wagon';
  else if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) word = 'wagony';
  else word = 'wagonów';
  return `${n} ${word}`;
}
