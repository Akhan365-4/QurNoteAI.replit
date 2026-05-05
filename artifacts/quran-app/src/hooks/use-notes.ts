import { useState, useCallback } from "react";

const GLOBAL_KEY = "quran-notes";

function loadGlobalNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
    // One-time migration from old per-surah keys
    const merged: Record<string, string> = {};
    for (let n = 1; n <= 114; n++) {
      const old = localStorage.getItem(`quran-notes-${n}`);
      if (old) {
        try {
          Object.assign(merged, JSON.parse(old));
        } catch {}
      }
    }
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return {};
  }
}

export function useNotes(_surahNumber?: number) {
  const [notes, setNotes] = useState<Record<string, string>>(() => loadGlobalNotes());

  const setNote = useCallback((ayahKey: string, text: string) => {
    setNotes((prev) => {
      const updated = { ...prev };
      if (text.trim()) {
        updated[ayahKey] = text;
      } else {
        delete updated[ayahKey];
      }
      try {
        localStorage.setItem(GLOBAL_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  return { notes, setNote };
}
