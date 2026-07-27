import { useSanitizer } from '@/contexts/SanitizerContext';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SanitizationSettings } from '@/utils/sanitizer';

interface TechniqueConfig {
  key: keyof SanitizationSettings;
  label: string;
  subtitle: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  riskLevel: 'Safe' | 'Recommended' | 'Aggressive';
}

const TECHNIQUES: TechniqueConfig[] = [
  {
    key: 'cdr',
    label: 'Content Disarm & Reconstruction',
    subtitle: 'CDR',
    description:
      'Decodes each image to raw pixel data in an isolated context, then re-encodes it as a completely fresh file. Strips all container structure, non-standard headers, and appended payloads.',
    icon: 'refresh-cw',
    riskLevel: 'Recommended',
  },
  {
    key: 'metadata',
    label: 'Metadata Purge',
    subtitle: 'EXIF / IPTC / GPS',
    description:
      'Removes all embedded metadata tags — GPS coordinates, camera info, and comment fields used to hide WebShell scripts or PHP code.',
    icon: 'tag',
    riskLevel: 'Safe',
  },
  {
    key: 'lsb',
    label: 'LSB Steganography Cleanse',
    subtitle: 'Bit-plane zeroing',
    description:
      'Applies a double-pass lossy re-encode that shifts the least significant bits in each color channel, disrupting payloads hidden via LSB steganography techniques.',
    icon: 'layers',
    riskLevel: 'Recommended',
  },
  {
    key: 'eof',
    label: 'EOF Truncation',
    subtitle: 'Trailing byte removal',
    description:
      'Locates the official image end marker (FF D9 for JPEG) and truncates any bytes that exist after it — a common attack vector for appending encrypted executable payloads.',
    icon: 'scissors',
    riskLevel: 'Safe',
  },
];

const RISK_COLORS: Record<TechniqueConfig['riskLevel'], string> = {
  Safe: '#00FF41',
  Recommended: '#00BFFF',
  Aggressive: '#FF9500',
};

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSetting, isScanning } = useSanitizer();

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
        <Text style={[styles.title, { color: colors.foreground }]}>TECHNIQUES</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isScanning && (
          <View
            style={[styles.scanningBanner, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}
          >
            <Feather name="lock" size={14} color={colors.primary} />
            <Text style={[styles.bannerText, { color: colors.primary }]}>
              Settings locked during scan
            </Text>
          </View>
        )}

        {TECHNIQUES.map((tech, idx) => {
          const enabled = settings[tech.key];
          const riskColor = RISK_COLORS[tech.riskLevel];

          return (
            <View
              key={tech.key}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: enabled ? colors.primary + '44' : colors.border,
                  opacity: isScanning ? 0.6 : 1,
                },
              ]}
            >
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: enabled ? colors.primary + '20' : colors.muted },
                  ]}
                >
                  <Feather
                    name={tech.icon}
                    size={20}
                    color={enabled ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View style={styles.cardLabels}>
                  <Text style={[styles.cardLabel, { color: colors.foreground }]}>
                    {tech.label}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      {tech.subtitle}
                    </Text>
                    <View
                      style={[
                        styles.riskBadge,
                        { backgroundColor: riskColor + '22', borderColor: riskColor + '55' },
                      ]}
                    >
                      <Text style={[styles.riskText, { color: riskColor }]}>
                        {tech.riskLevel}
                      </Text>
                    </View>
                  </View>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={(v) => !isScanning && updateSetting(tech.key, v)}
                  trackColor={{ false: colors.border, true: colors.primary + '66' }}
                  thumbColor={enabled ? colors.primary : colors.mutedForeground}
                  ios_backgroundColor={colors.muted}
                  disabled={isScanning}
                />
              </View>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                {tech.description}
              </Text>
            </View>
          );
        })}

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Sanitized images are saved to a "Pruner" album in your gallery.
            Original images are not modified.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  scanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabels: { flex: 1, gap: 3 },
  cardLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  riskText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
});
