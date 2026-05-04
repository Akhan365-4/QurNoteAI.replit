import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "quran-mistakes";

export function useMistakes() {
  const [mistakes, setMistakes] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setMistakes(new Set(parsed));
      }
    } catch (e) {
      console.error("Failed to load mistakes from local storage", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const toggleMistake = useCallback((id: string) => {
    setMistakes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error("Failed to save mistakes to local storage", e);
      }
      
      return next;
    });
  }, []);

  const clearMistakes = useCallback(() => {
    setMistakes(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { mistakes, toggleMistake, clearMistakes, isLoaded };
}
