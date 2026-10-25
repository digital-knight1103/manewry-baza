import { describe, expect, it } from 'vitest';
import { formatWagonCount } from './counters';

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
