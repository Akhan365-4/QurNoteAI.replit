import { useState, useCallback } from "react";

export function useDrawings(surahNumber: number) {
  const storageKey = `quran-drawings-${surahNumber}`;

  const [drawings, setDrawings] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as Record<string, string[]>) : {};
    } catch {
      return {};
    }
  });

  const addStroke = useCallback(
    (ayahKey: string, path: string) => {
      setDrawings((prev) => {
        const updated = {
          ...prev,
          [ayahKey]: [...(prev[ayahKey] ?? []), path],
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [storageKey]
  );

  const undoStroke = useCallback(
    (ayahKey: string) => {
      setDrawings((prev) => {
        const strokes = prev[ayahKey] ?? [];
        if (!strokes.length) return prev;
        const updated = { ...prev, [ayahKey]: strokes.slice(0, -1) };
        if (!updated[ayahKey].length) delete updated[ayahKey];
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [storageKey]
  );

  const removeStroke = useCallback(
    (ayahKey: string, index: number) => {
      setDrawings((prev) => {
        const strokes = prev[ayahKey] ?? [];
        const updated = {
          ...prev,
          [ayahKey]: strokes.filter((_, i) => i !== index),
        };
        if (!updated[ayahKey].length) delete updated[ayahKey];
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [storageKey]
  );

  const clearAyahDrawings = useCallback(
    (ayahKey: string) => {
      setDrawings((prev) => {
        const updated = { ...prev };
        delete updated[ayahKey];
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [storageKey]
  );

  const clearAllDrawings = useCallback(() => {
    setDrawings({});
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const hasAnyDrawings = Object.keys(drawings).some(
    (k) => drawings[k].length > 0
  );

  return {
    drawings,
    addStroke,
    undoStroke,
    removeStroke,
    clearAyahDrawings,
    clearAllDrawings,
    hasAnyDrawings,
  };
}
