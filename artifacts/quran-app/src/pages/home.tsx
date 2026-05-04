import { useState } from "react";
import { Link } from "wouter";
import { useSurahList } from "@/hooks/use-quran";
import { useMistakes } from "@/hooks/use-mistakes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Trash2 } from "lucide-react";

export default function Home() {
  const { data: surahs, isLoading, error } = useSurahList();
  const [search, setSearch] = useState("");
  const { mistakes, clearMistakes } = useMistakes();

  const filteredSurahs = surahs?.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.englishName.toLowerCase().includes(q) ||
      s.englishNameTranslation.toLowerCase().includes(q) ||
      s.number.toString() === q
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border py-4 px-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">القرآن الكريم</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-1">The Noble Quran</p>
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search surahs..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-muted/50 focus-visible:ring-primary"
                data-testid="search-input"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div 
                className="bg-card border border-border px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium shadow-sm"
                data-testid="mistakes-counter"
              >
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                {mistakes.size} mistakes
              </div>
              
              {mistakes.size > 0 && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={clearMistakes}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                  title="Clear all mistakes"
                  data-testid="clear-mistakes-button"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6 max-w-4xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center text-destructive p-8 bg-destructive/10 rounded-lg">
            <p>Failed to load surahs. Please check your connection and try again.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="surah-list">
            {filteredSurahs?.map((surah) => (
              <Link key={surah.number} href={`/surah/${surah.number}`} className="block group" data-testid={`surah-item-${surah.number}`}>
                <div className="bg-card hover:bg-muted/50 border border-border rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:border-primary/30 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm border border-primary/20">
                      {surah.number}
                    </div>
                    <div className="font-serif text-2xl text-right text-foreground group-hover:text-primary transition-colors" dir="rtl">
                      {surah.name.replace("سُورَةُ ", "")}
                    </div>
                  </div>
                  
                  <div className="mt-auto">
                    <h3 className="font-semibold text-lg text-foreground">{surah.englishName}</h3>
                    <p className="text-sm text-muted-foreground text-balance mt-0.5">{surah.englishNameTranslation}</p>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                      <span className="uppercase tracking-wider">{surah.revelationType}</span>
                      <span>•</span>
                      <span>{surah.numberOfAyahs} Ayahs</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            
            {filteredSurahs?.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No surahs found matching "{search}"
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
