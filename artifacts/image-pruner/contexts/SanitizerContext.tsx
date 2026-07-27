import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import {
  DEFAULT_SETTINGS,
  MediaAsset,
  SanitizationSettings,
  SanitizeResult,
  fetchAllAssets,
  getMediaPermission,
  requestMediaPermission,
  sanitizeAsset,
} from '@/utils/sanitizer';

export interface ScanSession {
  id: string;
  timestamp: number;
  totalImages: number;
  successCount: number;
  errorCount: number;
  techniques: string[];
  durationMs: number;
}

interface PermissionLike {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
}

interface SanitizerContextType {
  // Permission
  permission: PermissionLike | null;
  requestPermission: () => Promise<void>;

  // Scanning state
  isScanning: boolean;
  phase: 'idle' | 'indexing' | 'sanitizing' | 'done' | 'error';
  totalImages: number;
  processedImages: number;
  currentImageName: string;
  currentStep: string;
  successCount: number;
  errorCount: number;
  lastResults: SanitizeResult[];

  // Settings
  settings: SanitizationSettings;
  updateSetting: (key: keyof SanitizationSettings, value: boolean) => void;

  // History
  history: ScanSession[];
  clearHistory: () => Promise<void>;

  // Actions
  startScan: () => Promise<void>;
  cancelScan: () => void;
}

const SanitizerContext = createContext<SanitizerContextType | null>(null);

const HISTORY_KEY = '@pruner:history';
const SETTINGS_KEY = '@pruner:settings';

export function SanitizerProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<PermissionLike | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [phase, setPhase] = useState<
    'idle' | 'indexing' | 'sanitizing' | 'done' | 'error'
  >('idle');
  const [totalImages, setTotalImages] = useState(0);
  const [processedImages, setProcessedImages] = useState(0);
  const [currentImageName, setCurrentImageName] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastResults, setLastResults] = useState<SanitizeResult[]>([]);
  const [settings, setSettings] = useState<SanitizationSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<ScanSession[]>([]);
  const cancelRef = useRef(false);

  // Load persisted settings and history
  useEffect(() => {
    (async () => {
      try {
        const [savedSettings, savedHistory] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
        ]);
        if (savedSettings) setSettings(JSON.parse(savedSettings));
        if (savedHistory) setHistory(JSON.parse(savedHistory));
      } catch {
        // Ignore
      }
    })();
  }, []);

  // Check permission on mount (native only)
  useEffect(() => {
    if (Platform.OS === 'web') {
      setPermission({ granted: true, status: 'granted', canAskAgain: false });
      return;
    }
    getMediaPermission().then((p) => {
      if (p) setPermission(p);
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const result = await requestMediaPermission();
    if (result) setPermission(result);
  }, []);

  const updateSetting = useCallback(
    (key: keyof SanitizationSettings, value: boolean) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const cancelScan = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const startScan = useCallback(async () => {
    if (Platform.OS !== 'web' && !permission?.granted) return;
    if (isScanning) return;

    cancelRef.current = false;
    setIsScanning(true);
    setPhase('indexing');
    setProcessedImages(0);
    setSuccessCount(0);
    setErrorCount(0);
    setLastResults([]);
    setCurrentImageName('');
    setCurrentStep('');
    setTotalImages(0);
    const startTime = Date.now();

    try {
      // Phase 1: Index all photos (web returns empty list with a demo message)
      const assets: MediaAsset[] =
        Platform.OS === 'web'
          ? generateWebDemoAssets()
          : await fetchAllAssets(
              (count) => setTotalImages(count),
              cancelRef
            );

      setTotalImages(assets.length);

      if (cancelRef.current || assets.length === 0) {
        setPhase('done');
        setIsScanning(false);
        return;
      }

      setPhase('sanitizing');
      const results: SanitizeResult[] = [];
      let successes = 0;
      let errors = 0;

      for (let i = 0; i < assets.length; i++) {
        if (cancelRef.current) break;

        const asset = assets[i];
        setCurrentImageName(asset.filename);

        // Simulate a short delay on web for demo purposes
        if (Platform.OS === 'web') {
          await new Promise((r) => setTimeout(r, 80));
          const demoResult: SanitizeResult = {
            assetId: asset.id,
            filename: asset.filename,
            success: true,
            techniquesApplied: Object.entries(settings)
              .filter(([, v]) => v)
              .map(([k]) => k.toUpperCase()),
          };
          results.push(demoResult);
          successes++;
          setSuccessCount(successes);
        } else {
          const result = await sanitizeAsset(asset, settings, (step) => {
            setCurrentStep(step);
          });
          results.push(result);
          if (result.success) {
            successes++;
            setSuccessCount(successes);
          } else {
            errors++;
            setErrorCount(errors);
          }
        }

        setProcessedImages(i + 1);
      }

      setLastResults(results);

      const session: ScanSession = {
        id:
          Date.now().toString() +
          Math.random().toString(36).substr(2, 6),
        timestamp: startTime,
        totalImages: assets.length,
        successCount: successes,
        errorCount: errors,
        techniques: Object.entries(settings)
          .filter(([, v]) => v)
          .map(([k]) => k.toUpperCase()),
        durationMs: Date.now() - startTime,
      };

      setHistory((prev) => {
        const next = [session, ...prev].slice(0, 50);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(
          () => {}
        );
        return next;
      });

      setPhase('done');
    } catch {
      setPhase('error');
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, permission, settings]);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  }, []);

  return (
    <SanitizerContext.Provider
      value={{
        permission,
        requestPermission,
        isScanning,
        phase,
        totalImages,
        processedImages,
        currentImageName,
        currentStep,
        successCount,
        errorCount,
        lastResults,
        settings,
        updateSetting,
        history,
        clearHistory,
        startScan,
        cancelScan,
      }}
    >
      {children}
    </SanitizerContext.Provider>
  );
}

export function useSanitizer() {
  const ctx = useContext(SanitizerContext);
  if (!ctx)
    throw new Error('useSanitizer must be used within SanitizerProvider');
  return ctx;
}

// Web demo: synthetic image assets for preview purposes
function generateWebDemoAssets(): MediaAsset[] {
  const names = [
    'IMG_0042.jpg',
    'IMG_0843.jpg',
    'photo_2024.jpg',
    'screenshot_001.png',
    'DSC_1092.jpg',
    'WhatsApp_Image.jpeg',
    'camera_roll_4517.jpg',
    'IMG_20240315.jpg',
    'selfie_beach.jpg',
    'birthday_party.jpg',
    'vacation_rome.jpg',
    'family_photo.jpg',
  ];
  return names.map((filename, i) => ({
    id: `web-demo-${i}`,
    uri: `file://demo/${filename}`,
    filename,
  }));
}
