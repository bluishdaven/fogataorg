"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraft } from "@/app/actions/stories";

/**
 * Saves the story a moment after the writer stops typing. Every change is also
 * kept in localStorage, so nothing is lost offline or if the tab closes; saving
 * retries when the connection comes back. Saves carry the revision they started
 * from, so a stale tab can't overwrite newer work (that shows as "conflict").
 */

export type SaveStatus = "saved" | "unsaved" | "saving" | "offline" | "error" | "conflict";

export type Snapshot = { title: string; subtitle: string; content: unknown };

type LocalBackup = Snapshot & { revision: number; at: number };

const DEBOUNCE_MS = 1200;
const RETRY_MS = 5000;

export function backupKey(storyId: string) {
  return `fogata:draft:${storyId}`;
}

export function readBackup(storyId: string): LocalBackup | null {
  try {
    const raw = window.localStorage.getItem(backupKey(storyId));
    return raw ? (JSON.parse(raw) as LocalBackup) : null;
  } catch {
    return null;
  }
}

function writeBackup(storyId: string, backup: LocalBackup) {
  try {
    window.localStorage.setItem(backupKey(storyId), JSON.stringify(backup));
  } catch {
    // Storage full or blocked: the server save still runs.
  }
}

function clearBackup(storyId: string) {
  try {
    window.localStorage.removeItem(backupKey(storyId));
  } catch {
    // Ignore.
  }
}

export function useAutosave({
  storyId,
  initialRevision,
  getSnapshot,
}: {
  storyId: string;
  initialRevision: number;
  getSnapshot: () => Snapshot;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const revision = useRef(initialRevision);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef(false);
  const dirty = useRef(false);
  const snapshotRef = useRef(getSnapshot);
  // save() re-schedules itself; going through a ref avoids a self-reference.
  const saveRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    snapshotRef.current = getSnapshot;
  }, [getSnapshot]);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (inflight.current || !dirty.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    inflight.current = true;
    dirty.current = false;
    setStatus("saving");
    const snapshot = snapshotRef.current();
    try {
      const result = await saveDraft({ id: storyId, revision: revision.current, ...snapshot });
      if (result.ok) {
        revision.current = result.revision;
        setSavedAt(new Date(result.savedAt));
        if (dirty.current) {
          setStatus("unsaved");
          timer.current = setTimeout(() => void saveRef.current(), DEBOUNCE_MS);
        } else {
          clearBackup(storyId);
          setStatus("saved");
        }
      } else if (result.error === "conflict") {
        setStatus("conflict");
      } else {
        dirty.current = true;
        setStatus("error");
        if (result.error !== "unauthorized" && result.error !== "not_found") {
          timer.current = setTimeout(() => void saveRef.current(), RETRY_MS);
        }
      }
    } catch {
      dirty.current = true;
      setStatus(navigator.onLine ? "error" : "offline");
      timer.current = setTimeout(() => void saveRef.current(), RETRY_MS);
    } finally {
      inflight.current = false;
    }
  }, [storyId]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  /** Call on every edit. */
  const markChanged = useCallback(() => {
    dirty.current = true;
    writeBackup(storyId, { ...snapshotRef.current(), revision: revision.current, at: Date.now() });
    setStatus((current) => (current === "conflict" ? current : navigator.onLine ? "unsaved" : "offline"));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
  }, [save, storyId]);

  useEffect(() => {
    const online = () => {
      if (dirty.current) void save();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) event.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
      clearTimeout(timer.current);
    };
  }, [save]);

  return {
    status,
    savedAt,
    markChanged,
    /** Save now (e.g. before opening the publish dialog). Resolves when idle. */
    flush: async () => {
      await save();
      while (inflight.current) await new Promise((resolve) => setTimeout(resolve, 50));
    },
    revision,
  };
}
