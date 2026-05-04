import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "quran-mistakes";

export function useMistakes() {
  const [mistakes, setMistakes] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value) {
        try {
          setMistakes(new Set(JSON.parse(value)));
        } catch {
          setMistakes(new Set());
        }
      }
      setLoaded(true);
    });
  }, []);

  const toggleMistake = useCallback((wordId: string) => {
    setMistakes((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setMistakes(new Set());
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }, []);

  return { mistakes, toggleMistake, clearAll, mistakeCount: mistakes.size, loaded };
}
