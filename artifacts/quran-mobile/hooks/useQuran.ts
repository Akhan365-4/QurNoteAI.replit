import { useQuery } from "@tanstack/react-query";

export interface Surah {
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
}

export interface SurahDetail extends Surah {
  ayahs: Ayah[];
}

export function useSurahList() {
  return useQuery<Surah[]>({
    queryKey: ["surahs"],
    queryFn: async () => {
      const res = await fetch("https://api.alquran.cloud/v1/surah");
      const json = await res.json();
      return json.data as Surah[];
    },
    staleTime: Infinity,
  });
}

export function useSurahDetail(number: number) {
  return useQuery<SurahDetail>({
    queryKey: ["surah", number],
    queryFn: async () => {
      const res = await fetch(
        `https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`
      );
      const json = await res.json();
      return json.data as SurahDetail;
    },
    staleTime: Infinity,
    enabled: number > 0,
  });
}
