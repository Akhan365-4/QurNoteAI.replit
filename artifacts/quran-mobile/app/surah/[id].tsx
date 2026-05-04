import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useMistakes } from "@/hooks/useMistakes";
import { useSurahDetail } from "@/hooks/useQuran";

const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export default function SurahScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const surahNumber = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useSurahDetail(surahNumber);
  const { mistakes, toggleMistake, mistakeCount, clearAll } = useMistakes();

  const tapTimestamps = useRef<Record<string, number>>({});

  const handleWordPress = useCallback(
    (wordId: string) => {
      const now = Date.now();
      const last = tapTimestamps.current[wordId] ?? 0;
      if (now - last < 400) {
        toggleMistake(wordId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        tapTimestamps.current[wordId] = 0;
      } else {
        tapTimestamps.current[wordId] = now;
      }
    },
    [toggleMistake]
  );

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const showBismillah = surahNumber !== 9 && surahNumber !== 1;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="back-button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>

        <View style={styles.headerCenter}>
          {data && (
            <>
              <Text style={[styles.headerArabic, { color: colors.primary }]}>
                {data.name}
              </Text>
              <Text style={[styles.headerEng, { color: colors.mutedForeground }]}>
                {data.englishName}
              </Text>
            </>
          )}
        </View>

        <View style={styles.headerRight}>
          {mistakeCount > 0 && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                clearAll();
              }}
              style={styles.clearBtn}
              testID="clear-mistakes-button"
            >
              <Ionicons name="close-circle" size={18} color={colors.destructive} />
            </Pressable>
          )}
        </View>
      </View>

      {mistakeCount > 0 && (
        <View style={[styles.mistakeBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
          <Text style={[styles.mistakeBarText, { color: colors.destructive }]} testID="mistakes-counter">
            {mistakeCount} {mistakeCount === 1 ? "mistake" : "mistakes"} marked — tap word twice to toggle
          </Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadText, { color: colors.mutedForeground }]}>
            Loading surah...
          </Text>
        </View>
      )}

      {isError && (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Could not load surah
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.primaryForeground }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      )}

      {data && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {showBismillah && (
            <View style={[styles.bismillahCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bismillah, { color: colors.primary }]}>{BISMILLAH}</Text>
            </View>
          )}

          {data.ayahs.map((ayah) => {
            const words = ayah.text.split(" ");
            return (
              <View
                key={ayah.number}
                style={[styles.ayahCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                testID={`ayah-${ayah.numberInSurah}`}
              >
                <View style={[styles.ayahNumBadge, { borderColor: colors.accent }]}>
                  <Text style={[styles.ayahNum, { color: colors.accent }]}>
                    {ayah.numberInSurah}
                  </Text>
                </View>
                <View style={styles.wordsRow}>
                  {words.map((word, wi) => {
                    const wordId = `${surahNumber}-${ayah.numberInSurah}-${wi}`;
                    const isMistake = mistakes.has(wordId);
                    return (
                      <Pressable
                        key={wordId}
                        onPress={() => handleWordPress(wordId)}
                        style={[
                          styles.wordPill,
                          isMistake && { backgroundColor: colors.mistakeBg },
                        ]}
                        testID={`word-${wordId}`}
                      >
                        <Text
                          style={[
                            styles.wordText,
                            { color: isMistake ? colors.mistakeText : colors.foreground },
                          ]}
                        >
                          {word}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View
        style={[
          styles.navBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 4),
          },
        ]}
      >
        <Pressable
          onPress={() => surahNumber > 1 && router.replace(`/surah/${surahNumber - 1}`)}
          style={({ pressed }) => [
            styles.navBtn,
            { backgroundColor: colors.secondary, opacity: surahNumber <= 1 ? 0.4 : pressed ? 0.7 : 1 },
          ]}
          disabled={surahNumber <= 1}
        >
          <Ionicons name="chevron-back" size={18} color={colors.foreground} />
          <Text style={[styles.navBtnText, { color: colors.foreground }]}>Prev</Text>
        </Pressable>

        <Text style={[styles.navLabel, { color: colors.mutedForeground }]}>
          Surah {surahNumber} of 114
        </Text>

        <Pressable
          onPress={() => surahNumber < 114 && router.replace(`/surah/${surahNumber + 1}`)}
          style={({ pressed }) => [
            styles.navBtn,
            { backgroundColor: colors.secondary, opacity: surahNumber >= 114 ? 0.4 : pressed ? 0.7 : 1 },
          ]}
          disabled={surahNumber >= 114}
        >
          <Text style={[styles.navBtnText, { color: colors.foreground }]}>Next</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerArabic: {
      fontSize: 20,
    },
    headerEng: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      letterSpacing: 1,
    },
    headerRight: {
      width: 40,
      alignItems: "center",
    },
    clearBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    mistakeBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    mistakeBarText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    errorText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    retryBtn: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryBtnText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 12,
    },
    bismillahCard: {
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 20,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    bismillah: {
      fontSize: 24,
      textAlign: "center",
      lineHeight: 44,
    },
    ayahCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    ayahNumBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
      alignSelf: "flex-end",
    },
    ayahNum: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    wordsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 4,
    },
    wordPill: {
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    wordText: {
      fontSize: 22,
      lineHeight: 40,
      textAlign: "right",
    },
    navBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
    },
    navBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    navBtnText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    navLabel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
  });
}
