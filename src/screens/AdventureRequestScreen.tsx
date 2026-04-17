import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';

import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { TravisSignal } from '../components/TravisSignal';
import { discoveryService } from '../services/discovery';
import { supabase } from '../services/supabase';

// SAFE MAP LOADING
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let mapLoadError = false;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Circle = Maps.Circle;
  if (!MapView) mapLoadError = true;
} catch (e) {
  mapLoadError = true;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdventureRequest'>;

const DURATIONS = [
  { id: '1_day', label: '1 DAY', icon: '🏙️' },
  { id: 'weekend', label: 'WEEKEND', icon: '⛺' },
  { id: 'vacation', label: '1+ WEEKS', icon: '✈️' },
];

const VIBES = [
  { id: 'food', label: 'FOOD', icon: '🍽️' },
  { id: 'nature', label: 'NATURE', icon: '🌲' },
  { id: 'culture', label: 'CULTURE', icon: '🏛️' },
  { id: 'adventure', label: 'ADVENTURE', icon: '🎒' },
  { id: 'beach', label: 'BEACH', icon: '🏖️' },
  { id: 'mountain', label: 'MOUNTAIN', icon: '🏔️' },
  { id: 'nightlife', label: 'NIGHTLIFE', icon: '🌃' },
  { id: 'chill', label: 'CHILL', icon: '🧘' },
  { id: 'active', label: 'ACTIVE', icon: '🏃' },
];

const BUDGETS = [
  { id: 'low', label: '$', desc: 'SCREENS OFF' },
  { id: 'mid', label: '$$', desc: 'STREET FOOD' },
  { id: 'high', label: '$$$', desc: 'WHITE LINEN' },
  { id: 'travis', label: '!!!', desc: 'TRAVIS STYLE' },
];

const AdventureRequestScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const mapRef = useRef<any>(null);

  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [radius, setRadius] = useState(5000); // 5km default
  const [duration, setDuration] = useState('1_day');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>(['food']);
  const [budget, setBudget] = useState('mid');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSurprising, setIsSurpriseLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setRegion(newRegion);
        if (!mapLoadError) {
          mapRef.current?.animateToRegion(newRegion, 1000);
        }
      }
    })();
  }, []);

  const fetchSuggestions = async (input: string) => {
    setSearchQuery(input);
    if (input.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const { data } = await supabase.functions.invoke('discover-places', {
        body: { action: 'autocomplete', payload: { input } }
      });
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (e) {
      console.error('Autocomplete failed:', e);
    }
  };

  const selectSuggestion = async (suggestion: any) => {
    const text = suggestion.placePrediction?.text?.text || '';
    setSearchQuery(text);
    setSuggestions([]);

    try {
      const { data } = await supabase.functions.invoke('discover-places', {
        body: { action: 'geocode', payload: { query: text } }
      });
      if (data?.places?.[0]?.location) {
        const newRegion = {
          latitude: data.places[0].location.latitude,
          longitude: data.places[0].location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setRegion(newRegion);
        if (!mapLoadError) {
          mapRef.current?.animateToRegion(newRegion, 1000);
        }
      }
    } catch (e) {
      console.error('Geocoding failed:', e);
    }
  };

  const handleSurpriseMe = async () => {
    try {
      setIsSurpriseLoading(true);
      const hub = await discoveryService.fetchRandomHub();
      const newRegion = {
        latitude: hub.lat,
        longitude: hub.lng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);
      if (!mapLoadError) {
        mapRef.current?.animateToRegion(newRegion, 1500);
      }
    } catch (e) {
      console.error('Surprise Me failed:', e);
    } finally {
      setIsSurpriseLoading(false);
    }
  };

  const toggleVibe = (id: string) => {
    if (selectedVibes.includes(id)) {
      if (selectedVibes.length > 1) {
        setSelectedVibes(selectedVibes.filter(v => v !== id));
      }
    } else {
      setSelectedVibes([...selectedVibes, id]);
    }
  };

  const handleCalculate = async () => {
    try {
      setIsCalculating(true);
      
      const adventure = await discoveryService.generateAdventure({
        coords: { lat: region.latitude, lng: region.longitude },
        radius: radius,
        duration,
        vibe: selectedVibes.join(','),
        budget,
        date: new Date(),
      });

      navigation.navigate('AdventureAssignment', { 
        AdventureId: adventure.id,
        initialAdventure: adventure
      });
    } catch (error) {
      console.error('Failed to generate adventure:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  if (isCalculating) {
    return (
      <View style={[styles.container, styles.calculatingContainer]}>
        <TravisSignal status="thinking" size={120} />
        <Text style={styles.calculatingTitle}>TRAVIS IS SCOUTING...</Text>
        <Text style={styles.calculatingSubtitle}>Finding the perfect spots within your chosen circle.</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <SafeAreaHeader navigation={navigation} />

        <View style={styles.mapContainer}>
          {mapLoadError ? (
            <View style={styles.mapFallback}>
              <Image 
                source={require('../../assets/textures/vintage-satellite-map.png')} 
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
              <View style={styles.fallbackOverlay}>
                <TravisSignal status="thinking" size={60} />
                <Text style={styles.fallbackText}>TRAVIS: "SCOUTING EQUIPMENT NOT CALIBRATED."</Text>
                <Text style={styles.fallbackSubtext}>(REBUILD THE APP TO VIEW THE LIVE MAP)</Text>
              </View>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              onRegionChangeComplete={(newRegion: any) => setRegion(newRegion)}
              onMapReady={() => setIsMapReady(true)}
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
          
          {/* Fixed Center Marker Overlay - Still show it as it's the "Center" of the area */}
          <View style={styles.markerOverlay} pointerEvents="none">
            <Ionicons name="location" size={40} color={theme.colors.primary} />
          </View>

          {/* Search Overlay */}
          <View style={styles.searchOverlay}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.mapSearchInput}
                placeholder="Search City..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={fetchSuggestions}
              />
              <TouchableOpacity 
                onPress={handleSurpriseMe} 
                style={styles.surpriseButton}
                disabled={isSurprising}
              >
                {isSurprising ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons name="dice" size={24} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestionsList}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={styles.suggestionItem}
                    onPress={() => selectSuggestion(s)}
                  >
                    <Text style={styles.suggestionText}>{s.placePrediction?.text?.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Radius Slider */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>SEARCH RADIUS</Text>
              <Text style={styles.radiusValue}>{(radius / 1000).toFixed(1)} km</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1000}
              maximumValue={50000}
              step={500}
              value={radius}
              onValueChange={setRadius}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.border}
              thumbTintColor={theme.colors.primary}
            />
          </View>

          {/* Duration */}
          <Text style={styles.sectionTitle}>HOW LONG ARE WE OUT FOR?</Text>
          <View style={styles.optionsGrid}>
            {DURATIONS.map((opt) => (
              <OptionCard 
                key={opt.id}
                item={opt}
                isSelected={duration === opt.id}
                onPress={() => setDuration(opt.id)}
              />
            ))}
          </View>

          {/* Budget */}
          <Text style={styles.sectionTitle}>WHAT'S THE DAMAGE? (BUDGET)</Text>
          <View style={styles.budgetContainer}>
            {BUDGETS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.budgetOption,
                  budget === opt.id && styles.budgetOptionSelected
                ]}
                onPress={() => setBudget(opt.id)}
              >
                <Text style={[
                  styles.budgetLabel,
                  budget === opt.id && styles.budgetLabelSelected
                ]}>{opt.label}</Text>
                <Text style={[
                  styles.budgetDesc,
                  budget === opt.id && styles.budgetDescSelected
                ]}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Vibes */}
          <Text style={styles.sectionTitle}>WHAT'S THE VIBE?</Text>
          <View style={styles.grid}>
            {VIBES.map((opt) => (
              <OptionCard 
                key={opt.id}
                item={opt}
                isSelected={selectedVibes.includes(opt.id)}
                onPress={() => toggleVibe(opt.id)}
              />
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.calculateButton}
            onPress={handleCalculate}
          >
            <Text style={styles.buttonText}>STAMP MY JOURNEY</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};


const SafeAreaHeader = ({ navigation }: any) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={() => navigation.goBack()}>
      <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
    </TouchableOpacity>
    <View style={styles.headerRight}>
      <Text style={styles.headerLabel}>PLANNING WITH TRAVIS</Text>
      <TravisSignal status="thinking" size={40} />
    </View>
  </View>
);

const OptionCard = ({ item, isSelected, onPress }: any) => (
  <TouchableOpacity
    style={[styles.card, isSelected && styles.cardSelected]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={styles.cardIcon}>{item.icon}</Text>
    <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
      {item.label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  calculatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  calculatingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 32,
    letterSpacing: 1,
    textAlign: 'center',
  },
  calculatingSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginRight: 12,
  },
  mapContainer: {
    height: Dimensions.get('window').height * 0.4,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E0D8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackOverlay: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fallbackText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },
  fallbackSubtext: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  markerOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mapSearchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  surpriseButton: {
    padding: 12,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    minWidth: 48,
    alignItems: 'center',
  },
  suggestionsList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  suggestionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  radiusValue: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  card: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  cardLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardLabelSelected: {
    color: theme.colors.primary,
  },
  budgetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 4,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  budgetOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  budgetOptionSelected: {
    backgroundColor: theme.colors.primary,
  },
  budgetLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  budgetLabelSelected: {
    color: '#FFFFFF',
  },
  budgetDesc: {
    fontSize: 8,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  budgetDescSelected: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  footer: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  calculateButton: {
    backgroundColor: theme.colors.primary,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
});

export default AdventureRequestScreen;
