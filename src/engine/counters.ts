/** Word forms for Polish counting: [1, 2–4, 5+] — e.g. ['wagon', 'wagony', 'wagonów']. */
export type PluralForms = readonly [one: string, few: string, many: string];

export const WAGON: PluralForms = ['wagon', 'wagony', 'wagonów'];
export const VEHICLE: PluralForms = ['pojazd', 'pojazdy', 'pojazdów'];

/** Polish plural: 1 wagon, 2–4 wagony, 5+ wagonów, 12–14 wagonów, 22 wagony. */
export function formatCount(n: number, forms: PluralForms): string {
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  let word: string;
  if (n === 1) word = forms[0];
  else if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) word = forms[1];
  else word = forms[2];
  return `${n} ${word}`;
}

export const formatWagonCount = (n: number): string => formatCount(n, WAGON);
