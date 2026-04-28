import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { Shadow } from 'react-native-shadow-2';

import { getStampVisualPreset, getAchievementVisual } from '../config/passportVisuals';
import { listAchievementDefinitions, passportService, PassportStopTarget } from '../services/passport';
import { PassportSnapshot, PassportStamp } from '../types/passport';
import { theme, palette } from '../theme';
import { useProfile } from '../hooks/useProfile';

const { width, height } = Dimensions.get('window');

let MapView: any = null;
let Marker: any = null;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
} catch {
  MapView = null;
  Marker = null;
}

const formatStampDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const EMPTY_SNAPSHOT: PassportSnapshot = {
  stamps: [],
  achievements: [],
  stats: {
    totalStampedStops: 0,
    uniqueCities: 0,
    uniqueCountries: 0,
    completedDayCount: 0,
    homeCountryCode: null,
    firstStampAt: null,
    lastStampAt: null,
  },
  dayProgress: [],
  offline: false,
  offlineSavedAt: null,
  permissionStatus: 'undetermined',
};

// Component for a grid item in the Dossier (Stamps)
const StampGridItem: React.FC<{ stamp: PassportStamp; onPress: () => void }> = ({ stamp, onPress }) => {
  const visual = getStampVisualPreset(stamp.placeId || stamp.id);
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.gridItemWrapper}>
      <Shadow distance={4} startColor="rgba(0,0,0,0.04)" offset={[0, 2]} style={{ width: '100%' }} containerStyle={{ width: '100%' }}>
        <View style={[styles.gridCard, { borderTopColor: visual.ring, borderTopWidth: 3 }]}>
          <View style={[styles.gridIconBox, { backgroundColor: visual.fill }]}>
            <Text style={[styles.gridIconText, { color: visual.text }]}>{visual.glyph}</Text>
          </View>
          <View style={styles.gridMeta}>
            <Text style={styles.gridTitle} numberOfLines={1}>{stamp.title.toUpperCase()}</Text>
            <Text style={styles.gridSub} numberOfLines={1}>{stamp.city || 'STOP'}</Text>
            <Text style={styles.gridDate}>{formatStampDate(stamp.stampedAt)}</Text>
          </View>
        </View>
      </Shadow>
    </TouchableOpacity>
  );
};

// Component for a grid item in the Dossier (Visas/Achievements)
const VisaGridItem: React.FC<{ item: any; isLocked?: boolean; stats: PassportSnapshot['stats'] }> = ({ item, isLocked, stats }) => {
  const definition = listAchievementDefinitions().find(def => def.key === item.achievementKey);
  const visual = getAchievementVisual(item.achievementKey);

  const progress = useMemo(() => {
    if (!isLocked || !definition?.threshold) return null;
    let current = 0;
    if (definition.group === 'places') current = stats.totalStampedStops;
    else if (definition.group === 'countries') current = stats.uniqueCountries;
    else if (definition.group === 'completion') current = stats.completedDayCount;
    return { current: Math.min(current, definition.threshold), total: definition.threshold };
  }, [definition, isLocked, stats]);

  return (
    <View style={styles.gridItemWrapper}>
      <Shadow distance={4} startColor="rgba(0,0,0,0.04)" offset={[0, 2]} style={{ width: '100%' }} containerStyle={{ width: '100%' }}>
        <View style={[styles.gridCard, isLocked && styles.gridCardLocked, { borderTopColor: isLocked ? theme.colors.border : visual.ring, borderTopWidth: 3 }]}>
          <View style={[styles.gridIconBox, { backgroundColor: isLocked ? palette.softGray : visual.fill }]}>
             <Ionicons name={visual.iconName as any} size={24} color={isLocked ? palette.mediumGray : visual.text} />
          </View>
          <View style={styles.gridMeta}>
            <Text style={[styles.gridTitle, isLocked && { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {(definition?.title || item.achievementKey).toUpperCase()}
            </Text>
            {isLocked && progress ? (
               <View style={styles.gridProgressRow}>
                  <View style={styles.gridProgressBarBg}>
                      <View style={[styles.gridProgressBarFill, { width: `${(progress.current / progress.total) * 100}%` }]} />
                  </View>
                  <Text style={styles.gridProgressText}>{progress.current}/{progress.total}</Text>
               </View>
            ) : !isLocked ? (
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} style={{ marginTop: 4 }} />
            ) : (
                <Text style={styles.gridSub}>LOCKED</Text>
            )}
          </View>
        </View>
      </Shadow>
    </View>
  );
};

type CarouselMode = 'records' | 'visas';

const PassportScreen = () => {
  const { profile } = useProfile();
  const [snapshot, setSnapshot] = useState<PassportSnapshot>(EMPTY_SNAPSHOT);
  const [pendingStops, setPendingStops] = useState<PassportStopTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [mode, setMode] = useState<CarouselMode>('records');
  const mapRef = useRef<any>(null);
  const permissionPaused = snapshot.permissionStatus === 'denied';

  const loadSnapshot = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMessage(null);

    try {
      const next = await passportService.loadSnapshot();
      setSnapshot(next);
      
      try {
        const activeStopsResult = await passportService.listActiveItineraryStops();
        setPendingStops(activeStopsResult.stops);
      } catch {
        // Non-blocking
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Could not load passport right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSnapshot(false);
    }, [loadSnapshot]),
  );

  const mappedStamps = useMemo(
    () => snapshot.stamps.filter(stamp => stamp.lat != null && stamp.lng != null),
    [snapshot.stamps],
  );

  const unlockedKeys = useMemo(
    () => new Set(snapshot.achievements.map(item => item.achievementKey)),
    [snapshot.achievements],
  );

  const lockedAchievements = useMemo(
    () => listAchievementDefinitions().filter(item => !unlockedKeys.has(item.key)),
    [unlockedKeys],
  );

  const unearnedStops = useMemo(() => {
    const stampedPlaceIds = new Set(snapshot.stamps.map(s => s.placeId));
    return pendingStops.filter(stop => !stampedPlaceIds.has(stop.placeId));
  }, [pendingStops, snapshot.stamps]);

  const combinedVisas = useMemo(() => {
      const earned = snapshot.achievements.map(a => ({ ...a, isLocked: false }));
      const locked = lockedAchievements.map(a => ({ id: a.key, achievementKey: a.key, isLocked: true }));
      return [...earned, ...locked];
  }, [snapshot.achievements, lockedAchievements]);

  const goToStamp = useCallback((stamp: PassportStamp) => {
      setIsDossierOpen(false);
      if (stamp.lat && stamp.lng && mapRef.current) {
          mapRef.current.animateCamera({
              center: { latitude: stamp.lat, longitude: stamp.lng },
              pitch: 0,
              heading: 0,
              zoom: 14,
          }, { duration: 1000 });
      }
  }, []);

  const initialMapRegion = useMemo(() => {
    if (mappedStamps.length > 0 || unearnedStops.length > 0) {
      const allStamps = [...mappedStamps, ...unearnedStops];
      const lats = allStamps.map(s => s.lat as number);
      const lngs = allStamps.map(s => s.lng as number);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 2),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 2),
      };
    }
    if (profile?.home_lat && profile?.home_lng) {
      return {
        latitude: profile.home_lat,
        longitude: profile.home_lng,
        latitudeDelta: 20,
        longitudeDelta: 20,
      };
    }
    return {
      latitude: 34.0,
      longitude: -40.0,
      latitudeDelta: 60,
      longitudeDelta: 60,
    };
  }, [mappedStamps, unearnedStops, profile]);

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.stateTitle}>AUTHENTICATING JOURNEY...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={44} color={theme.colors.primary} />
        <Text style={styles.stateTitle}>IDENTITY VERIFICATION FAILED</Text>
        <Text style={styles.stateSubtitle}>{errorMessage}</Text>
        <TouchableOpacity style={styles.primaryCta} onPress={() => void loadSnapshot(true)}>
          <Text style={styles.primaryCtaText}>RETRY SYNC</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (snapshot.stamps.length === 0 && snapshot.permissionStatus === 'denied') {
    return (
      <View style={styles.centeredState}>
        <View style={styles.stateIconCircle}>
          <Ionicons name="location-outline" size={32} color={theme.colors.primary} />
        </View>
        <Text style={styles.stateTitle}>LOCATION SERVICES REQUIRED</Text>
        <Text style={styles.stateSubtitle}>
          Travis requires location access to stamp your passport as you explore. Enable permissions to resume tracking.
        </Text>
        <TouchableOpacity
          style={styles.primaryCta}
          onPress={() => {
            void Linking.openSettings();
          }}
        >
          <Text style={styles.primaryCtaText}>OPEN SYSTEM SETTINGS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFillObject}>
        {MapView ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            customMapStyle={vintageMapStyle}
            initialRegion={initialMapRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            pitchEnabled={false}
          >
            {mappedStamps.map((stamp, idx) => (
              <Marker
                key={stamp.id}
                coordinate={{
                  latitude: stamp.lat as number,
                  longitude: stamp.lng as number,
                }}
                onPress={() => {
                    mapRef.current?.animateToRegion({
                        latitude: stamp.lat as number,
                        longitude: stamp.lng as number,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }, 600);
                }}
              >
                <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: idx * 50 }}>
                  <View style={styles.customMarker}>
                    <View style={styles.markerDot} />
                  </View>
                </MotiView>
              </Marker>
            ))}
            {unearnedStops.map((stop, idx) => (
              <Marker
                key={`pending-${stop.placeId}-${idx}`}
                coordinate={{ latitude: stop.lat, longitude: stop.lng }}
                opacity={0.5}
              >
                <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: (mappedStamps.length + idx) * 50 }}>
                  <View style={[styles.customMarker, { backgroundColor: 'rgba(26, 26, 26, 0.05)', borderColor: palette.mediumGray, borderWidth: 1 }]}>
                    <View style={[styles.markerDot, { backgroundColor: palette.mediumGray }]} />
                  </View>
                </MotiView>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={48} color={palette.mediumGray} />
            <Text style={styles.mapFallbackText}>MAP OFFLINE</Text>
          </View>
        )}
      </View>

      <View style={styles.hudContainer} pointerEvents="box-none">
        <MotiView from={{ opacity: 0, translateY: -20 }} animate={{ opacity: 1, translateY: 0 }} style={styles.topHud}>
          <Shadow distance={8} startColor="rgba(0,0,0,0.06)" offset={[0, 4]}>
            <View style={styles.headerPill}>
              <View style={styles.headerAvatar}><Ionicons name="person" size={18} color={palette.white} /></View>
              <View>
                  <Text style={styles.headerTitle}>NOMAD LOG</Text>
                  <Text style={styles.headerSub}>{profile?.home_city?.toUpperCase() || 'WORLD CITIZEN'}</Text>
              </View>
              <View style={styles.headerDivider} />
              <View style={styles.headerStatBox}>
                  <Text style={styles.headerStatNum}>{snapshot.stats.totalStampedStops}</Text>
                  <Text style={styles.headerStatLabel}>STAMPS</Text>
              </View>
            </View>
          </Shadow>
          {(snapshot.offline || permissionPaused) && (
            <View style={styles.statusStack}>
              {snapshot.offline && (
                <View style={styles.statusPill} accessible accessibilityLabel="Offline snapshot mode">
                  <Ionicons name="cloud-offline-outline" size={14} color="#8A4A00" />
                  <Text style={styles.statusText}>
                    OFFLINE SNAPSHOT{snapshot.offlineSavedAt ? ` | ${formatStampDate(snapshot.offlineSavedAt)}` : ''}
                  </Text>
                </View>
              )}
              {permissionPaused && (
                <View style={styles.statusPillMuted}>
                  <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.statusMutedText}>AUTO-STAMP PAUSED</Text>
                  <TouchableOpacity
                    style={styles.statusAction}
                    onPress={() => {
                      void Linking.openSettings();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Open settings to enable location permission"
                  >
                    <Text style={styles.statusActionText}>SETTINGS</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </MotiView>

        <MotiView from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', delay: 400 }} style={styles.bottomHud}>
           <Shadow distance={12} startColor="rgba(0,0,0,0.15)" offset={[0, 6]}>
              <TouchableOpacity style={styles.fab} onPress={() => setIsDossierOpen(true)} activeOpacity={0.9}>
                 <Ionicons name="journal" size={24} color={palette.white} />
                 <Text style={styles.fabText}>VIEW PASSPORT DOSSIER</Text>
              </TouchableOpacity>
           </Shadow>
        </MotiView>
      </View>

      <AnimatePresence>
        {isDossierOpen && (
          <MotiView
            key="dossier-panel"
            from={{ translateY: height }}
            animate={{ translateY: height * 0.15 }}
            exit={{ translateY: height }}
            transition={{ type: 'spring', damping: 45, stiffness: 120 }}
            style={styles.dossierOverlay}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(249, 248, 246, 0.98)' }]} />

            <View style={styles.dossierContent}>
                <View style={styles.dossierHeader}>
                    <View style={styles.dossierHeaderTop}>
                        <Text style={styles.dossierTitle}>TRAVELER DOSSIER</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setIsDossierOpen(false)}>
                            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.toggleTrack}>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, mode === 'records' && styles.toggleBtnActive]}
                            onPress={() => setMode('records')}
                        >
                            <Text style={[styles.toggleText, mode === 'records' && styles.toggleTextActive]}>LOG ENTRIES</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, mode === 'visas' && styles.toggleBtnActive]}
                            onPress={() => setMode('visas')}
                        >
                            <Text style={[styles.toggleText, mode === 'visas' && styles.toggleTextActive]}>VISA BOARD</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ flex: 1 }}>
                    {mode === 'records' ? (
                        <FlatList
                            key="records-grid"
                            data={snapshot.stamps}
                            keyExtractor={item => item.id}
                            numColumns={2}
                            columnWrapperStyle={styles.columnWrapper}
                            renderItem={({ item }) => <StampGridItem stamp={item} onPress={() => goToStamp(item)} />}
                            contentContainerStyle={styles.listPadding}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={styles.emptyDossier}>
                                    <Ionicons name="compass-outline" size={48} color={palette.mediumGray} />
                                    <Text style={styles.emptyTitle}>NO ENTRIES RECORDED</Text>
                                    <Text style={styles.emptyDesc}>Visit your first itinerary stop to begin building your travel log.</Text>
                                </View>
                            }
                        />
                    ) : (
                        <FlatList
                            key="visas-grid"
                            data={combinedVisas}
                            keyExtractor={item => item.id}
                            numColumns={2}
                            columnWrapperStyle={styles.columnWrapper}
                            renderItem={({ item }) => <VisaGridItem item={item} isLocked={item.isLocked} stats={snapshot.stats} />}
                            contentContainerStyle={styles.listPadding}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
};

const vintageMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  stateTitle: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: theme.typography.fonts.black, letterSpacing: 1 },
  stateSubtitle: { marginTop: 12, color: theme.colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, fontFamily: theme.typography.fonts.narrative },
  stateIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: palette.softGray, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  primaryCta: { marginTop: 32, height: 50, paddingHorizontal: 24, borderRadius: 12, backgroundColor: theme.colors.textPrimary, alignItems: 'center', justifyContent: 'center' },
  primaryCtaText: { color: '#FFF', fontSize: 12, letterSpacing: 2, fontFamily: theme.typography.fonts.black },
  mapFallback: { flex: 1, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  mapFallbackText: { marginTop: 12, fontFamily: theme.typography.fonts.technicalBold, fontSize: 12, color: palette.mediumGray, letterSpacing: 2 },
  customMarker: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(26, 26, 26, 0.15)', alignItems: 'center', justifyContent: 'center' },
  markerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  
  hudContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingBottom: Platform.OS === 'ios' ? 100 : 80 },
  topHud: { paddingTop: Platform.OS === 'ios' ? 120 : 100, paddingHorizontal: 20, alignItems: 'center' },
  headerPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.white, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, gap: 10 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: theme.typography.fonts.black, fontSize: 11, color: theme.colors.textPrimary, letterSpacing: 1 },
  headerSub: { fontFamily: theme.typography.fonts.technicalBold, fontSize: 8, color: theme.colors.textSecondary, letterSpacing: 0.5 },
  headerDivider: { width: 1, height: 20, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  headerStatBox: { alignItems: 'flex-end' },
  headerStatNum: { fontFamily: theme.typography.fonts.black, fontSize: 14, color: theme.colors.textPrimary },
  headerStatLabel: { fontFamily: theme.typography.fonts.technicalBold, fontSize: 7, color: theme.colors.textSecondary, letterSpacing: 1 },
  statusStack: { marginTop: 10, width: '100%', gap: 8, alignItems: 'center' },
  statusPill: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(249, 168, 37, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(138, 74, 0, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    color: '#8A4A00',
    letterSpacing: 0.9,
  },
  statusPillMuted: {
    minHeight: 36,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusMutedText: {
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    color: theme.colors.textSecondary,
    letterSpacing: 0.9,
  },
  statusAction: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.softGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActionText: {
    fontFamily: theme.typography.fonts.black,
    fontSize: 8,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  
  bottomHud: { alignItems: 'center', paddingHorizontal: 20 },
  fab: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.textPrimary, paddingHorizontal: 20, height: 56, borderRadius: 28, gap: 12 },
  fabText: { color: palette.white, fontFamily: theme.typography.fonts.black, fontSize: 12, letterSpacing: 1 },

  dossierOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: height * 0.85, zIndex: 100, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  dossierContent: { flex: 1, paddingTop: 10 },
  dossierHeader: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dossierHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dossierTitle: { fontFamily: theme.typography.fonts.black, fontSize: 20, color: theme.colors.textPrimary, letterSpacing: 2 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.softGray, borderRadius: 22 },
  
  toggleTrack: { flexDirection: 'row', backgroundColor: palette.softGray, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: palette.white },
  toggleText: { fontFamily: theme.typography.fonts.technicalBold, fontSize: 10, color: theme.colors.textSecondary, letterSpacing: 1 },
  toggleTextActive: { color: theme.colors.textPrimary },
  
  columnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  listPadding: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  
  gridItemWrapper: { width: (width - 52) / 2 }, 
  gridCard: { backgroundColor: palette.white, padding: 12, borderRadius: 12, alignItems: 'center', minHeight: 140 },
  gridCardLocked: { backgroundColor: 'rgba(0,0,0,0.02)', opacity: 0.8 },
  gridIconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gridIconText: { fontSize: 20, fontFamily: theme.typography.fonts.black },
  gridMeta: { alignItems: 'center', width: '100%' },
  gridTitle: { fontFamily: theme.typography.fonts.black, fontSize: 11, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  gridSub: { fontFamily: theme.typography.fonts.technicalBold, fontSize: 9, color: theme.colors.textSecondary, marginTop: 2, textAlign: 'center' },
  gridDate: { fontFamily: theme.typography.fonts.technicalBold, fontSize: 8, color: theme.colors.mediumGray, marginTop: 4, textAlign: 'center' },
  
  gridProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, width: '100%' },
  gridProgressBarBg: { flex: 1, height: 4, backgroundColor: palette.softGray, borderRadius: 2, overflow: 'hidden' },
  gridProgressBarFill: { height: '100%', backgroundColor: theme.colors.primary },
  gridProgressText: { fontSize: 7, fontFamily: theme.typography.fonts.technicalBold, color: theme.colors.textSecondary },
  
  emptyDossier: { paddingVertical: 100, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: theme.typography.fonts.black, fontSize: 14, color: theme.colors.textPrimary, letterSpacing: 1, marginTop: 16 },
  emptyDesc: { fontFamily: theme.typography.fonts.narrative, fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 }
});

export default PassportScreen;
