import { useState, useCallback } from "react";

export interface Stroke {
  d: string;
  color: string;
}

type DrawingsMap = Record<string, Stroke[]>;

function migrateAndParse(raw: string): DrawingsMap {
  const parsed = JSON.parse(raw) as Record<string, (string | Stroke)[]>;
  const migrated: DrawingsMap = {};
  for (const key of Object.keys(parsed)) {
    migrated[key] = (parsed[key] ?? []).map((s) =>
      typeof s === "string" ? { d: s, color: "#ef4444" } : s
    );
  }
  return migrated;
}

export function useDrawings(surahNumber: number) {
  const storageKey = `quran-drawings-${surahNumber}`;

  const [drawings, setDrawings] = useState<DrawingsMap>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? migrateAndParse(stored) : {};
    } catch {
      return {};
    }
  });

  const addStroke = useCallback(
    (ayahKey: string, path: string, color: string) => {
      setDrawings((prev) => {
        const updated: DrawingsMap = {
          ...prev,
          [ayahKey]: [...(prev[ayahKey] ?? []), { d: path, color }],
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
        const updated: DrawingsMap = { ...prev, [ayahKey]: strokes.slice(0, -1) };
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
        const updated: DrawingsMap = {
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
