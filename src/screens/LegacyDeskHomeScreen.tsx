import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { theme } from '../theme';
import { useAdventure } from '../hooks/useAdventure';
import { useProfile } from '../hooks/useProfile';
import { useNotice } from '../components/TravisNotice';
import { RootStackParamList } from '../types/navigation';
import { TravisSignal } from '../components/TravisSignal';
import { MapBackground } from '../components/MapBackground';
import { InkBleedItem } from '../components/InkBleedItem';
import { StopCard } from '../components/StopCard';
import { supabase } from '../services/supabase';
import { DayShellCard } from '../components/DayShellCard';
import {
  getCurrentTripDay,
  getDeskPrimaryDay,
  getDeskTripPhase,
  getDeskUpcomingStatus,
} from '../services/adventureData';
import * as Location from 'expo-location';
import { discoveryService } from '../services/discovery';
import { ItineraryStop } from '../types/adventure';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LegacyDeskHomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { currentAdventure, loading: adventureLoading, refreshAdventure } = useAdventure();
  const { profile, loading: profileLoading } = useProfile();
  const { showNotice } = useNotice();
  const [rerollTimeLeft, setRerollTimeLeft] = useState<number>(0);

  // Hungry Feature State
  const [isHungryLoading, setIsHungryLoading] = useState(false);
  const [foodOptions, setFoodOptions] = useState<ItineraryStop[]>([]);
  const [showFoodPicker, setShowFoodPicker] = useState(false);
  const [foodCache, setFoodCache] = useState<{
    coords: { lat: number; lng: number };
    results: ItineraryStop[];
    timestamp: number;
  } | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    const hasPremiumAccess = true;
    if (!(currentAdventure && currentAdventure.status === 'active' && hasPremiumAccess)) {
      setRerollTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const updatedAt = new Date(currentAdventure.updated_at).getTime();
      const now = new Date().getTime();
      const diffInSeconds = Math.max(0, 300 - Math.floor((now - updatedAt) / 1000));
      setRerollTimeLeft(diffInSeconds);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [currentAdventure, profile]);

  useFocusEffect(
    useCallback(() => {
      refreshAdventure();
    }, [refreshAdventure])
  );

  const showEmptyDesk =
    !currentAdventure ||
    currentAdventure.status === 'completed' ||
    currentAdventure.status === 'missed';

  const tripPhase = getDeskTripPhase(currentAdventure);
  const currentTripDay = getCurrentTripDay(currentAdventure);
  const primaryDay = getDeskPrimaryDay(currentAdventure);
  const upcomingStatus = getDeskUpcomingStatus(currentAdventure);
  const sortedDays = useMemo(
    () => (currentAdventure?.days || []).slice().sort((a, b) => a.day_number - b.day_number),
    [currentAdventure]
  );
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!primaryDay) {
      setSelectedDayNumber(null);
      return;
    }

    setSelectedDayNumber(prev => {
      if (prev == null) return primaryDay.day_number;
      if (!sortedDays.some(day => day.day_number === prev)) return primaryDay.day_number;
      return prev;
    });
  }, [primaryDay, sortedDays]);

  const selectedDay = useMemo(
    () =>
      sortedDays.find(day => day.day_number === selectedDayNumber) ||
      primaryDay ||
      null,
    [primaryDay, selectedDayNumber, sortedDays]
  );

  const rollingFullWindow = useMemo(() => {
    if (!sortedDays.length) return new Set<number>();
    if (tripPhase === 'draft' || tripPhase === 'next_up') {
      return new Set(sortedDays.slice(0, 3).map(day => day.day_number));
    }

    return new Set(
      sortedDays
        .filter(day => day.day_number >= currentTripDay && day.day_number <= currentTripDay + 2)
        .map(day => day.day_number)
    );
  }, [currentTripDay, sortedDays, tripPhase]);

  if (adventureLoading || profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <TravisSignal status="thinking" size={80} />
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: theme.spacing.lg }} />
      </View>
    );
  }

  const handleAbandon = async () => {
    if (!currentAdventure) return;

    showNotice({
      title: 'ABANDON JOURNEY?',
      message: "Travis: 'Giving up already? Fine. I'll shred the itinerary, but don't expect me to be happy about it.'",
      type: 'error',
      actions: [
        { text: 'STAY THE COURSE', style: 'cancel', onPress: () => {} },
        {
          text: 'ABANDON',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('adventures').delete().eq('id', currentAdventure.id);
              await refreshAdventure();
            } catch (error) {
              console.error('Failed to abandon journey:', error);
            }
          },
        },
      ],
    });
  };

  const getStatusChip = () => {
    switch (tripPhase) {
      case 'draft':
        return 'DRAFT';
      case 'next_up':
        return 'NEXT UP';
      case 'today':
        return 'TODAY';
      default:
        return 'THE DESK';
    }
  };

  const getDeskLabel = () => {
    if (!selectedDay) return 'Nothing is stamped yet';
    if (tripPhase === 'draft') return `PREVIEW DAY ${selectedDay.day_number}`;
    if (tripPhase === 'next_up') return `NEXT UP • DAY ${selectedDay.day_number}`;
    return selectedDay.day_number === currentTripDay
      ? `TODAY • DAY ${selectedDay.day_number}`
      : `DAY ${selectedDay.day_number} PREVIEW`;
  };

  const getDeskSubtitle = () => {
    if (tripPhase === 'draft') {
      return 'Travis has the route roughed in. Give the first day a look before you stamp the full itinerary.';
    }
    if (tripPhase === 'next_up') {
      return 'Your trip has a start date. This is the first day waiting on the desk.';
    }
    return 'This is what matters now. The rest of the route can stay in the folder until you need it.';
  };

  const getFullRouteCta = () => (tripPhase === 'draft' ? 'REVIEW FULL ITINERARY' : 'OPEN FULL ROUTE');
  const signalStatus = tripPhase === 'today' ? 'tracking' : tripPhase === 'draft' ? 'thinking' : 'idle';
  const handleDayPress = (dayNumber: number) => {
    if (!rollingFullWindow.has(dayNumber)) return;
    setSelectedDayNumber(dayNumber);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dphi = ((lat2 - lat1) * Math.PI) / 180;
    const dlambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dphi / 2) * Math.sin(dphi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) * Math.sin(dlambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleHungryPress = async () => {
    try {
      setIsHungryLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showNotice({
          title: 'LOCATION REQUIRED',
          message: "Travis: 'I can't find food if I don't know where you are. Give me access.'",
          type: 'warning',
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const currentCoords = { lat: location.coords.latitude, lng: location.coords.longitude };

      // CACHE CHECK: Within 500m and 20 mins
      if (foodCache && Date.now() - foodCache.timestamp < 1200000) {
        const dist = calculateDistance(
          currentCoords.lat,
          currentCoords.lng,
          foodCache.coords.lat,
          foodCache.coords.lng
        );
        if (dist < 500) {
          console.log('[CACHE] Using nearby food cache');
          setFoodOptions(foodCache.results);
          setShowFoodPicker(true);
          return;
        }
      }

      const results = await discoveryService.searchNearbyFood(currentCoords);
      setFoodOptions(results);
      setFoodCache({
        coords: currentCoords,
        results,
        timestamp: Date.now(),
      });
      setShowFoodPicker(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsHungryLoading(false);
    }
  };

  const handleRemoveStop = async (stop: ItineraryStop) => {
    if (!currentAdventure) return;

    showNotice({
      title: 'SCRATCH THIS SPOT?',
      message: `Travis: 'Not hungry for ${stop.name} anymore? Fine. I'll scratch it from the plan.'`,
      type: 'warning',
      actions: [
        { text: 'KEEP IT', style: 'cancel', onPress: () => {} },
        {
          text: 'REMOVE',
          style: 'destructive',
          onPress: async () => {
            const success = await discoveryService.removeStopFromItinerary(
              currentAdventure.id,
              stop.place_id,
              stop.day_number || selectedDayNumber || 1
            );
            if (success) await refreshAdventure();
          },
        },
      ],
    });
  };

  const handleAddFoodStop = async (stop: ItineraryStop) => {
    if (!currentAdventure || !selectedDayNumber) return;
    try {
      const success = await discoveryService.injectStopIntoItinerary(currentAdventure.id, {
        ...stop,
        day_number: selectedDayNumber
      });
      if (success) {
        setShowFoodPicker(false);
        await refreshAdventure();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapBackground scrollOffset={scrollY} />
      <View style={styles.header}>
        {showEmptyDesk ? (
          <View style={styles.headerPlaceholder} />
        ) : (
          <TouchableOpacity onPress={handleAbandon}>
            <Ionicons name="trash-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>The Desk</Text>
        <TravisSignal status={signalStatus} size={40} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={showEmptyDesk ? styles.emptyScrollContent : styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {showEmptyDesk ? (
          <View style={styles.emptyDesk}>
            <Text style={styles.emptyDeskTitle}>Nothing planned yet</Text>
            <Text style={styles.emptyDeskSubtitle}>
              Ask Travis to draft your next itinerary when you're ready to get moving.
            </Text>
            <TouchableOpacity
              style={styles.emptyDeskButton}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Journeys' })}
            >
              <Text style={styles.emptyDeskButtonText}>Start your Story Here</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.adventureHeader}>
              <View style={styles.headerMetaRow}>
                <View style={styles.statusChip}>
                  <Text style={styles.statusChipText}>{getStatusChip()}</Text>
                </View>
                {rerollTimeLeft > 0 ? (
                  <Text style={styles.rerollTimer}>
                    Reroll window: {Math.floor(rerollTimeLeft / 60)}:{(rerollTimeLeft % 60).toString().padStart(2, '0')}
                  </Text>
                ) : (
                  <View />
                )}
              </View>
              <Text style={styles.adventureTitle}>{currentAdventure?.title?.toUpperCase() || 'EMPTY PAGES'}</Text>
              <Text style={styles.adventureSubtitle}>{getDeskSubtitle()}</Text>
            </View>

            <View style={styles.primaryBriefingCard}>
              <View style={styles.primaryCardHeader}>
                <Text style={styles.primaryCardEyebrow}>{getDeskLabel()}</Text>
                {selectedDay ? (
                  <Text style={styles.primaryCardTitle} numberOfLines={2}>
                    {selectedDay.theme_title}
                  </Text>
                ) : null}
              </View>

              {selectedDay ? (
                selectedDay.status === 'ready' ? (
                  selectedDay.itinerary_json.map((stop, index) => (
                    <InkBleedItem
                      key={`${stop.place_id}_${index}`}
                      animationKey={`desk-stop-${selectedDay.day_number}-${stop.place_id}`}
                      delay={index * 120}
                    >
                      <StopCard
                        stop={stop}
                        onPress={() => navigation.navigate('LocationDetails', { locationId: stop.place_id })}
                        renderRightAction={() => (
                          <TouchableOpacity onPress={() => handleRemoveStop(stop)} style={{ padding: 4 }}>
                            <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      />
                    </InkBleedItem>
                  ))
                ) : (
                  <InkBleedItem animationKey={`desk-shell-${selectedDay.day_number}`} delay={100}>
                    <DayShellCard day={selectedDay} />
                  </InkBleedItem>
                )
              ) : null}
            </View>

            <View style={styles.dayStripSection}>
              <Text style={styles.dayStripLabel}>TRIP PROGRESS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStripContent}>
                {sortedDays.map(day => {
                  const isPrimary = selectedDay?.day_number === day.day_number;
                  const isCompleted = tripPhase === 'today' && day.day_number < currentTripDay;
                  const isReady = day.status === 'ready';
                  const isInteractive = rollingFullWindow.has(day.day_number);

                  return (
                    <TouchableOpacity
                      key={day.day_number}
                      activeOpacity={isInteractive ? 0.8 : 1}
                      disabled={!isInteractive}
                      onPress={() => handleDayPress(day.day_number)}
                      style={[
                        styles.dayPill,
                        isPrimary && styles.dayPillPrimary,
                        isCompleted && styles.dayPillCompleted,
                        !isCompleted && !isPrimary && isReady && styles.dayPillReady,
                        !isInteractive && styles.dayPillLocked,
                      ]}
                    >
                      <Text style={[styles.dayPillText, (isPrimary || isCompleted) && styles.dayPillTextActive]}>
                        {day.day_number}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.secondaryInfoRow}>
              <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.secondaryInfoText}>{upcomingStatus}</Text>
            </View>

            <TouchableOpacity
              style={styles.fullRouteButton}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Journeys' })}
            >
              <Text style={styles.fullRouteButtonText}>{getFullRouteCta()}</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.ScrollView>

      {/* HUNGRY FAB */}
      {currentAdventure && currentAdventure.status === 'active' && !showEmptyDesk && (
        <TouchableOpacity 
          style={styles.hungryFab} 
          onPress={handleHungryPress}
          disabled={isHungryLoading}
        >
          {isHungryLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="restaurant" size={20} color="#FFFFFF" />
              <Text style={styles.hungryFabText}>HUNGRY?</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* FOOD PICKER OVERLAY */}
      {showFoodPicker && (
        <View style={styles.foodPickerOverlay}>
          <View style={styles.foodPickerSheet}>
            <View style={styles.foodPickerHeader}>
              <Text style={styles.foodPickerTitle}>TRAVIS'S CULINARY PICKS</Text>
              <TouchableOpacity onPress={() => setShowFoodPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.foodPickerSubtitle}>
              Nearby fuel for your adventure. Pick one to add it to your itinerary.
            </Text>

            <ScrollView style={styles.foodList} showsVerticalScrollIndicator={false}>
              {foodOptions.map((food, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.foodItem}
                  onPress={() => handleAddFoodStop(food)}
                >
                  <View style={styles.foodImageContainer}>
                    {food.image_url ? (
                      <Image source={{ uri: food.image_url }} style={styles.foodImage} />
                    ) : (
                      <View style={[styles.foodImage, styles.foodImageFallback]}>
                        <Ionicons name="restaurant-outline" size={24} color={theme.colors.textSecondary} />
                      </View>
                    )}
                    {food.price_level && (
                      <View style={styles.priceBadge}>
                        <Text style={styles.priceBadgeText}>{food.price_level}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
                    <Text style={styles.foodCategory}>{food.category}</Text>
                  </View>

                  <View style={styles.foodRating}>
                    <Ionicons name="star" size={14} color={theme.colors.primary} />
                    <Text style={styles.foodRatingText}>{(food.rating || 4.5).toFixed(1)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    height: 60,
  },
  headerPlaceholder: { width: 24, height: 24 },
  headerTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  scrollContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl, paddingBottom: 120 },
  emptyScrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl, paddingBottom: 120 },
  emptyDesk: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: theme.spacing.huge },
  emptyDeskTitle: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  emptyDeskSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    maxWidth: 300,
  },
  emptyDeskButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 16,
    borderRadius: theme.roundness.md,
    minWidth: 220,
    alignItems: 'center',
  },
  emptyDeskButtonText: { color: theme.colors.surface, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  adventureHeader: { marginBottom: theme.spacing.xl },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusChip: { backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  adventureTitle: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: 0.5 },
  adventureSubtitle: { color: theme.colors.textSecondary, fontSize: 16, fontWeight: '500', marginTop: 6, lineHeight: 24 },
  rerollTimer: { color: theme.colors.primary, fontSize: 12, fontWeight: 'bold' },
  primaryBriefingCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  primaryCardHeader: { marginBottom: theme.spacing.md },
  primaryCardEyebrow: { color: theme.colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  primaryCardTitle: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: '900', lineHeight: 28 },
  dayStripSection: { marginBottom: theme.spacing.md },
  dayStripLabel: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  dayStripContent: { paddingRight: theme.spacing.lg },
  dayPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 10,
  },
  dayPillPrimary: {
    backgroundColor: theme.colors.textPrimary,
    borderColor: theme.colors.textPrimary,
  },
  dayPillCompleted: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayPillReady: {
    borderColor: theme.colors.primary,
  },
  dayPillLocked: {
    opacity: 0.45,
  },
  dayPillText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '900' },
  dayPillTextActive: { color: '#FFFFFF' },
  secondaryInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg },
  secondaryInfoText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  fullRouteButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRouteButtonText: { color: theme.colors.surface, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  hungryFab: {
    position: 'absolute',
    bottom: 40,
    right: 30,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  hungryFabText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 8,
    letterSpacing: 1,
  },
  foodPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 2000,
  },
  foodPickerSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '80%',
  },
  foodPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  foodPickerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  foodPickerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  foodList: {
    marginBottom: 20,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  foodImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodImageFallback: {
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderTopLeftRadius: 6,
  },
  priceBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  foodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  foodName: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  foodCategory: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  foodRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  foodRatingText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});

export default LegacyDeskHomeScreen;
