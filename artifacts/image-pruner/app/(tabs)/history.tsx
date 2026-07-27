import { useSanitizer } from '@/contexts/SanitizerContext';
import { useColors } from '@/hooks/useColors';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScanSession } from '@/contexts/SanitizerContext';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SessionCard({ session }: { session: ScanSession }) {
  const colors = useColors();
  const successRate =
    session.totalImages > 0
      ? Math.round((session.successCount / session.totalImages) * 100)
      : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
            {formatDate(session.timestamp)}
          </Text>
          <Text style={[styles.cardImages, { color: colors.foreground }]}>
            {session.totalImages} images
          </Text>
        </View>
        <View
          style={[
            styles.rateBadge,
            {
              backgroundColor:
                successRate === 100
                  ? colors.primary + '22'
                  : colors.muted,
              borderColor:
                successRate === 100 ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.rateText,
              {
                color: successRate === 100 ? colors.primary : colors.foreground,
              },
            ]}
          >
            {successRate}%
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.statGroup}>
          <Feather name="check-circle" size={12} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {session.successCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>ok</Text>
        </View>
        {session.errorCount > 0 && (
          <View style={styles.statGroup}>
            <Feather name="alert-circle" size={12} color={colors.destructive} />
            <Text style={[styles.statValue, { color: colors.destructive }]}>
              {session.errorCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>err</Text>
          </View>
        )}
        <View style={styles.statGroup}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {formatDuration(session.durationMs)}
          </Text>
        </View>
      </View>

      {/* Techniques chips */}
      <View style={styles.chipRow}>
        {session.techniques.map((t) => (
          <View
            key={t}
            style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}
          >
            <Text style={[styles.chipText, { color: colors.primary }]}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history, clearHistory } = useSanitizer();

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear History',
      'Remove all scan session records?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearHistory,
        },
      ]
    );
  };

  const webTopPad = Platform.OS === 'web' ? 67 : 0;
  const webBotPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + webTopPad,
          paddingBottom: insets.bottom + webBotPad,
        },
      ]}
    >
      {/* Title bar */}
      <View style={[styles.titleBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>SCAN LOG</Text>
        {history.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </Pressable>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="database-remove-outline"
            size={52}
            color={colors.border}
          />
          <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
            No scans yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.border }]}>
            Run your first scan from the Shield tab
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SessionCard session={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
  },
  list: { padding: 16 },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },

  // Card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardLeft: { gap: 2 },
  cardDate: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
  },
  cardImages: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  rateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  rateText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  cardBody: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
});
