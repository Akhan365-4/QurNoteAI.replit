import { useState, useCallback } from "react";

export interface Stroke {
  d: string;
  color: string;
}

type DrawingsMap = Record<string, Stroke[]>;

const GLOBAL_KEY = "quran-drawings";

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

function loadGlobalDrawings(): DrawingsMap {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY);
    if (raw) return migrateAndParse(raw);
    // One-time migration from old per-surah keys
    const merged: DrawingsMap = {};
    for (let n = 1; n <= 114; n++) {
      const old = localStorage.getItem(`quran-drawings-${n}`);
      if (old) {
        try {
          Object.assign(merged, migrateAndParse(old));
        } catch {}
      }
    }
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return {};
  }
}

export function useDrawings(surahNumber: number) {
  const [drawings, setDrawings] = useState<DrawingsMap>(() => loadGlobalDrawings());

  const save = (updated: DrawingsMap) => {
    try {
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(updated));
    } catch {}
  };

  const addStroke = useCallback(
    (ayahKey: string, path: string, color: string) => {
      setDrawings((prev) => {
        const updated: DrawingsMap = {
          ...prev,
          [ayahKey]: [...(prev[ayahKey] ?? []), { d: path, color }],
        };
        save(updated);
        return updated;
      });
    },
    []
  );

  const undoStroke = useCallback((ayahKey: string) => {
    setDrawings((prev) => {
      const strokes = prev[ayahKey] ?? [];
      if (!strokes.length) return prev;
      const updated: DrawingsMap = { ...prev, [ayahKey]: strokes.slice(0, -1) };
      if (!updated[ayahKey].length) delete updated[ayahKey];
      save(updated);
      return updated;
    });
  }, []);

  const removeStroke = useCallback((ayahKey: string, index: number) => {
    setDrawings((prev) => {
      const strokes = prev[ayahKey] ?? [];
      const updated: DrawingsMap = {
        ...prev,
        [ayahKey]: strokes.filter((_, i) => i !== index),
      };
      if (!updated[ayahKey].length) delete updated[ayahKey];
      save(updated);
      return updated;
    });
  }, []);

  const clearAyahDrawings = useCallback((ayahKey: string) => {
    setDrawings((prev) => {
      const updated = { ...prev };
      delete updated[ayahKey];
      save(updated);
      return updated;
    });
  }, []);

  // Clears only the current surah's drawings
  const clearAllDrawings = useCallback(() => {
    setDrawings((prev) => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        if (key.startsWith(`${surahNumber}-`)) delete updated[key];
      }
      save(updated);
      return updated;
    });
  }, [surahNumber]);

  const hasAnyDrawings = Object.keys(drawings).some(
    (k) => k.startsWith(`${surahNumber}-`) && (drawings[k]?.length ?? 0) > 0
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
