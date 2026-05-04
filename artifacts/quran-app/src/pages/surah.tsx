import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { useSurahDetails } from "@/hooks/use-quran";
import { useMistakes } from "@/hooks/use-mistakes";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Bismillah is needed for all surahs except Surah 9 (At-Tawbah)
const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export default function Surah() {
  const { number } = useParams();
  const surahNumber = parseInt(number || "1", 10);
  
  const { data: surah, isLoading, error } = useSurahDetails(surahNumber);
  const { mistakes, toggleMistake } = useMistakes();

  // Scroll to top when surah changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [surahNumber]);

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
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border py-3 px-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="icon" className="hover:bg-muted" title="Back to surahs">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          
          <div className="text-center flex-1">
            <h1 className="font-serif text-2xl text-primary font-bold">{surah.name}</h1>
            <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase mt-1">{surah.englishName}</p>
          </div>
          
          <div className="w-10">
            {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Reading Content */}
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
            // Surah 1 has Bismillah as ayah 1, but for other surahs the API includes
            // Bismillah at the start of ayah 1 sometimes. We need to strip it if we already showed it.
            let textToDisplay = ayah.text;
            if (ayah.numberInSurah === 1 && showBismillah && textToDisplay.startsWith(BISMILLAH)) {
              textToDisplay = textToDisplay.replace(BISMILLAH, "").trim();
            }

            const words = textToDisplay.split(/\s+/).filter(Boolean);

            return (
              <div 
                key={ayah.number} 
                className="flex flex-col gap-4 group"
                data-testid={`ayah-${ayah.numberInSurah}`}
                dir="rtl"
              >
                <div className="text-right leading-[3.5] sm:leading-[4]">
                  {words.map((word, wIdx) => {
                    const wordId = `${surah.number}-${ayah.numberInSurah}-${wIdx}`;
                    const isHighlighted = mistakes.has(wordId);
                    
                    return (
                      <span
                        key={wordId}
                        data-testid={`word-${wordId}`}
                        onDoubleClick={() => toggleMistake(wordId)}
                        className={cn(
                          "font-serif text-[1.8rem] sm:text-[2.2rem] md:text-[2.5rem] px-[2px] mx-1 rounded-[3px] transition-colors duration-150 cursor-pointer select-none inline-block",
                          isHighlighted 
                            ? "bg-destructive text-destructive-foreground shadow-sm px-1 font-bold" 
                            : "hover:bg-primary/10 hover:text-primary text-foreground"
                        )}
                        title="Double-click to mark/unmark mistake"
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
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Navigation */}
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
            <div /> // Spacer
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
            <div /> // Spacer
          )}
        </div>
      </footer>
    </div>
  );
}
