/* global console, process */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'passport-stamps';
const VERSION_PREFIX = 'v1';
const ACHIEVEMENT_KEYS = [
  'first_stamp',
  'first_abroad',
  'places_5',
  'places_10',
  'places_25',
  'places_50',
  'places_100',
  'countries_2',
  'countries_5',
  'countries_10',
  'days_completed_1',
  'days_completed_5',
  'days_completed_10',
];

const parseArg = (flagName) => {
  const index = process.argv.indexOf(flagName);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
};

const artifactDir = parseArg('--artifact-dir');

if (!artifactDir) {
  console.error('Missing required flag: --artifact-dir <absolute-or-relative-path>');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const resolvedArtifactDir = path.resolve(artifactDir);
if (!fs.existsSync(resolvedArtifactDir)) {
  console.error(`Artifact directory does not exist: ${resolvedArtifactDir}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const selectImageFile = (files, achievementKey, suffix = '.png') =>
  files.find((fileName) => {
    if (fileName === `${achievementKey}${suffix}`) return true;
    if (fileName.startsWith(`${achievementKey}_`) && fileName.endsWith(suffix)) {
      // Ensure we don't match 'places_1' for 'places_10'
      const remainder = fileName.slice(achievementKey.length);
      return remainder.startsWith('_') || remainder.startsWith('.');
    }
    return false;
  });

async function uploadStampAsset(storagePath, localFilePath) {
  const fileBuffer = fs.readFileSync(localFilePath);
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, fileBuffer, {
    contentType: 'image/png',
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  }
}

async function main() {
  const files = fs.readdirSync(resolvedArtifactDir);

  for (const achievementKey of ACHIEVEMENT_KEYS) {
    const baseFile = selectImageFile(files, achievementKey);
    if (!baseFile) {
      console.warn(`Skipping ${achievementKey}: ${achievementKey}.png not found in ${resolvedArtifactDir}`);
      continue;
    }

    const lockedFile = selectImageFile(files, `${achievementKey}__locked`);
    const storagePath = `${VERSION_PREFIX}/${achievementKey}.png`;
    const lockedStoragePath = lockedFile ? `${VERSION_PREFIX}/${achievementKey}__locked.png` : null;

    await uploadStampAsset(storagePath, path.join(resolvedArtifactDir, baseFile));
    if (lockedFile && lockedStoragePath) {
      await uploadStampAsset(lockedStoragePath, path.join(resolvedArtifactDir, lockedFile));
    }

    const { error } = await supabase.from('passport_stamp_art_manifest').upsert(
      {
        achievement_key: achievementKey,
        version: 1,
        storage_path: storagePath,
        locked_storage_path: lockedStoragePath,
        theme_metadata: { category: achievementKey.split('_')[0] },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'achievement_key' },
    );

    if (error) {
      throw new Error(`Manifest upsert failed for ${achievementKey}: ${error.message}`);
    }

    console.log(`Uploaded manifest entry for ${achievementKey}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
