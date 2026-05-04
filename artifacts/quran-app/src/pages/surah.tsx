import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useLocation, useSearch } from "wouter";
import { useSurahDetails } from "@/hooks/use-quran";
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
  const startAtLast = new URLSearchParams(search).get("startPage") === "last";
  const surahNumber = parseInt(number || "1", 10);

  const { data: surah, isLoading, error } = useSurahDetails(surahNumber);
  const { mistakes, toggleMistake } = useMistakes();
  const { drawings, addStroke, undoStroke, removeStroke, clearAllDrawings, hasAnyDrawings } =
    useDrawings(surahNumber);
  const { notes, setNote } = useNotes(surahNumber);

  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [penColor, setPenColor] = useState("#ef4444");
  const lastDrawnAyahKey = useRef<string>("");

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
  // Setting a very large index when startAtLast is true means it will clamp
  // to totalPages - 1 automatically once surah data loads.
  useEffect(() => {
    setCurrentPageIndex(startAtLast ? 99999 : 0);
    setIsDrawMode(false);
    setIsEraserMode(false);
    window.scrollTo(0, 0);
  }, [surahNumber]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Build the pages array (grouped by Quran page number)
  const pages: { page: number; ayahs: typeof surah.ayahs }[] = [];
  for (const ayah of surah.ayahs) {
    const last = pages[pages.length - 1];
    if (last && last.page === ayah.page) {
      last.ayahs.push(ayah);
    } else {
      pages.push({ page: ayah.page, ayahs: [ayah] });
    }
  }

  const totalPages = pages.length;
  const clampedIndex = Math.min(currentPageIndex, totalPages - 1);
  const currentPage = pages[clampedIndex];
  const isFirstPage = clampedIndex === 0;
  const isLastPage = clampedIndex === totalPages - 1;
  // No Bismillah banner for Al-Fatiha (it IS the Bismillah) or At-Tawbah (no Bismillah)
  const showBismillah = surahNumber !== 1 && surahNumber !== 9;

  // Navigation handlers
  const goToPrevPage = () => {
    if (!isFirstPage) {
      setCurrentPageIndex((i) => i - 1);
    } else if (surahNumber > 1) {
      navigate(`/surah/${surahNumber - 1}`);
    }
  };

  const goToNextPage = () => {
    if (!isLastPage) {
      setCurrentPageIndex((i) => i + 1);
    } else if (surahNumber < 114) {
      navigate(`/surah/${surahNumber + 1}`);
    }
  };

  const prevLabel = isFirstPage
    ? surahNumber > 1
      ? "Prev Surah"
      : null
    : "Prev Page";

  const nextLabel = isLastPage
    ? surahNumber < 114
      ? "Next Surah"
      : null
    : "Next Page";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-24">
      {/* ── Header + toolbar pinned together so both stay visible on scroll ── */}
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
          {/* Draw toggle */}
          <button
            onClick={() => {
              setIsDrawMode((v) => !v);
              setIsEraserMode(false);
            }}
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

          {/* Erase toggle — only shown when there are drawings */}
          {hasAnyDrawings && (
            <button
              onClick={() => {
                setIsEraserMode((v) => !v);
                setIsDrawMode(false);
              }}
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

          {/* Color swatches — visible when draw mode is active; hover selects instantly */}
          {isDrawMode && (
            <div className="flex items-center gap-2 ml-1">
              {PEN_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onMouseEnter={() => setPenColor(c.value)}
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

          {/* Draw-mode secondary actions */}
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

          {/* Eraser-mode hint */}
          {isEraserMode && (
            <span className="text-xs text-orange-500 hidden sm:inline">
              Hover over a stroke to highlight it, then click to erase it
            </span>
          )}
        </div>
        </div>
      </div>

      {/* ── Reading content ── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-10 md:py-16">
        {/* Bismillah banner — first page of each surah (except Al-Fatiha & At-Tawbah) */}
        {showBismillah && isFirstPage && (
          <div className="text-center mb-16 pb-8 border-b border-border/50">
            <h2 className="font-serif text-3xl sm:text-4xl text-primary leading-loose" dir="rtl">
              {BISMILLAH}
            </h2>
          </div>
        )}

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

        {/* Ayahs for this page */}
        <div className="space-y-12 sm:space-y-16">
          {currentPage.ayahs.map((ayah) => {
            // Strip the Bismillah (always exactly 4 words) from the start of ayah 1.
            // We slice by word count rather than string matching because the API can use
            // slightly different Unicode alef forms (ٱ vs ا) across different surahs.
            const rawWords = ayah.text.split(/\s+/).filter(Boolean);
            const words =
              ayah.numberInSurah === 1 && showBismillah && rawWords.length > 4
                ? rawWords.slice(4)
                : rawWords;
            const ayahKey = `${surahNumber}-${ayah.numberInSurah}`;
            const ayahStrokes = drawings[ayahKey] ?? [];
            const ayahNote = notes[ayahKey] ?? "";

            return (
              <div
                key={ayah.number}
                className="flex flex-col gap-3"
                data-testid={`ayah-${ayah.numberInSurah}`}
              >
                <div className="flex items-start gap-2">
                  {/* Note icon — left margin */}
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
                        const wordId = `${surah.number}-${ayah.numberInSurah}-${wIdx}`;
                        const isHighlighted = mistakes.has(wordId);
                        return (
                          <span
                            key={wordId}
                            data-testid={`word-${wordId}`}
                            onDoubleClick={
                              isDrawMode ? undefined : () => toggleMistake(wordId)
                            }
                            className={cn(
                              "font-serif text-[1.8rem] sm:text-[2.2rem] md:text-[2.5rem] px-[2px] mx-1 rounded-[3px] transition-colors duration-150 select-none inline-block",
                              isDrawMode
                                ? "cursor-crosshair"
                                : "cursor-pointer hover:bg-primary/10 hover:text-primary",
                              isHighlighted
                                ? "bg-destructive text-destructive-foreground shadow-sm px-1 font-bold"
                                : "text-foreground"
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
      </main>

      {/* ── Bottom navigation ── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border py-4 px-4 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Prev button */}
          {prevLabel ? (
            <Button
              variant="outline"
              onClick={goToPrevPage}
              className={cn(
                "gap-2 border-border",
                isFirstPage
                  ? "hover:border-primary/50"
                  : "hover:border-primary/50"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{prevLabel}</span>
              <span className="sm:hidden">
                {isFirstPage ? "Prev" : "Prev"}
              </span>
            </Button>
          ) : (
            <div className="w-[100px]" />
          )}

          {/* Centre label */}
          <div className="text-center">
            <p className="text-xs font-semibold text-foreground">
              Page {currentPage.page}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {clampedIndex + 1} of {totalPages} in surah
            </p>
          </div>

          {/* Next button */}
          {nextLabel ? (
            <Button
              variant="outline"
              onClick={goToNextPage}
              className="gap-2 border-border hover:border-primary/50"
            >
              <span className="hidden sm:inline">{nextLabel}</span>
              <span className="sm:hidden">
                {isLastPage ? "Next" : "Next"}
              </span>
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
