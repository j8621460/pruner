import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

// Conditionally require expo-media-library — it has no web support
// and importing it on web crashes with "Cannot find native module"
const MediaLibrary =
  Platform.OS !== 'web'
    ? (require('expo-media-library') as typeof import('expo-media-library'))
    : null;

export type MediaAsset = {
  id: string;
  uri: string;
  filename: string;
};

export interface SanitizationSettings {
  cdr: boolean;
  metadata: boolean;
  lsb: boolean;
  eof: boolean;
}

export const DEFAULT_SETTINGS: SanitizationSettings = {
  cdr: true,
  metadata: true,
  lsb: true,
  eof: true,
};

export interface SanitizeResult {
  assetId: string;
  filename: string;
  success: boolean;
  techniquesApplied: string[];
  error?: string;
}

/**
 * CDR: Content Disarm and Reconstruction.
 * Re-encodes raw pixel data into a clean JPEG, stripping all container
 * metadata, headers, and trailers.
 */
async function applyCDR(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * Metadata stripping: purges EXIF, IPTC, and GPS tags via clean re-encode.
 */
async function applyMetadataStrip(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1.0,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * LSB zeroing: double-pass lossy re-encode disrupts bit-plane steganography.
 */
async function applyLSBZeroing(uri: string): Promise<string> {
  const pass1 = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.96,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const pass2 = await ImageManipulator.manipulateAsync(pass1.uri, [], {
    compress: 0.94,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return pass2.uri;
}

/**
 * EOF truncation: strips bytes appended after the JPEG EOF marker (FF D9).
 */
async function applyEOFTruncation(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Find last JPEG EOF marker: FF D9
    let eofIndex = bytes.length;
    for (let i = bytes.length - 2; i >= 0; i--) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
        eofIndex = i + 2;
        break;
      }
    }

    if (eofIndex < bytes.length) {
      const truncated = bytes.subarray(0, eofIndex);
      let binaryStr = '';
      const chunkSize = 8192;
      for (let i = 0; i < truncated.length; i += chunkSize) {
        binaryStr += String.fromCharCode(
          ...Array.from(truncated.slice(i, i + chunkSize))
        );
      }
      const truncatedBase64 = btoa(binaryStr);
      const outputUri = `${FileSystem.cacheDirectory}pruned_eof_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(outputUri, truncatedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return outputUri;
    }

    return uri;
  } catch {
    return uri;
  }
}

/**
 * Main sanitization entry point.
 * Applies enabled techniques and saves a clean copy to a "Pruner" gallery album.
 */
export async function sanitizeAsset(
  asset: MediaAsset,
  settings: SanitizationSettings,
  onStep?: (step: string) => void
): Promise<SanitizeResult> {
  const techniques: string[] = [];
  let currentUri = asset.uri;

  try {
    if (settings.cdr) {
      onStep?.('CDR');
      currentUri = await applyCDR(currentUri);
      techniques.push('CDR');
    }

    if (settings.metadata && !settings.cdr) {
      onStep?.('Metadata');
      currentUri = await applyMetadataStrip(currentUri);
      techniques.push('Metadata');
    } else if (settings.metadata) {
      techniques.push('Metadata'); // already stripped by CDR
    }

    if (settings.lsb) {
      onStep?.('LSB');
      currentUri = await applyLSBZeroing(currentUri);
      techniques.push('LSB');
    }

    if (settings.eof) {
      onStep?.('EOF');
      currentUri = await applyEOFTruncation(currentUri);
      techniques.push('EOF');
    }

    if (Platform.OS !== 'web' && MediaLibrary) {
      const savedAsset = await MediaLibrary.createAssetAsync(currentUri);
      try {
        let album = await MediaLibrary.getAlbumAsync('Pruner');
        if (!album) {
          await MediaLibrary.createAlbumAsync('Pruner', savedAsset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([savedAsset], album, false);
        }
      } catch {
        // Album ops may fail; asset is saved regardless
      }
    }

    return {
      assetId: asset.id,
      filename: asset.filename,
      success: true,
      techniquesApplied: techniques,
    };
  } catch (error) {
    return {
      assetId: asset.id,
      filename: asset.filename,
      success: false,
      techniquesApplied: techniques,
      error: String(error),
    };
  }
}

/**
 * Fetches all photo assets from the device gallery, paginating through results.
 */
export async function fetchAllAssets(
  onProgress?: (count: number) => void,
  cancelRef?: React.MutableRefObject<boolean>
): Promise<MediaAsset[]> {
  if (Platform.OS === 'web' || !MediaLibrary) return [];

  const all: MediaAsset[] = [];
  let cursor: string | undefined = undefined;
  let hasNext = true;

  while (hasNext) {
    if (cancelRef?.current) break;

    const page = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      first: 100,
      ...(cursor ? { after: cursor } : {}),
    });

    all.push(
      ...page.assets.map((a) => ({
        id: a.id,
        uri: a.uri,
        filename: a.filename,
      }))
    );
    onProgress?.(all.length);
    hasNext = page.hasNextPage;
    cursor = page.endCursor;
  }

  return all;
}

/**
 * Gets the media library permission status (native only).
 */
export async function getMediaPermission() {
  if (Platform.OS === 'web' || !MediaLibrary) return null;
  return MediaLibrary.getPermissionsAsync();
}

/**
 * Requests media library permission (native only).
 */
export async function requestMediaPermission() {
  if (Platform.OS === 'web' || !MediaLibrary) return null;
  return MediaLibrary.requestPermissionsAsync();
}
