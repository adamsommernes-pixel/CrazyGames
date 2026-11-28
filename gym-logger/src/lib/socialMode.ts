import { setSetting, useSetting } from './settings';

// Kontotype: «trening» (appen som før) eller «sosial» (Sosialt-fanen tar plassen til Historikk,
// og Historikk flyttes inn under Fremgang). Alt som avhenger av kontotypen leser herfra, så
// lagringen kan flyttes (f.eks. til profilen, så den følger kontoen) uten å endre resten av appen.

export const useSocialMode = (): boolean => useSetting('socialMode');

export const setSocialMode = (on: boolean) => setSetting('socialMode', on);
