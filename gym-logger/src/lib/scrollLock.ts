// Låser sidescrolling mens et ark er åpent. Teller låsene, så flere ark oppå hverandre
// (f.eks. øvelsesvelger + øvelsesinfo) ikke etterlater siden låst når de lukkes i en annen rekkefølge.

let locks = 0;

export function lockScroll() {
  locks++;
  document.body.style.overflow = 'hidden';
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.body.style.overflow = '';
}

/** Sikkerhetsnett: frigjør låsen hvis ingen ark faktisk er åpne. */
export function releaseStaleScrollLock() {
  if (!document.querySelector('[aria-modal="true"]')) {
    locks = 0;
    document.body.style.overflow = '';
  }
}
