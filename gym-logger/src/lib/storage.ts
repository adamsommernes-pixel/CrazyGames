import { useEffect, useState } from 'react';

// Ber nettleseren om varig lagring, så IndexedDB ikke slettes når det blir lite plass
// (eller etter en uke uten bruk i Safari når appen ikke er installert).

export async function requestPersist(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usage: number | null;
}

export async function storageStatus(): Promise<StorageStatus> {
  try {
    if (!navigator.storage?.persisted) return { supported: false, persisted: false, usage: null };
    const [persisted, est] = await Promise.all([navigator.storage.persisted(), navigator.storage.estimate?.()]);
    return { supported: true, persisted, usage: est?.usage ?? null };
  } catch {
    return { supported: false, persisted: false, usage: null };
  }
}

export function useStorageStatus(): [StorageStatus | null, () => Promise<void>] {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const refresh = async () => setStatus(await storageStatus());
  useEffect(() => {
    void refresh();
  }, []);
  return [status, refresh];
}
