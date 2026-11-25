"use client";

import { useEffect, useState } from "react";
import { getRepository } from "./client";
import type { SalonRepository } from "./types";

/**
 * Load data from the repository and reload whenever it changes.
 * `key` identifies the query; change it to refetch with new arguments.
 */
export function useRepoQuery<T>(key: string, load: (repo: SalonRepository) => Promise<T>): T | undefined {
  const [result, setResult] = useState<{ key: string; version: number; data: T } | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => getRepository().subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let alive = true;
    load(getRepository()).then((data) => {
      if (alive) setResult({ key, version, data });
    });
    return () => {
      alive = false;
    };
    // `load` is recreated every render; `key` captures its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return result?.key === key ? result.data : undefined;
}

