import { describe, expect, it } from 'vitest';
import { formatCount, formatWagonCount, VEHICLE } from './counters';

describe('formatWagonCount', () => {
  it.each([
    [0, '0 wagonów'],
    [1, '1 wagon'],
    [2, '2 wagony'],
    [4, '4 wagony'],
    [5, '5 wagonów'],
    [8, '8 wagonów'],
    [11, '11 wagonów'],
    [12, '12 wagonów'],
    [14, '14 wagonów'],
    [22, '22 wagony'],
    [25, '25 wagonów'],
    [112, '112 wagonów'],
  ])('%i → %s', (n, text) => {
    expect(formatWagonCount(n)).toBe(text);
  });
});

describe('formatCount', () => {
  it('declines other nouns', () => {
    expect(formatCount(1, VEHICLE)).toBe('1 pojazd');
    expect(formatCount(3, VEHICLE)).toBe('3 pojazdy');
    expect(formatCount(13, VEHICLE)).toBe('13 pojazdów');
  });
});
