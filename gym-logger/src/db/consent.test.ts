import { describe, expect, it } from 'vitest';
import { cloudPayload, keepLocalSensitive } from './consent';

const profile: Record<string, unknown> = { id: 'u1', updated_at: 'x', deleted: 0, name: 'Ola', bodyweight_kg: 80, height_cm: 180, birth_year: 1990, sex: 'male' };

describe('health data consent', () => {
  it('sends everything with consent', () => {
    expect(cloudPayload('profiles', { ...profile }, true)).toMatchObject({ bodyweight_kg: 80, sex: 'male' });
    expect(cloudPayload('bodyweights', { id: 'b', updated_at: 'x', deleted: 0, weight_kg: 80 }, true)).not.toBeNull();
  });

  it('without consent: no bodyweight log, and the profile goes without body data', () => {
    expect(cloudPayload('bodyweights', { id: 'b', updated_at: 'x', deleted: 0, weight_kg: 80 }, false)).toBeNull();
    const p = cloudPayload('profiles', { ...profile }, false)!;
    expect(p).toMatchObject({ name: 'Ola', bodyweight_kg: null, height_cm: null, birth_year: null, sex: null });
    expect(cloudPayload('sets', { id: 's', updated_at: 'x', deleted: 0, weight: 100 }, false)).toMatchObject({ weight: 100 });
  });

  it('keeps local body data when a profile without it comes back from the cloud', () => {
    const remote: Record<string, unknown> = { ...profile, name: 'Ola N', bodyweight_kg: null, height_cm: null, birth_year: null, sex: null };
    expect(keepLocalSensitive(remote, { ...profile }, false)).toMatchObject({ name: 'Ola N', bodyweight_kg: 80, sex: 'male' });
    expect(keepLocalSensitive(remote, { ...profile }, true)).toMatchObject({ bodyweight_kg: null });
  });
});
