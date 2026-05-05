import { useQuery } from "@tanstack/react-query";

export interface SurahBase {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  page: number;
}

export interface AyahWithSurah extends Ayah {
  surah: SurahBase;
}

export interface PageSection {
  surah: SurahBase;
  ayahs: AyahWithSurah[];
}

export interface SurahDetails extends SurahBase {
  ayahs: Ayah[];
}

export function useSurahList() {
  return useQuery({
    queryKey: ["surahs"],
    queryFn: async (): Promise<SurahBase[]> => {
      const res = await fetch("https://api.alquran.cloud/v1/surah");
      if (!res.ok) throw new Error("Failed to fetch surahs");
      const data = await res.json();
      return data.data;
    },
  });
}

export function useSurahDetails(number: number) {
  return useQuery({
    queryKey: ["surah", number],
    queryFn: async (): Promise<SurahDetails> => {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`);
      if (!res.ok) throw new Error("Failed to fetch surah details");
      const data = await res.json();
      return data.data;
    },
    enabled: !!number,
  });
}

export function useQuranPage(pageNumber: number | null) {
  return useQuery({
    queryKey: ["quran-page", pageNumber],
    queryFn: async (): Promise<PageSection[]> => {
      const res = await fetch(
        `https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`
      );
      if (!res.ok) throw new Error("Failed to fetch page data");
      const json = await res.json();
      const ayahs: AyahWithSurah[] = json.data.ayahs;

      // Group into sections by surah, preserving the order they appear on the page
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
    },
    enabled: typeof pageNumber === "number" && pageNumber >= 1 && pageNumber <= 604,
    staleTime: Infinity,
  });
}
