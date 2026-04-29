import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Json } from '../types/database';
import { supabase } from './supabase';

const MANIFEST_CACHE_KEY = 'blame_travis:stamp_art_manifest:v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const STAMP_ART_BUCKET = 'passport-stamps';

type StampArtManifestRow = {
  achievement_key: string;
  version: number;
  storage_path?: string | null;
  locked_storage_path?: string | null;
  theme_metadata?: Json;
  image_path?: string | null;
  locked_image_path?: string | null;
};

export type StampArtManifestEntry = {
  achievementKey: string;
  version: number;
  imageUrl: string | null;
  lockedImageUrl: string | null;
  themeMetadata: Json;
};

type ManifestCache = {
  savedAt: number;
  entries: Record<string, StampArtManifestEntry>;
};

let memoryCache: Record<string, StampArtManifestEntry> | null = null;
let fetchPromise: Promise<Record<string, StampArtManifestEntry>> | null = null;

const resolveAssetUrl = (pathOrUrl?: string | null): string | null => {
  if (!pathOrUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const { data } = supabase.storage.from(STAMP_ART_BUCKET).getPublicUrl(pathOrUrl);
  return data.publicUrl || null;
};

const normalizeRow = (row: StampArtManifestRow): StampArtManifestEntry => ({
  achievementKey: row.achievement_key,
  version: row.version,
  imageUrl: resolveAssetUrl(row.storage_path ?? row.image_path),
  lockedImageUrl: resolveAssetUrl(row.locked_storage_path ?? row.locked_image_path),
  themeMetadata: row.theme_metadata ?? {},
});

export const stampArtService = {
  async fetchManifest(forceRefresh = false): Promise<Record<string, StampArtManifestEntry>> {
    if (!forceRefresh && memoryCache) {
      return memoryCache;
    }

    if (fetchPromise && !forceRefresh) {
      return fetchPromise;
    }

    fetchPromise = (async () => {
      try {
        if (!forceRefresh) {
          const raw = await AsyncStorage.getItem(MANIFEST_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as ManifestCache;
            if (Date.now() - parsed.savedAt < CACHE_TTL_MS) {
              memoryCache = parsed.entries;
              return memoryCache;
            }
          }
        }

        // `select('*')` keeps backward compatibility with any pre-migration rows that
        // still store legacy URL fields instead of stable storage paths.
        const { data, error } = await supabase.from('passport_stamp_art_manifest').select('*');

        if (error) {
          throw new Error(error.message || 'Failed to load stamp art manifest.');
        }

        const entries: Record<string, StampArtManifestEntry> = {};
        for (const row of (data || []) as StampArtManifestRow[]) {
          entries[row.achievement_key] = normalizeRow(row);
        }

        memoryCache = entries;
        await AsyncStorage.setItem(
          MANIFEST_CACHE_KEY,
          JSON.stringify({ savedAt: Date.now(), entries }),
        );
      } catch (error) {
        console.warn('Failed to fetch stamp art manifest:', error);

        if (!memoryCache) {
          const raw = await AsyncStorage.getItem(MANIFEST_CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as ManifestCache;
            memoryCache = parsed.entries;
          } else {
            memoryCache = {};
          }
        }
      }

      return memoryCache || {};
    })();

    try {
      return await fetchPromise;
    } finally {
      fetchPromise = null;
    }
  },

  getEntry(achievementKey: string): StampArtManifestEntry | null {
    if (!memoryCache) {
      return null;
    }
    return memoryCache[achievementKey] || null;
  },
};
