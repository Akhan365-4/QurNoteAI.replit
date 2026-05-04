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
