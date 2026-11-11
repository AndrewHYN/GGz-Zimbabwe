"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Result<T> =
  | { key: string; data: T; error?: never }
  | { key: string; data?: never; error: unknown };

export function useDiscovery<T>(path: string | null) {
  const [result, setResult] = useState<Result<T>>();
  const [attempt, setAttempt] = useState(0);
  const key = path === null ? null : attempt + ":" + path;

  useEffect(() => {
    if (path === null || key === null) return;
    const controller = new AbortController();
    apiFetch<T>(path, { signal: controller.signal })
      .then((data) => {
        if (data == null) throw new Error("The discovery service returned an empty response.");
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, error });
      });
    return () => controller.abort();
  }, [key, path]);

  const current = result?.key === key ? result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: key !== null && !current,
    retry: () => setAttempt((value) => value + 1),
  };
}

export interface PublicOrganization {
  id: number;
  name: string;
  slug: string;
  description: string;
  type: string;
  logo: string | null;
  verified: boolean;
  location: string;
}
