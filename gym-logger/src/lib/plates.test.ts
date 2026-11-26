import { describe, expect, it } from 'vitest';
import { platesPerSide } from './plates';

describe('platesPerSide', () => {
  it('100 kg på 20 kg-stang', () => expect(platesPerSide(100).perSide).toEqual([25, 15]));
  it('62,5 kg', () => expect(platesPerSide(62.5).perSide).toEqual([20, 1.25]));
  it('bare stang', () => expect(platesPerSide(20)).toEqual({ perSide: [], remainder: 0, achieved: 20 }));
  it('lettere enn stanga', () => expect(platesPerSide(10).perSide).toEqual([]));
  it('rest når skivene ikke går opp', () => {
    const r = platesPerSide(21, 20);
    expect(r.perSide).toEqual([]);
    expect(r.remainder).toBe(1);
  });
  it('egen stang og skiver', () => expect(platesPerSide(55, 15, [10, 5]).perSide).toEqual([10, 10]));
});
