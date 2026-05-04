import { useState, useCallback } from "react";

export function useNotes(surahNumber: number) {
  const storageKey = `quran-notes-${surahNumber}`;

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  const setNote = useCallback(
    (ayahKey: string, text: string) => {
      setNotes((prev) => {
        const updated = { ...prev };
        if (text.trim()) {
          updated[ayahKey] = text;
        } else {
          delete updated[ayahKey];
        }
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [storageKey]
  );

  return { notes, setNote };
}
