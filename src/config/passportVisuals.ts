export interface StampVisualPreset {
  id: string;
  label: string;
  glyph: string;
  fill: string;
  ring: string;
  text: string;
}

export interface AchievementVisualPreset extends StampVisualPreset {
  iconName: any; // Ionicons name
}

export const STAMP_VISUAL_PRESETS: StampVisualPreset[] = [
  {
    id: 'ink_compass',
    label: 'Ink Compass',
    glyph: 'N',
    fill: '#F5EEE4',
    ring: '#8C5C2A',
    text: '#5A3820',
  },
  {
    id: 'route_badge',
    label: 'Route Badge',
    glyph: 'R',
    fill: '#EAF2EC',
    ring: '#2E6C4D',
    text: '#1F4A35',
  },
  {
    id: 'pilot_seal',
    label: 'Pilot Seal',
    glyph: 'P',
    fill: '#F3EAF1',
    ring: '#7B3F74',
    text: '#572A52',
  },
  {
    id: 'customs_mark',
    label: 'Customs Mark',
    glyph: 'C',
    fill: '#EBF0FA',
    ring: '#355A9A',
    text: '#213C66',
  },
];

const hashKey = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const getStampVisualPreset = (key: string): StampVisualPreset => {
  if (!STAMP_VISUAL_PRESETS.length) {
    throw new Error('No passport stamp presets configured.');
  }
  const index = hashKey(key) % STAMP_VISUAL_PRESETS.length;
  return STAMP_VISUAL_PRESETS[index];
};

export const getAchievementVisual = (key: string): AchievementVisualPreset => {
  const base = getStampVisualPreset(key);
  
  let iconName = 'ribbon-outline';
  
  if (key === 'first_stamp') iconName = 'footsteps-outline';
  else if (key === 'first_abroad') iconName = 'airplane-outline';
  else if (key.startsWith('places_')) iconName = 'location-outline';
  else if (key.startsWith('countries_')) iconName = 'globe-outline';
  else if (key.startsWith('days_completed_')) iconName = 'calendar-outline';

  return { ...base, iconName };
};
