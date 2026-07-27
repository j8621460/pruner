import { useSanitizer } from '@/contexts/SanitizerContext';
import { useColors } from '@/hooks/useColors';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function PermissionGate() {
  const colors = useColors();
  const { permission, requestPermission } = useSanitizer();
  const insets = useSafeAreaInsets();

  const denied =
    permission &&
    !permission.granted &&
    permission.status === 'denied' &&
    !permission.canAskAgain;

  return (
    <View
      style={[
        styles.permissionContainer,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0),
        },
      ]}
    >
      <MaterialCommunityIcons
        name="shield-lock-outline"
        size={72}
        color={colors.primary}
      />
      <Text style={[styles.permTitle, { color: colors.foreground }]}>
        Gallery Access Required
      </Text>
      <Text style={[styles.permBody, { color: colors.mutedForeground }]}>
        Image Pruner needs access to your photo library to scan and sanitize
        images for hidden malware, metadata, and steganographic payloads.
      </Text>
      {denied ? (
        <Text style={[styles.permDenied, { color: colors.destructive }]}>
          Permission denied. Open your device Settings and allow photo access
          for Image Pruner.
        </Text>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.permButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={requestPermission}
        >
          <Text style={[styles.permButtonText, { color: colors.primaryForeground }]}>
            Grant Access
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ProgressBar({
  progress,
  color,
  bg,
}: {
  progress: number;
  color: string;
  bg: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(1, Math.max(0, progress)),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={[styles.progressTrack, { backgroundColor: bg }]}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            backgroundColor: color,
            width: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

function PulseRing({ active, color }: { active: boolean; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      opacity.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { borderColor: color, transform: [{ scale }], opacity },
      ]}
    />
  );
}

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    permission,
    isScanning,
    phase,
    totalImages,
    processedImages,
    currentImageName,
    currentStep,
    successCount,
    errorCount,
    startScan,
    cancelScan,
  } = useSanitizer();

  const needsPermission =
    Platform.OS !== 'web' && (!permission || !permission.granted);

  if (needsPermission) return <PermissionGate />;

  const progress =
    totalImages > 0 ? processedImages / totalImages : 0;
  const isDone = phase === 'done';
  const isIdle = phase === 'idle';

  const handlePrimary = async () => {
    if (isScanning) {
      cancelScan();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startScan();
    }
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.appName, { color: colors.foreground }]}>
            IMAGE PRUNER
          </Text>
          <Text style={[styles.appTagline, { color: colors.mutedForeground }]}>
            Malware Sanitization Engine
          </Text>
        </View>

        {/* Shield / Status Hub */}
        <View style={styles.hubContainer}>
          <PulseRing active={isScanning} color={colors.primary} />
          <View
            style={[
              styles.shieldCircle,
              { backgroundColor: colors.card, borderColor: isScanning ? colors.primary : colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name={isDone ? 'shield-check' : isScanning ? 'shield-refresh-outline' : 'shield-outline'}
              size={52}
              color={isDone ? colors.primary : isScanning ? colors.primary : colors.mutedForeground}
            />
          </View>
        </View>

        {/* Phase label */}
        <Text style={[styles.phaseLabel, { color: colors.primary }]}>
          {phase === 'idle' && 'READY'}
          {phase === 'indexing' && 'INDEXING GALLERY...'}
          {phase === 'sanitizing' && 'SANITIZING'}
          {phase === 'done' && 'COMPLETE'}
          {phase === 'error' && 'ERROR'}
        </Text>

        {/* Progress area */}
        {(isScanning || isDone) && (
          <View
            style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {phase === 'sanitizing' || isDone ? (
              <>
                <ProgressBar
                  progress={progress}
                  color={colors.primary}
                  bg={colors.muted}
                />
                <View style={styles.progressMeta}>
                  <Text style={[styles.progressCount, { color: colors.foreground }]}>
                    {processedImages}
                    <Text style={{ color: colors.mutedForeground }}>
                      {' '}/ {totalImages}
                    </Text>
                  </Text>
                  <Text style={[styles.progressPct, { color: colors.primary }]}>
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
                {currentImageName.length > 0 && !isDone && (
                  <Text
                    numberOfLines={1}
                    style={[styles.currentFile, { color: colors.mutedForeground }]}
                  >
                    [{currentStep}]  {currentImageName}
                  </Text>
                )}
              </>
            ) : phase === 'indexing' ? (
              <Text style={[styles.indexingText, { color: colors.mutedForeground }]}>
                Scanning gallery... {totalImages} images found
              </Text>
            ) : null}

            {/* Stats row */}
            {(isDone || processedImages > 0) && (
              <View style={styles.statsRow}>
                <View style={[styles.statBadge, { backgroundColor: colors.muted }]}>
                  <Feather name="check-circle" size={14} color={colors.primary} />
                  <Text style={[styles.statNum, { color: colors.primary }]}>
                    {successCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                    clean
                  </Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: colors.muted }]}>
                  <Feather name="alert-triangle" size={14} color={colors.destructive} />
                  <Text style={[styles.statNum, { color: colors.destructive }]}>
                    {errorCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                    errors
                  </Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: colors.muted }]}>
                  <Feather name="image" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.statNum, { color: colors.foreground }]}>
                    {totalImages}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                    total
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Idle description */}
        {isIdle && (
          <View style={styles.descContainer}>
            {[
              {
                icon: 'refresh-cw' as const,
                label: 'CDR Re-render',
                desc: 'Decodes pixels into a clean container, stripping all structure',
              },
              {
                icon: 'tag' as const,
                label: 'Metadata Purge',
                desc: 'Removes EXIF, GPS, IPTC and hidden comment fields',
              },
              {
                icon: 'layers' as const,
                label: 'LSB Zeroing',
                desc: 'Disrupts bit-plane steganography payloads in color channels',
              },
              {
                icon: 'scissors' as const,
                label: 'EOF Truncation',
                desc: 'Strips bytes appended after the official image end marker',
              },
            ].map((item) => (
              <View
                key={item.label}
                style={[styles.techniqueRow, { borderColor: colors.border }]}
              >
                <Feather name={item.icon} size={18} color={colors.primary} />
                <View style={styles.techniqueText}>
                  <Text style={[styles.techniqueName, { color: colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.techniqueDesc, { color: colors.mutedForeground }]}>
                    {item.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {isDone && (
          <Text style={[styles.doneNote, { color: colors.mutedForeground }]}>
            Sanitized images saved to your gallery under the "Pruner" album.
          </Text>
        )}
      </ScrollView>

      {/* Primary action button */}
      <View style={[styles.buttonRow, { paddingBottom: Math.max(insets.bottom, 16) + webBotPad }]}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: isScanning ? colors.secondary : colors.primary,
              borderColor: isScanning ? colors.border : colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handlePrimary}
        >
          <Feather
            name={isScanning ? 'square' : isDone ? 'refresh-cw' : 'play'}
            size={20}
            color={isScanning ? colors.foreground : colors.primaryForeground}
          />
          <Text
            style={[
              styles.primaryBtnText,
              { color: isScanning ? colors.foreground : colors.primaryForeground },
            ]}
          >
            {isScanning ? 'CANCEL' : isDone ? 'SCAN AGAIN' : 'START SCAN'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },

  // Permission
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 16,
  },
  permTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  permBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  permDenied: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  permButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },

  // Header
  header: { alignItems: 'center', marginBottom: 28 },
  appName: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 4,
  },
  appTagline: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 2,
    marginTop: 4,
  },

  // Shield hub
  hubContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    height: 110,
  },
  shieldCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },

  // Phase label
  phaseLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Progress card
  progressCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    gap: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressCount: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  progressPct: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  currentFile: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
  },
  indexingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  statBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  statNum: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },

  // Idle description
  descContainer: { gap: 12 },
  techniqueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  techniqueText: { flex: 1, gap: 3 },
  techniqueName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  techniqueDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },

  doneNote: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },

  // Bottom button
  buttonRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});
