import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useLocation, useSearch } from "wouter";
import { useSurahDetails, useQuranPage } from "@/hooks/use-quran";
import type { Ayah, PageSection } from "@/hooks/use-quran";
import { useMistakes } from "@/hooks/use-mistakes";
import { useDrawings } from "@/hooks/use-drawings";
import { useNotes } from "@/hooks/use-notes";
import { DrawOverlay } from "@/components/draw-overlay";
import { AyahNote } from "@/components/ayah-note";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Eraser,
  Undo2,
  Trash2,
  BookOpen,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export default function Surah() {
  const { number } = useParams();
  const [, navigate] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const startAtLast = searchParams.get("startPage") === "last";
  const startQuranPage = searchParams.get("startQuranPage")
    ? parseInt(searchParams.get("startQuranPage")!, 10)
    : null;
  const surahNumber = parseInt(number || "1", 10);

  const { data: surah, isLoading, error } = useSurahDetails(surahNumber);
  const { mistakes, toggleMistake, clearPageMistakes } = useMistakes();
  const { drawings, addStroke, undoStroke, removeStroke, clearAllDrawings, hasAnyDrawings } =
    useDrawings(surahNumber);
  const { notes, setNote } = useNotes();

  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [penColor, setPenColor] = useState("#ef4444");
  const lastDrawnAyahKey = useRef<string>("");
  // Ref to the primary surah's section div, used to scroll into view when the
  // page also contains a preceding guest surah above it.
  const primarySectionRef = useRef<HTMLDivElement>(null);

  const PEN_COLORS = [
    { value: "#ef4444", label: "Red" },
    { value: "#3b82f6", label: "Blue" },
    { value: "#22c55e", label: "Green" },
    { value: "#f97316", label: "Orange" },
    { value: "#a855f7", label: "Purple" },
    { value: "#eab308", label: "Yellow" },
    { value: "#1a1a1a", label: "Black" },
  ];

  // Reset annotation modes and set start page whenever the surah changes.
  useEffect(() => {
    setCurrentPageIndex(startAtLast ? 99999 : 0);
    setIsDrawMode(false);
    setIsEraserMode(false);
    window.scrollTo(0, 0);
  }, [surahNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a specific Quran page is requested (juz navigation), jump to it
  useEffect(() => {
    if (!startQuranPage || !surah) return;
    const pageNums: number[] = [];
    for (const ayah of surah.ayahs) {
      if (pageNums.length === 0 || pageNums[pageNums.length - 1] !== ayah.page) {
        pageNums.push(ayah.page);
      }
    }
    const idx = pageNums.findIndex((p) => p >= startQuranPage);
    if (idx !== -1) setCurrentPageIndex(idx);
  }, [startQuranPage, surah]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to top on every page turn
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPageIndex]);

  const handleAddStroke = useCallback(
    (ayahKey: string, path: string) => {
      lastDrawnAyahKey.current = ayahKey;
      addStroke(ayahKey, path, penColor);
    },
    [addStroke, penColor]
  );

  const handleGlobalUndo = useCallback(() => {
    if (lastDrawnAyahKey.current) {
      undoStroke(lastDrawnAyahKey.current);
    }
  }, [undoStroke]);

  // ── Build pages from surah data (safe when surah is still loading) ──
  // Must happen before early returns so useQuranPage can be called unconditionally.
  const surahPages: { page: number; ayahs: Ayah[] }[] = [];
  if (surah) {
    for (const ayah of surah.ayahs) {
      const last = surahPages[surahPages.length - 1];
      if (last && last.page === ayah.page) {
        last.ayahs.push(ayah);
      } else {
        surahPages.push({ page: ayah.page, ayahs: [ayah] });
      }
    }
  }
  const totalPages = surahPages.length;
  const safeClamped = totalPages > 0 ? Math.min(currentPageIndex, totalPages - 1) : 0;
  const currentQuranPageNum: number | null = surahPages[safeClamped]?.page ?? null;

  // Fetch ALL ayahs on this Quran page — may include ayahs from adjacent surahs
  const { data: pageData } = useQuranPage(currentQuranPageNum);

  // After the full-page data loads, scroll to the start of the primary surah
  // if there are guest surahs rendered above it on the same Quran page.
  // Deps include surahNumber so cached page data still re-triggers when the
  // user picks a different surah on the same Quran page number.
  useEffect(() => {
    if (!pageData) return;
    const hasPrimarySection = pageData.some((s) => s.surah.number === surahNumber);
    if (!hasPrimarySection) return;
    const hasPrecedingGuest = pageData[0]?.surah.number < surahNumber;
    if (!hasPrecedingGuest || !primarySectionRef.current) return;
    // Offset by sticky header + toolbar height (~128 px) so the surah name
    // is fully visible rather than hidden behind the fixed bars.
    const top =
      primarySectionRef.current.getBoundingClientRect().top +
      window.scrollY -
      128;
    window.scrollTo({ top, behavior: "instant" });
  }, [pageData, surahNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early returns ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-serif text-lg">Loading Surah...</p>
      </div>
    );
  }

  if (error || !surah) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="text-destructive mb-4 p-4 bg-destructive/10 rounded-full">
          <ArrowLeft className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Failed to load Surah</h2>
        <p className="text-muted-foreground mb-6">Could not fetch the requested data.</p>
        <Link href="/">
          <Button variant="default">Return to Surah List</Button>
        </Link>
      </div>
    );
  }

  // surah is guaranteed defined past here
  const clampedIndex = safeClamped;
  const currentPage = surahPages[clampedIndex];
  const isFirstPage = clampedIndex === 0;
  const isLastPage = clampedIndex === totalPages - 1;

  // Build display sections:
  // Prefer full page data from the page API (includes all surahs on this Quran page).
  // Fall back to the current surah's ayahs only while the page data is loading.
  const displaySections: PageSection[] = pageData ?? [
    {
      surah: {
        number: surahNumber,
        name: surah.name,
        englishName: surah.englishName,
        englishNameTranslation: surah.englishNameTranslation,
        numberOfAyahs: surah.numberOfAyahs,
        revelationType: surah.revelationType,
      },
      ayahs: currentPage.ayahs.map((a) => ({
        ...a,
        surah: {
          number: surahNumber,
          name: surah.name,
          englishName: surah.englishName,
          englishNameTranslation: surah.englishNameTranslation,
          numberOfAyahs: surah.numberOfAyahs,
          revelationType: surah.revelationType,
        },
      })),
    },
  ];

  // Which surahs are already visible on this Quran page?
  // These drive navigation so we skip past surahs that are already on-screen.
  const firstVisibleSurahNum =
    displaySections.length > 0
      ? Math.min(...displaySections.map((s) => s.surah.number))
      : surahNumber;
  const lastVisibleSurahNum =
    displaySections.length > 0
      ? Math.max(...displaySections.map((s) => s.surah.number))
      : surahNumber;

  // Navigation handlers
  const goToPrevPage = () => {
    if (!isFirstPage) {
      setCurrentPageIndex((i) => i - 1);
    } else if (firstVisibleSurahNum > 1) {
      // Jump to the last page of the surah just before this Quran page starts,
      // skipping any guest surahs that already appear at the top of this page.
      navigate(`/surah/${firstVisibleSurahNum - 1}?startPage=last`);
    }
  };

  const goToPrevSurah = () => {
    if (firstVisibleSurahNum > 1) {
      navigate(`/surah/${firstVisibleSurahNum - 1}`);
    }
  };

  const goToNextSurah = () => {
    if (lastVisibleSurahNum < 114) {
      navigate(`/surah/${lastVisibleSurahNum + 1}`);
    }
  };

  const goToNextPage = () => {
    if (!isLastPage) {
      setCurrentPageIndex((i) => i + 1);
    } else if (lastVisibleSurahNum < 114) {
      // Jump to the first surah that starts on the next Quran page,
      // skipping any guest surahs already visible at the bottom of this page.
      navigate(`/surah/${lastVisibleSurahNum + 1}`);
    }
  };

  // Collect every word ID on this page across all sections (for mistake counter/reset)
  const pageWordIds: string[] = displaySections.flatMap((section) => {
    const secNum = section.surah.number;
    const startsAtAyah1 = section.ayahs[0]?.numberInSurah === 1;
    const hasBismillah = startsAtAyah1 && secNum !== 1 && secNum !== 9;
    return section.ayahs.flatMap((ayah) => {
      const rawWords = ayah.text.split(/\s+/).filter(Boolean);
      const words =
        ayah.numberInSurah === 1 && hasBismillah && rawWords.length > 4
          ? rawWords.slice(4)
          : rawWords;
      return words.map((_, wIdx) => `${secNum}-${ayah.numberInSurah}-${wIdx}`);
    });
  });
  const pageMistakeCount = pageWordIds.filter((id) => mistakes.has(id)).length;

  // Show dual buttons at surah boundaries
  const showDualPrev = isFirstPage && firstVisibleSurahNum > 1;
  // Dual next: shown at the first page so user can either go to page 2 or skip to next surah.
  // Uses lastVisibleSurahNum so "Next Surah" skips past all surahs already on-screen.
  const showDualNext = isFirstPage && lastVisibleSurahNum < 114;

  const prevLabel = !isFirstPage ? "Prev Page" : null;
  const nextLabel = !isFirstPage
    ? isLastPage
      ? lastVisibleSurahNum < 114 ? "Next Surah" : null
      : "Next Page"
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-24">
      {/* ── Header + toolbar pinned together ── */}
      <div className="sticky top-0 z-30">
        <header className="bg-background/90 backdrop-blur-md border-b border-border py-3 px-4 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="icon" className="hover:bg-muted" title="Back to surahs">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            <div className="text-center flex-1">
              <h1 className="font-serif text-2xl text-primary font-bold">{surah.name}</h1>
              <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase mt-1">
                {surah.englishName}
              </p>
            </div>

            <div className="w-10" />
          </div>
        </header>

        {/* ── Annotation toolbar ── */}
        <div className="bg-background/95 backdrop-blur border-b border-border px-4 py-2" style={{ cursor: "default" }}>
          <div className="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setIsDrawMode((v) => !v); setIsEraserMode(false); }}
              title={isDrawMode ? "Exit draw mode" : "Draw circles around mistakes"}
              style={{ cursor: "pointer" }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors",
                isDrawMode
                  ? "bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Pencil size={13} />
              {isDrawMode ? "Exit Drawing" : "Draw"}
            </button>

            {(hasAnyDrawings || isEraserMode) && (
              <button
                onClick={() => { setIsEraserMode((v) => !v); setIsDrawMode(false); }}
                title={isEraserMode ? "Exit eraser" : "Click individual strokes to erase them"}
                style={{ cursor: "pointer" }}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors",
                  isEraserMode
                    ? "bg-orange-50 border-orange-300 text-orange-600 hover:bg-orange-100"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Eraser size={13} />
                {isEraserMode ? "Exit Eraser" : "Erase"}
              </button>
            )}

            {isDrawMode && (
              <div className="flex items-center gap-2 ml-1">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setPenColor(c.value)}
                    className="rounded-full transition-all duration-100 focus:outline-none"
                    style={{
                      cursor: "pointer",
                      width: penColor === c.value ? 22 : 18,
                      height: penColor === c.value ? 22 : 18,
                      backgroundColor: c.value,
                      boxShadow: penColor === c.value
                        ? `0 0 0 2px white, 0 0 0 4px ${c.value}`
                        : "none",
                    }}
                  />
                ))}
              </div>
            )}

            {isDrawMode && (
              <>
                <button
                  onClick={handleGlobalUndo}
                  title="Undo last stroke"
                  style={{ cursor: "pointer" }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Undo2 size={13} /> Undo
                </button>
                {hasAnyDrawings && (
                  <button
                    onClick={clearAllDrawings}
                    title="Clear all drawings on this surah"
                    style={{ cursor: "pointer" }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 size={13} /> Clear all
                  </button>
                )}
              </>
            )}

            {isEraserMode && (
              <span className="text-xs text-orange-500 hidden sm:inline">
                Hover over a stroke to highlight it, then click to erase it
              </span>
            )}

            {pageMistakeCount > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive text-sm font-bold px-3 py-1 rounded-full border border-destructive/20">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  {pageMistakeCount} {pageMistakeCount === 1 ? "mistake" : "mistakes"}
                </span>
                <button
                  onClick={() => clearPageMistakes(pageWordIds)}
                  title="Clear all mistakes on this page"
                  style={{ cursor: "pointer" }}
                  className="text-sm font-medium px-3 py-1 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reading content ── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-10 md:py-16">

        {/* Page label */}
        <div className="flex items-center gap-3 mb-12">
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground/70 select-none">
            <BookOpen size={11} />
            <span>Quran Page {currentPage.page}</span>
            <span className="opacity-50">·</span>
            <span>{clampedIndex + 1} / {totalPages}</span>
          </div>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ── Sections: one per surah that appears on this Quran page ── */}
        {displaySections.map((section) => {
          const secNum = section.surah.number;
          const isPrimary = secNum === surahNumber;
          const startsAtAyah1 = section.ayahs[0]?.numberInSurah === 1;
          // Surahs that get a Bismillah header: starts at ayah 1, not Al-Fatiha, not At-Tawbah
          const sectionHasBismillah = startsAtAyah1 && secNum !== 1 && secNum !== 9;

          return (
            <div
              key={secNum}
              ref={isPrimary ? primarySectionRef : undefined}
              className="space-y-12 sm:space-y-16"
            >
              {/* ── Surah divider: Bismillah for primary surah's first page,
                   or full header + Bismillah for every guest surah ── */}
              {sectionHasBismillah && isPrimary && isFirstPage && (
                <div className="text-center mb-4 pb-8 border-b border-border/50">
                  <h2 className="font-serif text-3xl sm:text-4xl text-primary leading-loose" dir="rtl">
                    {BISMILLAH}
                  </h2>
                </div>
              )}

              {!isPrimary && startsAtAyah1 && (
                <div className="pt-4">
                  {/* Surah name header */}
                  <div className="relative flex items-center justify-center mb-6">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />
                    <div className="relative bg-background border border-border rounded-full px-5 py-1.5 text-center">
                      <span className="font-serif text-lg text-primary font-bold" dir="rtl">
                        {section.surah.name}
                      </span>
                      <span className="text-muted-foreground mx-2 text-xs">·</span>
                      <span className="text-xs text-muted-foreground tracking-wide">
                        {section.surah.englishName}
                      </span>
                    </div>
                  </div>
                  {/* Bismillah for guest surah */}
                  {sectionHasBismillah && (
                    <div className="text-center mb-8 pb-6 border-b border-border/50">
                      <h2 className="font-serif text-3xl sm:text-4xl text-primary leading-loose" dir="rtl">
                        {BISMILLAH}
                      </h2>
                    </div>
                  )}
                </div>
              )}

              {/* ── Ayahs ── */}
              {section.ayahs.map((ayah) => {
                const rawWords = ayah.text.split(/\s+/).filter(Boolean);
                // Strip the Bismillah words (first 4) from ayah 1 to avoid duplicating
                // the text we already show in the banner above
                const words =
                  ayah.numberInSurah === 1 && sectionHasBismillah && rawWords.length > 4
                    ? rawWords.slice(4)
                    : rawWords;
                const ayahKey = `${secNum}-${ayah.numberInSurah}`;
                const ayahStrokes = drawings[ayahKey] ?? [];
                const ayahNote = notes[ayahKey] ?? "";

                return (
                  <div
                    key={ayah.number}
                    className="flex flex-col gap-3"
                    data-testid={`ayah-${ayah.numberInSurah}`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Note icon */}
                      <AyahNote
                        ayahKey={ayahKey}
                        value={ayahNote}
                        onChange={(text) => setNote(ayahKey, text)}
                      />

                      {/* Arabic text + drawing overlay */}
                      <div
                        className={cn(
                          "relative flex-1 rounded-sm transition-shadow",
                          isDrawMode && "ring-1 ring-destructive/30 shadow-sm"
                        )}
                      >
                        <div
                          dir="rtl"
                          className="text-right leading-[3.5] sm:leading-[4] select-none px-1"
                        >
                          {words.map((word, wIdx) => {
                            const wordId = `${secNum}-${ayah.numberInSurah}-${wIdx}`;
                            const isHighlighted = mistakes.has(wordId);
                            return (
                              <span
                                key={wordId}
                                data-testid={`word-${wordId}`}
                                onDoubleClick={
                                  isDrawMode ? undefined : () => toggleMistake(wordId)
                                }
                                className={cn(
                                  "font-serif text-[1.8rem] sm:text-[2.2rem] md:text-[2.5rem] px-[2px] mx-1 rounded-[3px] transition-colors duration-150 select-none",
                                  // Use `inline` (not `inline-block`) when highlighted so the background
                                  // tint doesn't create a solid box that clips adjacent Arabic diacritics.
                                  isHighlighted ? "inline bg-red-100 text-foreground" : "inline-block text-foreground",
                                  isDrawMode
                                    ? "cursor-crosshair"
                                    : "cursor-pointer hover:bg-primary/10 hover:text-primary",
                                )}
                                title={isDrawMode ? undefined : "Double-click to mark/unmark mistake"}
                              >
                                {word}
                              </span>
                            );
                          })}

                          {/* Ayah number badge */}
                          <span className="inline-flex items-center justify-center w-10 h-10 mx-3 rounded-full border-2 border-accent text-accent-foreground font-serif text-lg bg-accent/5 relative -top-2 select-none shadow-sm">
                            {ayah.numberInSurah}
                          </span>
                        </div>

                        <DrawOverlay
                          isDrawMode={isDrawMode}
                          isEraserMode={isEraserMode}
                          strokes={ayahStrokes}
                          onAddStroke={(path) => handleAddStroke(ayahKey, path)}
                          onRemoveStroke={(index) => removeStroke(ayahKey, index)}
                          currentColor={penColor}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </main>

      {/* ── Bottom navigation ── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border py-4 px-4 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {showDualPrev ? (
            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                onClick={goToPrevPage}
                className="gap-1.5 border-border hover:border-primary/50 h-8 text-xs px-3"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Prev Page</span>
                <span className="sm:hidden">Page</span>
              </Button>
              <Button
                variant="ghost"
                onClick={goToPrevSurah}
                className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs px-3"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Prev Surah</span>
                <span className="sm:hidden">Surah</span>
              </Button>
            </div>
          ) : prevLabel ? (
            <Button
              variant="outline"
              onClick={goToPrevPage}
              className="gap-2 border-border hover:border-primary/50"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{prevLabel}</span>
              <span className="sm:hidden">Prev</span>
            </Button>
          ) : (
            <div className="w-[100px]" />
          )}

          <div className="text-center">
            <p className="text-xs font-semibold text-foreground">
              Page {currentPage.page}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {clampedIndex + 1} of {totalPages} in surah
            </p>
          </div>

          {showDualNext ? (
            <div className="flex flex-col gap-1.5 items-end">
              <Button
                variant="outline"
                onClick={goToNextPage}
                className="gap-1.5 border-border hover:border-primary/50 h-8 text-xs px-3"
              >
                <span className="hidden sm:inline">Next Page</span>
                <span className="sm:hidden">Page</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                onClick={goToNextSurah}
                className="gap-1.5 text-muted-foreground hover:text-foreground h-8 text-xs px-3"
              >
                <span className="hidden sm:inline">Next Surah</span>
                <span className="sm:hidden">Surah</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : nextLabel ? (
            <Button
              variant="outline"
              onClick={goToNextPage}
              className="gap-2 border-border hover:border-primary/50"
            >
              <span className="hidden sm:inline">{nextLabel}</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="w-[100px]" />
          )}
        </div>
      </footer>
    </div>
  );
}
