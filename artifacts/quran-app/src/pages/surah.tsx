import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams } from "wouter";
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
  Undo2,
  Trash2,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export default function Surah() {
  const { number } = useParams();
  const surahNumber = parseInt(number || "1", 10);

  const { data: surah, isLoading, error } = useSurahDetails(surahNumber);
  const { mistakes, toggleMistake } = useMistakes();
  const { drawings, addStroke, undoStroke, clearAllDrawings, hasAnyDrawings } =
    useDrawings(surahNumber);
  const { notes, setNote } = useNotes(surahNumber);

  const [isDrawMode, setIsDrawMode] = useState(false);
  const lastDrawnAyahKey = useRef<string>("");

  useEffect(() => {
    window.scrollTo(0, 0);
    setIsDrawMode(false);
  }, [surahNumber]);

  // Wrap addStroke to track which ayah was drawn on last (for undo)
  const handleAddStroke = useCallback(
    (ayahKey: string, path: string) => {
      lastDrawnAyahKey.current = ayahKey;
      addStroke(ayahKey, path);
    },
    [addStroke]
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

  const showBismillah = surahNumber !== 1 && surahNumber !== 9;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-24">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border py-3 px-4 shadow-sm">
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
      <div className="sticky top-[57px] z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsDrawMode((v) => !v)}
            title={isDrawMode ? "Exit draw mode" : "Draw mode — draw circles around mistakes"}
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

          {isDrawMode && (
            <>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Draw circles around mistakes · double-click word still marks it red
              </span>
              <button
                onClick={handleGlobalUndo}
                title="Undo last stroke"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Undo2 size={13} /> Undo
              </button>
              {hasAnyDrawings && (
                <button
                  onClick={clearAllDrawings}
                  title="Clear all drawings on this surah"
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 size={13} /> Clear all
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Reading content ── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-10 md:py-16">
        {showBismillah && (
          <div className="text-center mb-16 pb-8 border-b border-border/50">
            <h2 className="font-serif text-3xl sm:text-4xl text-primary leading-loose" dir="rtl">
              {BISMILLAH}
            </h2>
          </div>
        )}

        <div className="space-y-12 sm:space-y-16">
          {surah.ayahs.map((ayah) => {
            let textToDisplay = ayah.text;
            if (
              ayah.numberInSurah === 1 &&
              showBismillah &&
              textToDisplay.startsWith(BISMILLAH)
            ) {
              textToDisplay = textToDisplay.replace(BISMILLAH, "").trim();
            }

            const words = textToDisplay.split(/\s+/).filter(Boolean);
            const ayahKey = `${surahNumber}-${ayah.numberInSurah}`;
            const ayahStrokes = drawings[ayahKey] ?? [];
            const ayahNote = notes[ayahKey] ?? "";

            return (
              <div
                key={ayah.number}
                className="flex flex-col gap-3"
                data-testid={`ayah-${ayah.numberInSurah}`}
              >
                {/* Row: note icon | arabic text */}
                <div className="flex items-start gap-2">
                  {/* Note column — left side */}
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

                    {/* SVG drawing overlay */}
                    <DrawOverlay
                      isDrawMode={isDrawMode}
                      strokes={ayahStrokes}
                      onAddStroke={(path) => handleAddStroke(ayahKey, path)}
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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {surahNumber > 1 ? (
            <Link href={`/surah/${surahNumber - 1}`}>
              <Button variant="outline" className="gap-2 border-border hover:border-primary/50">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous Surah</span>
                <span className="sm:hidden">Prev</span>
              </Button>
            </Link>
          ) : (
            <div />
          )}

          <div className="text-xs font-medium text-muted-foreground">
            Surah {surahNumber} of 114
          </div>

          {surahNumber < 114 ? (
            <Link href={`/surah/${surahNumber + 1}`}>
              <Button variant="outline" className="gap-2 border-border hover:border-primary/50">
                <span className="hidden sm:inline">Next Surah</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </footer>
    </div>
  );
}
