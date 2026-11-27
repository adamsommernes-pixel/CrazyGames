import { describe, expect, it } from 'vitest';
import { setAudioMode, unlockAudio } from './restTimer';

describe('lydmodus på iPhone', () => {
  it('bruker «ambient» så musikk fortsetter, aldri «playback»', () => {
    const session = { type: 'auto' };
    Object.defineProperty(globalThis, 'navigator', { value: { audioSession: session }, configurable: true });
    unlockAudio();
    expect(session.type).toBe('ambient');
    setAudioMode('transient');
    expect(session.type).toBe('transient');
  });
});
