import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useSurahList, type SurahBase, type Ayah, type PageSection } from "@/hooks/use-quran";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { JUZ_DATA } from "@/data/juz";
import { QURAN_TOTAL_PAGES } from "@/data/page-to-surah";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Mic, MicOff, Square, RotateCcw, CheckCircle2,
  XCircle, BookOpen, FileText, BookMarked, Bookmark, AlertCircle,
  ChevronDown, Loader2,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

type ScopeType = "surah" | "page" | "juz" | "verse";
type Phase = "setup" | "testing" | "done";
type WordStatus = "correct" | "mistake";

interface TestWord {
  id: string;
  text: string;
  surahNum: number;
  ayahNum: number;
  wordIdx: number;
}

interface SurahDetailsData extends SurahBase {
  ayahs: Ayah[];
}

// ─── arabic normalisation ──────────────────────────────────────────────────────

/**
 * Aggressively normalise an Arabic word so that Uthmani-script spellings and
 * speech-recogniser output can be compared fairly.
 *
 * Key differences handled:
 *  - All tashkeel / diacritics / Quranic annotations stripped
 *  - Every alef variant (آأإٱٲٳٵ) → bare alef (ا)
 *  - Alef maqsura (ى) → ya (ي)
 *  - Ta marbuta (ة) → ha (ه)
 *  - Waw with hamza (ؤ) → waw (و)
 *  - Ya with hamza (ئ) → ya (ي)
 *  - Tatweel (ـ) stripped
 *  - Common Uthmani "waw" vowel spellings (e.g. الصلوة → الصله after further
 *    normalisation) will naturally be within edit-distance tolerance
 */
function normalizeArabic(text: string): string {
  return text
    // Strip all Arabic diacritics, Quranic marks, and Uthmani annotations
    .replace(/[\u0600-\u0605\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    // Strip tatweel
    .replace(/\u0640/g, "")
    // Normalise all alef variants → bare alef
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g, "\u0627")
    // Ta marbuta → ha
    .replace(/\u0629/g, "\u0647")
    // Alef maqsura → ya
    .replace(/\u0649/g, "\u064A")
    // Waw with hamza → waw
    .replace(/\u0624/g, "\u0648")
    // Ya with hamza → ya
    .replace(/\u0626/g, "\u064A")
    .trim();
}

// ─── fuzzy word matching ───────────────────────────────────────────────────────

/** Character-level Levenshtein distance (space-optimised). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = temp;
    }
  }
  return row[b.length];
}

/**
 * Returns true when two normalised words are close enough to count as a match.
 * Tolerance scales with word length so short words need a tighter fit:
 *   ≤ 3 chars  → exact only (threshold 0)
 *   4–6 chars  → 1 edit allowed
 *   7+ chars   → 2 edits allowed
 * This covers Uthmani spelling differences (waw↔alef, dropped letters, etc.)
 * without being so loose that clearly wrong words pass.
 */
function wordsMatch(spokenNorm: string, expectedNorm: string): boolean {
  if (spokenNorm === expectedNorm) return true;
  const maxLen = Math.max(spokenNorm.length, expectedNorm.length);
  const threshold = maxLen <= 3 ? 0 : maxLen <= 6 ? 1 : 2;
  if (threshold === 0) return false;
  return levenshtein(spokenNorm, expectedNorm) <= threshold;
}

// ─── data helpers ─────────────────────────────────────────────────────────────

// Surahs where ayah 1 begins with the standalone Bismillah (not surah 1 or 9)
function needsBismillahHeader(surahNum: number): boolean {
  return surahNum !== 1 && surahNum !== 9;
}

function ayahsToWords(
  surahNum: number,
  ayahs: Ayah[],
  startAyah = 1,
  endAyah = Infinity,
  stripBismillah = false
): TestWord[] {
  return ayahs
    .filter((a) => a.numberInSurah >= startAyah && a.numberInSurah <= endAyah)
    .flatMap((ayah) => {
      const allWords = ayah.text.split(/\s+/).filter(Boolean);
      // Strip first 4 words (Bismillah) from ayah 1 when requested
      const doStrip = stripBismillah && ayah.numberInSurah === 1;
      const wordTexts = doStrip ? allWords.slice(4) : allWords;
      const offset = doStrip ? 4 : 0;
      return wordTexts.map((word, idx) => ({
        id: `${surahNum}-${ayah.numberInSurah}-${idx + offset}`,
        text: word,
        surahNum,
        ayahNum: ayah.numberInSurah,
        wordIdx: idx + offset,
      }));
    });
}

function sectionsToWords(sections: PageSection[]): TestWord[] {
  return sections.flatMap((sec) =>
    sec.ayahs.flatMap((ayah) => {
      // Strip Bismillah when this section begins at ayah 1 of an eligible surah
      const sectionStartsAtAyah1 = sec.ayahs[0]?.numberInSurah === 1;
      const doStrip =
        needsBismillahHeader(sec.surah.number) &&
        sectionStartsAtAyah1 &&
        ayah.numberInSurah === 1;
      const allWords = ayah.text.split(/\s+/).filter(Boolean);
      const wordTexts = doStrip ? allWords.slice(4) : allWords;
      const offset = doStrip ? 4 : 0;
      return wordTexts.map((word, idx) => ({
        id: `${sec.surah.number}-${ayah.numberInSurah}-${idx + offset}`,
        text: word,
        surahNum: sec.surah.number,
        ayahNum: ayah.numberInSurah,
        wordIdx: idx + offset,
      }));
    })
  );
}

function getJuzPageRange(juzNum: number) {
  const start = JUZ_DATA[juzNum - 1].quranPage;
  const end = juzNum < 30 ? JUZ_DATA[juzNum].quranPage - 1 : QURAN_TOTAL_PAGES;
  return { start, end };
}

async function fetchSurah(num: number): Promise<SurahDetailsData> {
  const res = await fetch(
    `https://api.alquran.cloud/v1/surah/${num}/quran-uthmani`
  );
  if (!res.ok) throw new Error("Failed to fetch surah");
  const json = await res.json();
  return json.data;
}

async function fetchPage(num: number): Promise<PageSection[]> {
  const res = await fetch(
    `https://api.alquran.cloud/v1/page/${num}/quran-uthmani`
  );
  if (!res.ok) throw new Error("Failed to fetch page");
  const json = await res.json();
  const ayahs = json.data.ayahs as (Ayah & { surah: SurahBase })[];
  const sections: PageSection[] = [];
  for (const ayah of ayahs) {
    const last = sections[sections.length - 1];
    if (last && last.surah.number === ayah.surah.number) {
      last.ayahs.push(ayah);
    } else {
      sections.push({ surah: ayah.surah, ayahs: [ayah] });
    }
  }
  return sections;
}

// ─── scope state ─────────────────────────────────────────────────────────────

interface ScopeState {
  type: ScopeType;
  surahNum: number;
  startAyah: string;
  endAyah: string;
  pageNum: string;
  juzNum: number;
  // surah-scope page-range mode
  rangeMode: "ayah" | "page";
  fromPage: string;
  toPage: string;
}

const defaultScope: ScopeState = {
  type: "surah",
  surahNum: 1,
  startAyah: "",
  endAyah: "",
  pageNum: "1",
  juzNum: 1,
  rangeMode: "ayah",
  fromPage: "",
  toPage: "",
};

// ─── word status display ──────────────────────────────────────────────────────

function WordBadge({
  word,
  isCurrent,
  status,
}: {
  word: TestWord;
  isCurrent: boolean;
  status: WordStatus | undefined;
}) {
  return (
    <span
      data-current={isCurrent ? "true" : undefined}
      className={cn(
        "inline-block font-serif [letter-spacing:0.04em] text-[1.6rem] sm:text-[2rem] leading-[3.5] mx-1 px-[3px] rounded-[3px] transition-colors duration-200",
        isCurrent &&
          "ring-2 ring-amber-400 ring-offset-1 bg-amber-50 animate-pulse",
        status === "correct" && !isCurrent && "bg-green-100 text-foreground",
        status === "mistake" && !isCurrent && "bg-red-100 text-foreground",
        !status && !isCurrent && "text-foreground"
      )}
    >
      {word.text}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function TestPage() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("setup");
  const [scope, setScope] = useState<ScopeState>(defaultScope);
  const [committed, setCommitted] = useState(false);

  const [wordStatuses, setWordStatuses] = useState<Record<string, WordStatus>>({});
  const [processedCount, setProcessedCount] = useState(0);
  const processedCountRef = useRef(0);
  const testWordsRef = useRef<TestWord[]>([]);
  const stopRef = useRef<(() => void) | null>(null);

  const { data: surahList } = useSurahList();

  // ── data queries ──────────────────────────────────────────────────────────

  const surahQuery = useQuery({
    queryKey: ["surah", scope.surahNum],
    queryFn: () => fetchSurah(scope.surahNum),
    enabled:
      // Load eagerly in setup when user is picking pages so we can show the ayah hint
      (scope.type === "surah" && scope.rangeMode === "page") ||
      (committed && (scope.type === "surah" || scope.type === "verse")),
    staleTime: Infinity,
  });

  const pageQuery = useQuery({
    queryKey: ["quran-page", Number(scope.pageNum)],
    queryFn: () => fetchPage(Number(scope.pageNum)),
    enabled:
      committed &&
      scope.type === "page" &&
      !isNaN(Number(scope.pageNum)) &&
      Number(scope.pageNum) >= 1 &&
      Number(scope.pageNum) <= QURAN_TOTAL_PAGES,
    staleTime: Infinity,
  });

  const juzPageQueries = useMemo(() => {
    if (!committed || scope.type !== "juz") return [];
    const { start, end } = getJuzPageRange(scope.juzNum);
    return Array.from({ length: end - start + 1 }, (_, i) => ({
      queryKey: ["quran-page", start + i] as const,
      queryFn: () => fetchPage(start + i),
      staleTime: Infinity as number,
    }));
  }, [committed, scope.type, scope.juzNum]);

  const juzResults = useQueries({ queries: juzPageQueries });

  // ── derive test words ─────────────────────────────────────────────────────

  // Derive the ayah range from the selected page range within a surah
  const pageRangeDerived = useMemo<{ startA: number; endA: number } | null>(() => {
    if (scope.type !== "surah" || scope.rangeMode !== "page" || !surahQuery.data) return null;
    const ayahs = surahQuery.data.ayahs;
    const fromPageNum = scope.fromPage ? parseInt(scope.fromPage, 10) : NaN;
    const toPageNum = scope.toPage ? parseInt(scope.toPage, 10) : NaN;

    // First ayah in the surah whose page >= fromPage
    const startA = !isNaN(fromPageNum)
      ? (ayahs.find((a) => a.page >= fromPageNum)?.numberInSurah ?? 1)
      : 1;
    // Last ayah in the surah whose page <= toPage
    const endA = !isNaN(toPageNum)
      ? ([...ayahs].reverse().find((a) => a.page <= toPageNum)?.numberInSurah ??
          surahQuery.data.numberOfAyahs)
      : surahQuery.data.numberOfAyahs;

    return { startA, endA };
  }, [scope.type, scope.rangeMode, scope.fromPage, scope.toPage, surahQuery.data]);

  const testWords = useMemo<TestWord[]>(() => {
    if (!committed) return [];

    if (scope.type === "surah" && surahQuery.data) {
      let startA: number;
      let endA: number;
      if (scope.rangeMode === "page" && pageRangeDerived) {
        startA = pageRangeDerived.startA;
        endA = pageRangeDerived.endA;
      } else {
        startA = scope.startAyah ? parseInt(scope.startAyah, 10) : 1;
        endA = scope.endAyah ? parseInt(scope.endAyah, 10) : surahQuery.data.numberOfAyahs;
      }
      const stripBismillah = startA <= 1 && needsBismillahHeader(scope.surahNum);
      return ayahsToWords(scope.surahNum, surahQuery.data.ayahs, startA, endA, stripBismillah);
    }

    if (scope.type === "verse" && surahQuery.data) {
      const ayahNum = scope.startAyah ? parseInt(scope.startAyah, 10) : 1;
      const stripBismillah = ayahNum === 1 && needsBismillahHeader(scope.surahNum);
      return ayahsToWords(scope.surahNum, surahQuery.data.ayahs, ayahNum, ayahNum, stripBismillah);
    }

    if (scope.type === "page" && pageQuery.data) {
      return sectionsToWords(pageQuery.data);
    }

    if (scope.type === "juz") {
      const allDone = juzResults.every((r) => r.isSuccess);
      if (!allDone) return [];
      const sections = juzResults.flatMap((r) => r.data ?? []);
      return sectionsToWords(sections);
    }

    return [];
  }, [committed, scope, surahQuery.data, pageQuery.data, juzResults]);

  // Track which surah numbers had their Bismillah stripped (need a header)
  const bismillahSurahs = useMemo<Set<number>>(() => {
    const s = new Set<number>();
    if (!committed) return s;

    if (scope.type === "surah") {
      const startA =
        scope.rangeMode === "page" && pageRangeDerived
          ? pageRangeDerived.startA
          : scope.startAyah
          ? parseInt(scope.startAyah, 10)
          : 1;
      if (startA <= 1 && needsBismillahHeader(scope.surahNum)) s.add(scope.surahNum);
    } else if (scope.type === "verse") {
      const ayahNum = scope.startAyah ? parseInt(scope.startAyah, 10) : 1;
      if (ayahNum === 1 && needsBismillahHeader(scope.surahNum)) s.add(scope.surahNum);
    } else {
      const sections =
        scope.type === "page"
          ? (pageQuery.data ?? [])
          : juzResults.flatMap((r) => r.data ?? []);
      for (const sec of sections) {
        if (
          needsBismillahHeader(sec.surah.number) &&
          sec.ayahs[0]?.numberInSurah === 1
        ) {
          s.add(sec.surah.number);
        }
      }
    }
    return s;
  }, [committed, scope, pageQuery.data, juzResults]);

  const isLoading =
    committed &&
    (surahQuery.isLoading ||
      pageQuery.isLoading ||
      (scope.type === "juz" && juzResults.some((r) => r.isLoading)));

  const isError =
    committed &&
    (surahQuery.isError ||
      pageQuery.isError ||
      (scope.type === "juz" && juzResults.some((r) => r.isError)));

  // Keep refs in sync
  useEffect(() => {
    testWordsRef.current = testWords;
  }, [testWords]);

  // ── speech processing ─────────────────────────────────────────────────────

  const processFinalResult = useCallback((transcript: string) => {
    const spokenWords = transcript.split(/\s+/).filter(Boolean);
    const testWords = testWordsRef.current;
    const updates: Record<string, WordStatus> = {};
    let count = processedCountRef.current;

    // How many expected words ahead to search when the current word doesn't match.
    // This re-syncs the pointer if the recogniser drops or garbles a word so
    // subsequent correct words are not cascaded as mistakes.
    const LOOKAHEAD = 2;

    for (const spoken of spokenWords) {
      if (count >= testWords.length) break;
      const spokenNorm = normalizeArabic(spoken);
      const expectedNorm = normalizeArabic(testWords[count].text);

      if (wordsMatch(spokenNorm, expectedNorm)) {
        updates[testWords[count].id] = "correct";
        count++;
      } else {
        // Look ahead: if the spoken word matches a nearby expected word, the
        // user likely skipped words — mark skipped ones as mistakes and re-sync.
        let foundAt = -1;
        for (let k = 1; k <= LOOKAHEAD && count + k < testWords.length; k++) {
          if (wordsMatch(spokenNorm, normalizeArabic(testWords[count + k].text))) {
            foundAt = k;
            break;
          }
        }

        if (foundAt > 0) {
          for (let k = 0; k < foundAt; k++) {
            updates[testWords[count + k].id] = "mistake";
          }
          updates[testWords[count + foundAt].id] = "correct";
          count += foundAt + 1;
        } else {
          updates[testWords[count].id] = "mistake";
          count++;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      processedCountRef.current = count;
      setProcessedCount(count);
      setWordStatuses((prev) => ({ ...prev, ...updates }));

      if (count >= testWords.length) {
        setPhase("done");
        stopRef.current?.();
      }
    }
  }, []);

  const { isListening, isSupported, start, stop, error: speechError } =
    useSpeechRecognition({ lang: "ar-SA", onFinalResult: processFinalResult });

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // Auto-scroll to current word
  useEffect(() => {
    if (phase !== "testing") return;
    const el = document.querySelector("[data-current='true']");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [processedCount, phase]);

  // ── actions ───────────────────────────────────────────────────────────────

  const handleStartTest = useCallback(() => {
    setCommitted(true);
  }, []);

  const handleBeginListening = useCallback(() => {
    processedCountRef.current = 0;
    setProcessedCount(0);
    setWordStatuses({});
    setPhase("testing");
    start();
  }, [start]);

  const handleStop = useCallback(() => {
    stop();
    setPhase("done");
  }, [stop]);

  const handleRestart = useCallback(() => {
    stop();
    processedCountRef.current = 0;
    setProcessedCount(0);
    setWordStatuses({});
    setPhase("testing");
    start();
  }, [stop, start]);

  const handleBack = useCallback(() => {
    stop();
    setPhase("setup");
    setCommitted(false);
    setWordStatuses({});
    processedCountRef.current = 0;
    setProcessedCount(0);
  }, [stop]);

  // ── derived stats ─────────────────────────────────────────────────────────

  const correctCount = Object.values(wordStatuses).filter((s) => s === "correct").length;
  const mistakeCount = Object.values(wordStatuses).filter((s) => s === "mistake").length;
  const accuracy =
    processedCount > 0
      ? Math.round((correctCount / processedCount) * 100)
      : 0;
  const currentWordId = testWords[processedCount]?.id;

  // Group words by surah → ayah for display (to insert Bismillah headers per surah)
  const surahGroups = useMemo(() => {
    type AyahGroup = { ayahNum: number; words: TestWord[] };
    type SurahGroup = { surahNum: number; showBismillah: boolean; ayahGroups: AyahGroup[] };
    const groups: SurahGroup[] = [];
    for (const word of testWords) {
      const lastSurah = groups[groups.length - 1];
      if (!lastSurah || lastSurah.surahNum !== word.surahNum) {
        groups.push({
          surahNum: word.surahNum,
          showBismillah: bismillahSurahs.has(word.surahNum),
          ayahGroups: [{ ayahNum: word.ayahNum, words: [word] }],
        });
      } else {
        const lastAyah = lastSurah.ayahGroups[lastSurah.ayahGroups.length - 1];
        if (!lastAyah || lastAyah.ayahNum !== word.ayahNum) {
          lastSurah.ayahGroups.push({ ayahNum: word.ayahNum, words: [word] });
        } else {
          lastAyah.words.push(word);
        }
      }
    }
    return groups;
  }, [testWords, bismillahSurahs]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Setup
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === "setup" || !committed || testWords.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border py-4 px-6 shadow-sm">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">Recitation Test</h1>
              <p className="text-xs text-muted-foreground">
                Choose your practice scope then start speaking
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 py-8 px-4 max-w-3xl mx-auto w-full">
          {/* Scope type tabs */}
          <div className="mb-6">
            <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Practice by
            </p>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { type: "surah", label: "Surah", icon: BookOpen },
                  { type: "verse", label: "Verse", icon: Bookmark },
                  { type: "page", label: "Page", icon: FileText },
                  { type: "juz", label: "Juz", icon: BookMarked },
                ] as const
              ).map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() =>
                    setScope((s) => ({ ...s, type, startAyah: "", endAyah: "" }))
                  }
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all cursor-pointer",
                    scope.type === type
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  )}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Scope-specific inputs */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-6 space-y-5">
            {/* Surah scope */}
            {scope.type === "surah" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Surah</label>
                  <div className="relative">
                    <select
                      value={scope.surahNum}
                      onChange={(e) =>
                        setScope((s) => ({
                          ...s,
                          surahNum: Number(e.target.value),
                          startAyah: "",
                          endAyah: "",
                          fromPage: "",
                          toPage: "",
                        }))
                      }
                      className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      {surahList?.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number}. {s.englishName} ({s.name})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Range mode toggle */}
                <div className="flex gap-2">
                  {(["ayah", "page"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() =>
                        setScope((s) => ({
                          ...s,
                          rangeMode: mode,
                          startAyah: "",
                          endAyah: "",
                          fromPage: "",
                          toPage: "",
                        }))
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                        scope.rangeMode === mode
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mode === "ayah" ? "By Ayah" : "By Page"}
                    </button>
                  ))}
                </div>

                {/* By-Ayah inputs */}
                {scope.rangeMode === "ayah" && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                        From Ayah (optional)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="1"
                        value={scope.startAyah}
                        onChange={(e) => setScope((s) => ({ ...s, startAyah: e.target.value }))}
                        className="bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                        To Ayah (optional)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Last"
                        value={scope.endAyah}
                        onChange={(e) => setScope((s) => ({ ...s, endAyah: e.target.value }))}
                        className="bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                )}

                {/* By-Page inputs */}
                {scope.rangeMode === "page" && (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                          From Page
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={604}
                          placeholder="e.g. 50"
                          value={scope.fromPage}
                          onChange={(e) => setScope((s) => ({ ...s, fromPage: e.target.value }))}
                          className="bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                          To Page
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={604}
                          placeholder="e.g. 53"
                          value={scope.toPage}
                          onChange={(e) => setScope((s) => ({ ...s, toPage: e.target.value }))}
                          className="bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>

                    {/* Derived ayah range hint */}
                    {surahQuery.isLoading && (scope.fromPage || scope.toPage) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading ayah info…
                      </div>
                    )}
                    {pageRangeDerived && (scope.fromPage || scope.toPage) && !surahQuery.isLoading && (
                      <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Corresponds to{" "}
                          <span className="font-semibold">Ayah {pageRangeDerived.startA}</span>
                          {pageRangeDerived.endA !== pageRangeDerived.startA && (
                            <>
                              {" "}– <span className="font-semibold">Ayah {pageRangeDerived.endA}</span>
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Verse scope */}
            {scope.type === "verse" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Surah</label>
                  <div className="relative">
                    <select
                      value={scope.surahNum}
                      onChange={(e) =>
                        setScope((s) => ({
                          ...s,
                          surahNum: Number(e.target.value),
                          startAyah: "",
                        }))
                      }
                      className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      {surahList?.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number}. {s.englishName} ({s.name})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Ayah Number</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 255"
                    value={scope.startAyah}
                    onChange={(e) => setScope((s) => ({ ...s, startAyah: e.target.value }))}
                    className="bg-background w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </>
            )}

            {/* Page scope */}
            {scope.type === "page" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Quran Page <span className="text-muted-foreground font-normal">(1 – {QURAN_TOTAL_PAGES})</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  max={QURAN_TOTAL_PAGES}
                  placeholder={`1 – ${QURAN_TOTAL_PAGES}`}
                  value={scope.pageNum}
                  onChange={(e) => setScope((s) => ({ ...s, pageNum: e.target.value }))}
                  className="bg-background w-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            )}

            {/* Juz scope */}
            {scope.type === "juz" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Juz</label>
                <div className="relative">
                  <select
                    value={scope.juzNum}
                    onChange={(e) => setScope((s) => ({ ...s, juzNum: Number(e.target.value) }))}
                    className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {JUZ_DATA.map((j) => (
                      <option key={j.number} value={j.number}>
                        Juz {j.number} — {j.englishName} (page {j.quranPage})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Juz loads ~20 pages in parallel — may take a moment on first load.
                </p>
              </div>
            )}
          </div>

          {/* Browser support warning */}
          {!isSupported && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Speech recognition requires <strong>Chrome or Edge</strong>. Please switch
                browsers to use this feature.
              </span>
            </div>
          )}

          {/* Loading / error / ready states after scope commit */}
          {committed && isLoading && (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading verses…</span>
            </div>
          )}

          {committed && isError && (
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to load verses. Check your connection and try again.
            </div>
          )}

          {committed && !isLoading && !isError && testWords.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="text-sm text-green-800">
                <span className="font-semibold">{testWords.length} words</span> ready to recite
              </div>
              <Button
                onClick={handleBeginListening}
                disabled={!isSupported}
                className="gap-2 bg-green-700 hover:bg-green-800 text-white cursor-pointer"
              >
                <Mic className="h-4 w-4" />
                Begin Recitation
              </Button>
            </div>
          )}

          {/* Start / Load button */}
          {!committed && (
            <Button
              onClick={handleStartTest}
              size="lg"
              className="w-full gap-2 cursor-pointer"
              disabled={!isSupported}
            >
              <Mic className="h-5 w-5" />
              Load Verses
            </Button>
          )}
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Testing & Done
  // ─────────────────────────────────────────────────────────────────────────

  const scopeLabel =
    scope.type === "surah"
      ? surahList?.find((s) => s.number === scope.surahNum)?.englishName ?? `Surah ${scope.surahNum}`
      : scope.type === "verse"
      ? `Surah ${scope.surahNum}, Ayah ${scope.startAyah || 1}`
      : scope.type === "page"
      ? `Page ${scope.pageNum}`
      : `Juz ${scope.juzNum}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border py-3 px-6 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                {phase === "done" ? "Test Complete" : "Reciting"} · {scopeLabel}
              </h1>
              <p className="text-xs text-muted-foreground">
                {processedCount} / {testWords.length} words
              </p>
            </div>
          </div>

          {/* Mic status */}
          <div className="flex items-center gap-3">
            {phase === "testing" && (
              <div className="flex items-center gap-2">
                {isListening ? (
                  <span className="flex items-center gap-1.5 text-sm text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    Listening
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MicOff className="h-4 w-4" />
                    Paused
                  </span>
                )}
              </div>
            )}

            {phase === "testing" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            )}

            {phase === "done" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                className="gap-1.5 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {processedCount > 0 && (
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-3xl mx-auto px-6 py-2 flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {correctCount} correct
            </span>
            <span className="flex items-center gap-1.5 text-red-600">
              <XCircle className="h-4 w-4" />
              {mistakeCount} mistakes
            </span>
            {phase === "done" && (
              <span className="ml-auto font-semibold text-foreground">
                {accuracy}% accuracy
              </span>
            )}
          </div>
        </div>
      )}

      {/* Speech error */}
      {speechError && (
        <div className="max-w-3xl mx-auto px-6 pt-4 w-full">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {speechError}
          </div>
        </div>
      )}

      {/* Verses display */}
      <main className="flex-1 px-4 sm:px-8 py-6 max-w-3xl mx-auto w-full">
        {phase === "done" && processedCount === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No words were processed. Try again and recite clearly into your microphone.
          </div>
        )}

        <div dir="rtl" className="text-right">
          {surahGroups.map((surah) => (
            <div key={surah.surahNum}>
              {surah.showBismillah && (
                <div dir="rtl" className="text-center py-5 mb-1 border-b border-border/40">
                  <span className="font-serif text-primary [letter-spacing:0.06em] text-[2rem] sm:text-[2.4rem] leading-loose">
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                  </span>
                </div>
              )}
              {surah.ayahGroups.map((group) => (
                <span key={`${surah.surahNum}-${group.ayahNum}`}>
                  {group.words.map((word) => (
                    <WordBadge
                      key={word.id}
                      word={word}
                      isCurrent={phase === "testing" && word.id === currentWordId}
                      status={wordStatuses[word.id]}
                    />
                  ))}
                  <span className="inline-block text-primary/70 text-sm mx-2 font-serif leading-[3.5]">
                    ﴿{group.ayahNum}﴾
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Done summary */}
        {phase === "done" && (
          <div className="mt-10 bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-lg mb-4">Summary</h2>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-700">{correctCount}</div>
                <div className="text-xs text-green-600 mt-1">Correct</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-600">{mistakeCount}</div>
                <div className="text-xs text-red-500 mt-1">Mistakes</div>
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-primary">{accuracy}%</div>
                <div className="text-xs text-primary/70 mt-1">Accuracy</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleRestart} className="flex-1 gap-2 cursor-pointer">
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1 cursor-pointer"
              >
                Change Scope
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
