import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Image,
  Animated,
  PanResponder,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';

import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { TravisSignal } from '../components/TravisSignal';
import { discoveryService } from '../services/discovery';

// SAFE MAP LOADING
let MapView: any = null;
let Circle: any = null;
let mapLoadError = false;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Circle = Maps.Circle;
  if (!MapView) mapLoadError = true;
} catch {
  mapLoadError = true;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdventureRequest'>;

const INTENSITIES = [
  { id: 'low', label: 'STROLL', icon: '🚶', desc: 'Slow & Steady. Minimum movement.' },
  { id: 'balanced', label: 'STEADY PACE', icon: '⚖️', desc: 'The sweet spot. A natural city flow.' },
  { id: 'high', label: 'FAST TRACK', icon: '🚀', desc: 'High energy. We’re covering ground today.' },
  { id: 'ruthless', label: 'SPRINT', icon: '⚡', desc: 'The gauntlet. Travis-style endurance.' },
];

const BUDGETS = [
  { id: 'low', label: '$', desc: 'SCREENS OFF' },
  { id: 'mid', label: '$$', desc: 'STREET FOOD' },
  { id: 'high', label: '$$$', desc: 'WHITE LINEN' },
  { id: 'travis', label: '!!!', desc: 'TRAVIS STYLE' },
];

const useImperialUnits = () => {
  const regionCode = Localization.getLocales()[0]?.regionCode;
  return regionCode === 'US' || regionCode === 'LR' || regionCode === 'MM';
};

const AdventureRequestScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const mapRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const isImperial = useMemo(() => useImperialUnits(), []);

  // Bottom Sheet Animation & Gestures
  const screenHeight = Dimensions.get('window').height;
  const SNAP_POINTS = {
    COLLAPSED: 180,
    FULL: screenHeight * 0.6
  };

  const sheetHeight = useRef(new Animated.Value(SNAP_POINTS.COLLAPSED)).current;
  const [currentSnap, setCurrentSnap] = useState('COLLAPSED');
  const currentSnapRef = useRef('COLLAPSED');
  const isAtTop = useRef(true);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isSwipingDown = gestureState.dy > 5;
        const isSwipingUp = gestureState.dy < -5;
        
        // Absolute touch position
        const touchY = gestureState.y0;
        const currentHeight = SNAP_POINTS[currentSnapRef.current as keyof typeof SNAP_POINTS];
        const sheetTop = screenHeight - currentHeight;

        // 1. Capture if touching the top header area of the sheet
        if (touchY >= sheetTop && touchY <= sheetTop + 100) return true;

        // 2. Capture if swiping up from a collapsed state
        if (currentSnapRef.current === 'COLLAPSED' && isSwipingUp) return true;

        // 3. Capture if at the top of scroll content and swiping down to collapse
        if (isAtTop.current && isSwipingDown) return true;

        return false;
      },
      onPanResponderMove: (_, gestureState) => {
        const startHeight = SNAP_POINTS[currentSnapRef.current as keyof typeof SNAP_POINTS];
        const newHeight = startHeight - gestureState.dy;
        if (newHeight >= SNAP_POINTS.COLLAPSED && newHeight <= SNAP_POINTS.FULL) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const finalHeight = SNAP_POINTS[currentSnapRef.current as keyof typeof SNAP_POINTS] - gestureState.dy;
        let nearestSnap: keyof typeof SNAP_POINTS = 'COLLAPSED';
        
        if (finalHeight > (SNAP_POINTS.COLLAPSED + SNAP_POINTS.FULL) / 2) {
          nearestSnap = 'FULL';
        }

        Animated.spring(sheetHeight, {
          toValue: SNAP_POINTS[nearestSnap],
          useNativeDriver: false,
          friction: 8,
          tension: 40,
        }).start();
        currentSnapRef.current = nearestSnap;
        setCurrentSnap(nearestSnap);
      },
    })
  ).current;

  // Map & Location State
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [radius, setRadius] = useState(5000); 
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearchingList, setIsSearchingList] = useState(false);

  // Autocomplete Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearchingList(true);
        const results = await discoveryService.autocomplete(searchQuery);
        setSuggestions(results);
        setIsSearchingList(false);
      } else {
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSelectSuggestion = async (suggestion: any) => {
   const text = suggestion.placePrediction?.text?.text || suggestion.text?.text;
   const placeId = suggestion.placePrediction?.placeId;
   setSearchQuery(text);
   setSuggestions([]);

   setIsSearchingList(true);
   const coords = await discoveryService.geocode(text, placeId);
   setIsSearchingList(false);
    if (coords) {
      const newRegion = {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);
      if (!mapLoadError) mapRef.current?.animateToRegion(newRegion, 1000);
    }
  };

  // Itinerary Params
  const [intensity, setIntensity] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [roamingMode, setRoamingMode] = useState<'strict' | 'roam'>('strict');
  const [maxActivities, setMaxActivities] = useState(3);
  const [days, setDays] = useState(3);

  // Status
  const [isCalculating, setIsCalculating] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSurprising, setIsSurpriseLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const isConfigComplete = !!intensity && !!budget;

  const handleResetToCurrentLocation = useCallback(async () => {
    if (isLocating) return;
    
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLocating(false);
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        const fastRegion = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setRegion(fastRegion);
        if (!mapLoadError && isMapReady) mapRef.current?.animateToRegion(fastRegion, 800);
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const precisionRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      
      setRegion(precisionRegion);
      if (!mapLoadError && isMapReady) {
        mapRef.current?.animateToRegion(precisionRegion, 1200);
      }
    } catch {
      console.warn('Failed to get user location');
    } finally {
      setIsLocating(false);
    }
  }, [isLocating, isMapReady]);

  useEffect(() => {
    if (isMapReady) {
      handleResetToCurrentLocation();
    }
  }, [isMapReady, handleResetToCurrentLocation]);

  const toggleSheet = () => {
    const nextSnap = currentSnap === 'COLLAPSED' ? 'FULL' : 'COLLAPSED';
    Animated.spring(sheetHeight, {
      toValue: SNAP_POINTS[nextSnap as keyof typeof SNAP_POINTS],
      useNativeDriver: false,
    }).start();
    currentSnapRef.current = nextSnap;
    setCurrentSnap(nextSnap);
  };

  const animatedSummaryOpacity = sheetHeight.interpolate({
    inputRange: [SNAP_POINTS.COLLAPSED, SNAP_POINTS.COLLAPSED + 50],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });

  const animatedContentOpacity = sheetHeight.interpolate({
    inputRange: [SNAP_POINTS.COLLAPSED + 50, SNAP_POINTS.FULL],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

   const summaryText = useMemo(() => {
     return 'UNFOLD THE STORY';
   }, []);

  const handleMapInteraction = () => {
    Keyboard.dismiss();
    if (suggestions.length > 0) setSuggestions([]);
    
    if (currentSnapRef.current === 'FULL') {
      collapseSheet();
    }
  };

  const collapseSheet = () => {
    Animated.spring(sheetHeight, {
      toValue: SNAP_POINTS.COLLAPSED,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
    currentSnapRef.current = 'COLLAPSED';
    setCurrentSnap('COLLAPSED');
  };

  const handleRegionChangeComplete = (newRegion: any) => {
    setRegion(newRegion);
    if (roamingMode === 'strict') {
      const zoomBasedRadius = Math.round((newRegion.latitudeDelta * 111000) * 0.3);
      const clampedRadius = Math.max(500, Math.min(50000, zoomBasedRadius));
      if (Math.abs(clampedRadius - radius) > radius * 0.1) {
        setRadius(clampedRadius);
      }
    }
  };

  const handleCalculate = async () => {
    try {
      setIsCalculating(true);
      const adventure = await discoveryService.generateAdventure({
        coords: { lat: region.latitude, lng: region.longitude },
        radius: radius,
        days,
        intensity: intensity!, 
        budget: budget!,
        roamingMode,
        maxActivities,
      });
      navigation.navigate('AdventureAssignment', { 
        AdventureId: adventure.id,
        initialAdventure: adventure
      });
    } catch (error) { console.error(error); } finally { setIsCalculating(false); }
  };

  const handleSurpriseMe = async () => {
    try {
      setIsSurpriseLoading(true);
      const hub = await discoveryService.fetchRandomHub();
      setSearchQuery(hub.name);
      const newRegion = {
        latitude: hub.lat,
        longitude: hub.lng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);
      if (!mapLoadError) mapRef.current?.animateToRegion(newRegion, 1500);
    } catch (_e) { console.error(_e); } finally { setIsSurpriseLoading(false); }
  };

  const displayDistance = useMemo(() => {
    if (isImperial) {
      const miles = radius / 1609.34;
      return `${miles.toFixed(1)} mi`;
    }
    return `${(radius / 1000).toFixed(1)} km`;
  }, [radius, isImperial]);

  const toggleRoamingMode = (mode: 'strict' | 'roam') => {
    setRoamingMode(mode);
    if (mode === 'roam') {
      setRadius(50000);
      const delta = (50000 * 4) / 111000;
      const newRegion = {
        ...region,
        latitudeDelta: delta,
        longitudeDelta: delta * (Dimensions.get('window').width / (Dimensions.get('window').height * 0.4)),
      };
      setRegion(newRegion);
      if (!mapLoadError) mapRef.current?.animateToRegion(newRegion, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainerFull}>
        {mapLoadError ? (
          <View style={styles.mapFallback}>
            <Image source={require('../../assets/textures/vintage-satellite-map.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.fallbackOverlay}>
              <TravisSignal status="thinking" size={60} />
              <Text style={styles.fallbackText}>TRAVIS: "SCOUTING EQUIPMENT NOT CALIBRATED."</Text>
            </View>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            region={region}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPress={handleMapInteraction}
            onPanDrag={handleMapInteraction}
            onMapReady={() => setIsMapReady(true)}
            userInterfaceStyle="light"
          >
            {isMapReady && (
              <Circle
                center={{ latitude: region.latitude, longitude: region.longitude }}
                radius={radius}
                strokeColor={theme.colors.primary}
                fillColor={`${theme.colors.primary}22`}
                strokeWidth={2}
              />
            )}
          </MapView>
        )}
        <View style={styles.markerOverlay} pointerEvents="none">
          <Ionicons name="location" size={40} color={theme.colors.primary} />
        </View>

        <TouchableOpacity 
          style={[styles.locateButton, { bottom: SNAP_POINTS.COLLAPSED + 20 }]} 
          onPress={handleResetToCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="locate" size={24} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.floatingHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.searchOverlayFloating}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.mapSearchInput}
              placeholder="Search City..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity onPress={handleSurpriseMe} style={styles.surpriseButton} disabled={isSurprising}>
              {isSurprising ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Ionicons name="dice" size={24} color={theme.colors.primary} />}
            </TouchableOpacity>
          </View>

          {(suggestions.length > 0 || isSearchingList) && (
            <View style={styles.suggestionsContainer}>
              {isSearchingList && suggestions.length === 0 && (
                <View style={styles.suggestionItem}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.suggestionText}>Searching...</Text>
                </View>
              )}
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
                {suggestions.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Ionicons name="location-outline" size={18} color={theme.colors.textSecondary} />
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {item.placePrediction?.text?.text || item.text?.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      <Animated.View 
        style={[styles.bottomSheet, { height: sheetHeight, paddingBottom: insets.bottom }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.sheetHeaderArea}>
          <TouchableOpacity style={styles.sheetHandleContainer} onPress={toggleSheet} activeOpacity={1}>
            <View style={styles.sheetHandle} />
          </TouchableOpacity>

          <Animated.View style={[styles.summaryContainer, { opacity: animatedSummaryOpacity }]} pointerEvents="none">
            <Text style={styles.summaryTitle}>{summaryText}</Text>
            <Text style={styles.summarySubtitle}>SWIPE UP TO ADJUST LOGISTICS</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.expandedContent, { opacity: animatedContentOpacity }]} pointerEvents={currentSnap === 'COLLAPSED' ? 'none' : 'auto'}>
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.sheetScroll}
            onScroll={(e) => {
              isAtTop.current = e.nativeEvent.contentOffset.y <= 0;
            }}
            scrollEventThrottle={16}
            bounces={false}
          >
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>SEARCH RADIUS</Text>
                <Text style={styles.radiusValue}>{displayDistance}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={isImperial ? 0.5 : 1}
                maximumValue={roamingMode === 'roam' 
                  ? (isImperial ? 62.2 : 100) 
                  : (isImperial ? 31.0 : 50)
                }
                step={isImperial ? 0.5 : 1}
                value={isImperial ? radius / 1609.34 : radius / 1000}
                onValueChange={(v) => {
                  const newRadius = isImperial ? v * 1609.34 : v * 1000;
                  setRadius(newRadius);
                  const newDelta = (newRadius * 3) / 111000;
                  const newRegion = {
                    ...region,
                    latitudeDelta: newDelta,
                    longitudeDelta: newDelta * (Dimensions.get('window').width / (Dimensions.get('window').height * 0.4)),
                  };
                  setRegion(newRegion);
                  if (!mapLoadError) mapRef.current?.animateToRegion(newRegion, 500);
                }}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={theme.colors.primary}
              />
            </View>

            <Text style={styles.sectionTitle}>TRAVEL STYLE</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggleBtn, roamingMode === 'strict' && styles.toggleBtnActive]} onPress={() => toggleRoamingMode('strict')}>
                <Text style={[styles.toggleText, roamingMode === 'strict' && styles.toggleTextActive]}>BASE CAMP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, roamingMode === 'roam' && styles.toggleBtnActive]} onPress={() => toggleRoamingMode('roam')}>
                <Text style={[styles.toggleText, roamingMode === 'roam' && styles.toggleTextActive]}>ROAMER</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>MAX ACTIVITIES PER DAY</Text>
                <Text style={styles.radiusValue}>{maxActivities}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={4}
                step={1}
                value={maxActivities}
                onValueChange={setMaxActivities}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={theme.colors.primary}
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>HOW MANY DAYS?</Text>
                <Text style={styles.radiusValue}>{days}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={7}
                step={1}
                value={days}
                onValueChange={setDays}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={theme.colors.primary}
              />
            </View>

            <Text style={styles.sectionTitle}>BUDGET</Text>
            <View style={styles.budgetContainer}>
              {BUDGETS.map((opt) => (
                <TouchableOpacity key={opt.id} style={[styles.budgetOption, budget === opt.id && styles.budgetOptionSelected]} onPress={() => setBudget(opt.id)}>
                  <Text style={[styles.budgetLabel, budget === opt.id && styles.budgetLabelSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>ENERGY LEVEL</Text>
            <View style={styles.intensityContainer}>
              {INTENSITIES.map((opt) => (
                <TouchableOpacity 
                  key={opt.id} 
                  style={[styles.intensityOption, intensity === opt.id && styles.intensityOptionSelected]} 
                  onPress={() => setIntensity(opt.id)}
                >
                  <Text style={styles.intensityIcon}>{opt.icon}</Text>
                  <Text style={[styles.intensityLabel, intensity === opt.id && styles.intensityLabelSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {intensity && (
              <View style={styles.intensityInfoBox}>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.intensityInfoText}>
                  {INTENSITIES.find(i => i.id === intensity)?.desc}
                </Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>

        <View style={styles.sheetFooter}>
          {!isConfigComplete && (
            <Text style={styles.nudgeText}>
              Travis: "Pick your poison first. I need a budget and energy level before I scout."
            </Text>
          )}
          <TouchableOpacity 
            style={[
              styles.calculateButton, 
              !isConfigComplete && styles.calculateButtonDisabled
            ]}
            onPress={handleCalculate}
            disabled={!isConfigComplete}
          >
            <Text style={[
              styles.buttonText,
              !isConfigComplete && styles.buttonTextDisabled
            ]}>
              {isConfigComplete ? 'STAMP MY JOURNEY' : 'LOCKED'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {isCalculating && (
        <View style={styles.calculatingOverlay}>
          <TravisSignal status="thinking" size={120} />
          <Text style={styles.calculatingTitle}>TRAVIS IS SCOUTING...</Text>
          <Text style={styles.calculatingSubtitle}>Mapping your itinerary.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  mapContainerFull: { ...StyleSheet.absoluteFillObject },
  map: { ...StyleSheet.absoluteFillObject },
  mapFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#E0D8C8', alignItems: 'center', justifyContent: 'center' },
  fallbackOverlay: { backgroundColor: 'rgba(255,255,255,0.85)', padding: 24, borderRadius: 20, alignItems: 'center' },
  fallbackText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  markerOverlay: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40, alignItems: 'center', justifyContent: 'center' },
  
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  headerInfo: { flex: 1, alignItems: 'center' },
  headerLabel: { color: theme.colors.textPrimary, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  signalBadgeSmall: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 4, elevation: 2 },
  
  searchOverlayFloating: { zIndex: 10 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 12, height: 50, elevation: 3 },
  mapSearchInput: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 16, color: theme.colors.textPrimary },
  surpriseButton: { padding: 12, borderLeftWidth: 1, borderLeftColor: theme.colors.border, minWidth: 48, alignItems: 'center' },

  suggestionsContainer: { backgroundColor: 'rgba(255, 255, 255, 0.98)', borderRadius: 12, marginTop: 8, paddingVertical: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  suggestionText: { flex: 1, color: theme.colors.textPrimary, fontSize: 14, marginLeft: 10, fontWeight: '500' },

  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 10 },
  sheetHeaderArea: { width: '100%', height: 100, alignItems: 'center', justifyContent: 'flex-start' },
  sheetHandleContainer: { width: '100%', height: 30, alignItems: 'center', justifyContent: 'center' },
  sheetHandle: { width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2 },
  
  summaryContainer: { position: 'absolute', top: 35, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  summaryTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: 1 },
  summarySubtitle: { fontSize: 9, fontWeight: 'bold', color: theme.colors.textSecondary, marginTop: 4, letterSpacing: 1 },
  
  expandedContent: { flex: 1 },
  sheetScroll: { paddingHorizontal: 24, paddingTop: 10 },
  
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginTop: 12 },
  radiusValue: { color: theme.colors.primary, fontSize: 14, fontWeight: '900' },
  slider: { width: '100%', height: 40 },
  
  toggleRow: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: 12, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleText: { fontSize: 11, fontWeight: '900', color: theme.colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  
  budgetContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderRadius: 16, padding: 4, marginBottom: 20 },
  budgetOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  budgetOptionSelected: { backgroundColor: theme.colors.primary },
  budgetLabel: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary },
  budgetLabelSelected: { color: '#FFFFFF' },
  
  intensityContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  intensityOption: { width: '48%', backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center' },
  intensityOptionSelected: { backgroundColor: theme.colors.primary },
  intensityIcon: { fontSize: 20, marginBottom: 4 },
  intensityLabel: { fontSize: 9, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: 1 },
  intensityLabelSelected: { color: '#FFFFFF' },
  intensityInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.05)',
    padding: 12,
    borderRadius: 12,
    marginTop: -10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.1)',
  },
  intensityInfoText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  sheetFooter: { paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  calculateButton: { backgroundColor: theme.colors.primary, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  buttonTextDisabled: { color: 'rgba(255, 255, 255, 0.5)' },
  
  calculatingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.98)', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  calculatingTitle: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 32 },
  calculatingSubtitle: { color: theme.colors.textSecondary, fontSize: 16, textAlign: 'center', marginTop: 12, paddingHorizontal: 40 },

  calculateButtonDisabled: {
    backgroundColor: theme.colors.border,
    elevation: 0,
  },
  nudgeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  locateButton: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default AdventureRequestScreen;
