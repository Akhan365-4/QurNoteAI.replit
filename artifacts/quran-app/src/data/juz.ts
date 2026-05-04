export interface JuzInfo {
  number: number;
  arabicName: string;
  englishName: string;
  surah: number;
  ayah: number;
  quranPage: number;
}

// Standard 30 juz boundaries (Medina Mushaf, 604-page edition)
export const JUZ_DATA: JuzInfo[] = [
  { number: 1,  arabicName: "الم",                    englishName: "Alif Lam Mim",        surah: 1,  ayah: 1,   quranPage: 1   },
  { number: 2,  arabicName: "سَيَقُولُ",               englishName: "Sayaqool",            surah: 2,  ayah: 142, quranPage: 22  },
  { number: 3,  arabicName: "تِلْكَ الرُّسُلُ",        englishName: "Tilka ar-Rusul",      surah: 2,  ayah: 253, quranPage: 42  },
  { number: 4,  arabicName: "لَنْ تَنَالُوا",          englishName: "Lan Tanaloo",         surah: 3,  ayah: 92,  quranPage: 62  },
  { number: 5,  arabicName: "وَالْمُحْصَنَاتُ",        englishName: "Wal-Muhsanat",        surah: 4,  ayah: 24,  quranPage: 82  },
  { number: 6,  arabicName: "لَا يُحِبُّ اللهُ",      englishName: "La Yuhibbullah",      surah: 4,  ayah: 148, quranPage: 102 },
  { number: 7,  arabicName: "وَإِذَا سَمِعُوا",        englishName: "Wa Iza Samioo",       surah: 5,  ayah: 82,  quranPage: 121 },
  { number: 8,  arabicName: "وَلَوْ أَنَّنَا",         englishName: "Wa Law Annana",       surah: 6,  ayah: 111, quranPage: 142 },
  { number: 9,  arabicName: "قَالَ الْمَلَأُ",         englishName: "Qal al-Mala",         surah: 7,  ayah: 88,  quranPage: 162 },
  { number: 10, arabicName: "وَاعْلَمُوا",             englishName: "Wa'lamu",             surah: 8,  ayah: 41,  quranPage: 182 },
  { number: 11, arabicName: "يَعْتَذِرُونَ",           englishName: "Ya'taziroon",         surah: 9,  ayah: 93,  quranPage: 201 },
  { number: 12, arabicName: "وَمَا مِنْ دَابَّةٍ",    englishName: "Wa ma min dabbah",    surah: 11, ayah: 6,   quranPage: 222 },
  { number: 13, arabicName: "وَمَا أُبَرِّئُ",         englishName: "Wa ma ubarri'u",      surah: 12, ayah: 53,  quranPage: 242 },
  { number: 14, arabicName: "رُبَمَا",                 englishName: "Rubama",              surah: 15, ayah: 1,   quranPage: 262 },
  { number: 15, arabicName: "سُبْحَانَ الَّذِي",       englishName: "Subhanallathi",       surah: 17, ayah: 1,   quranPage: 282 },
  { number: 16, arabicName: "قَالَ أَلَمْ",            englishName: "Qal alam",            surah: 18, ayah: 75,  quranPage: 302 },
  { number: 17, arabicName: "اقْتَرَبَ",               englishName: "Iqtaraba",            surah: 21, ayah: 1,   quranPage: 322 },
  { number: 18, arabicName: "قَدْ أَفْلَحَ",           englishName: "Qad Aflaha",          surah: 23, ayah: 1,   quranPage: 342 },
  { number: 19, arabicName: "وَقَالَ الَّذِينَ",       englishName: "Wa qalal-latheena",   surah: 25, ayah: 21,  quranPage: 362 },
  { number: 20, arabicName: "أَمَّنْ خَلَقَ",          englishName: "Amman khalaqa",       surah: 27, ayah: 56,  quranPage: 382 },
  { number: 21, arabicName: "اتْلُ مَا أُوحِيَ",      englishName: "Utlu ma oohi",        surah: 29, ayah: 46,  quranPage: 402 },
  { number: 22, arabicName: "وَمَنْ يَقْنُتْ",         englishName: "Wa man yaqnut",       surah: 33, ayah: 31,  quranPage: 422 },
  { number: 23, arabicName: "وَمَا لِيَ",              englishName: "Wa ma liya",          surah: 36, ayah: 28,  quranPage: 442 },
  { number: 24, arabicName: "فَمَنْ أَظْلَمُ",         englishName: "Faman athlamu",       surah: 39, ayah: 32,  quranPage: 462 },
  { number: 25, arabicName: "إِلَيْهِ يُرَدُّ",        englishName: "Ilayhi yuraddu",      surah: 41, ayah: 47,  quranPage: 482 },
  { number: 26, arabicName: "حم",                      englishName: "Ha-Mim",              surah: 46, ayah: 1,   quranPage: 502 },
  { number: 27, arabicName: "قَالَ فَمَا خَطْبُكُمْ", englishName: "Qal fama khatbukum",  surah: 51, ayah: 31,  quranPage: 522 },
  { number: 28, arabicName: "قَدْ سَمِعَ",             englishName: "Qad Sami'a",          surah: 58, ayah: 1,   quranPage: 542 },
  { number: 29, arabicName: "تَبَارَكَ الَّذِي",       englishName: "Tabaraka allathi",    surah: 67, ayah: 1,   quranPage: 562 },
  { number: 30, arabicName: "عَمَّ",                   englishName: "Amma",                surah: 78, ayah: 1,   quranPage: 582 },
];
