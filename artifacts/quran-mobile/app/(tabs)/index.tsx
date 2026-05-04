import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useMistakes } from "@/hooks/useMistakes";
import { useSurahList, type Surah } from "@/hooks/useQuran";

export default function SurahListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const { data: surahs, isLoading, isError, refetch } = useSurahList();
  const { mistakeCount, clearAll } = useMistakes();

  const filtered = surahs?.filter(
    (s) =>
      s.englishName.toLowerCase().includes(search.toLowerCase()) ||
      s.name.includes(search) ||
      String(s.number).includes(search)
  );

  const handlePress = (surah: Surah) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/surah/${surah.number}`);
  };

  const styles = makeStyles(colors);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerArabic}>القرآن الكريم</Text>
          <Text style={styles.headerSub}>THE NOBLE QURAN</Text>
        </View>
        {mistakeCount > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              clearAll();
            }}
            style={styles.mistakeBadge}
            testID="mistakes-counter"
          >
            <View style={[styles.dot, { backgroundColor: colors.destructive }]} />
            <Text style={[styles.mistakeText, { color: colors.destructive }]}>
              {mistakeCount} {mistakeCount === 1 ? "mistake" : "mistakes"}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search surahs..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            testID="search-input"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading surahs...
          </Text>
        </View>
      )}

      {isError && (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Could not load surahs
          </Text>
          <Pressable onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {filtered && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.number)}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={filtered.length > 0}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => handlePress(item)}
              testID={`surah-item-${item.number}`}
            >
              <View style={[styles.numBadge, { borderColor: colors.accent }]}>
                <Text style={[styles.numText, { color: colors.accent }]}>{item.number}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.engName, { color: colors.foreground }]}>{item.englishName}</Text>
                <Text style={[styles.translation, { color: colors.mutedForeground }]}>
                  {item.englishNameTranslation}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {item.revelationType.toUpperCase()} · {item.numberOfAyahs} Ayahs
                </Text>
              </View>
              <Text style={[styles.arabicName, { color: colors.primary }]}>{item.name}</Text>
            </Pressable>
          )}
          testID="surah-list"
        />
      )}
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
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    headerArabic: {
      fontSize: 22,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
      textAlign: "right",
    },
    headerSub: {
      fontSize: 11,
      letterSpacing: 2,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
    },
    mistakeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    mistakeText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
    },
    searchRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
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
    retryText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    list: {
      paddingHorizontal: 16,
      paddingTop: 4,
      gap: 10,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    numBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    numText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    cardBody: {
      flex: 1,
      gap: 2,
    },
    engName: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    translation: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    meta: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      letterSpacing: 0.5,
      marginTop: 2,
    },
    arabicName: {
      fontSize: 22,
      textAlign: "right",
    },
  });
}
