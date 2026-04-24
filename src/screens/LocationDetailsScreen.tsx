import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Dimensions,
  Image,
  InteractionManager,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { 
  ChevronLeft, 
  Plus, 
  Star, 
  Clock, 
  Banknote, 
  Navigation,
  X,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { ExploreActivity } from '../types/explore';
import { activitiesService } from '../services/activities';
import { bookingService } from '../services/booking';
import { TravisSignal } from '../components/TravisSignal';
import { useNotice } from '../components/TravisNotice';
import { exploreService } from '../services/explore';
import { itineraryService } from '../services/itinerary';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.55;

type Props = NativeStackScreenProps<RootStackParamList, 'LocationDetails'>;

const priceLabel = (tier: ExploreActivity['priceTier']) => {
  if (tier === 'free') return 'Free';
  if (tier === 'budget') return '$';
  if (tier === 'mid') return '$$';
  if (tier === 'premium') return '$$$';
  return '??';
};

const formatDuration = (min: number | null, max: number | null) => {
  if (min == null && max == null) return 'Flexible';
  if (min === max) return `${min}m`;
  if (min != null && max != null) return `${min}-${max}m`;
  return `${min || max}m`;
};

const normalizeIdentity = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('provider:') ? value.replace('provider:', '') : value;
};

const getActivityIdentityKeys = (activity: Pick<ExploreActivity, 'id' | 'canonicalKey'>) => {
  const keys = new Set<string>();
  keys.add(normalizeIdentity(activity.id));
  if (activity.canonicalKey) {
    keys.add(normalizeIdentity(activity.canonicalKey));
  }
  return keys;
};

const LocationDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { locationId } = route.params;
  const { showNotice } = useNotice();
  const insets = useSafeAreaInsets();

  const [details, setDetails] = useState<ExploreActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [travisExplanation, setTravisExplanation] = useState<string | null>(null);
  const [bookingOpening, setBookingOpening] = useState(false);
  const [, setBookingLabel] = useState('Not Started');
  const [, setBookingTone] = useState<'neutral' | 'success' | 'warning' | 'error'>('neutral');
  const [, setIsNearby] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(1);
  const [itineraryDays, setItineraryDays] = useState<number[]>([1]);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [addingToItinerary, setAddingToItinerary] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    itineraryId: string;
    dayIndex: number;
    duplicateDayIndex: number;
  } | null>(null);

  // Animation State
  const scrollY = useSharedValue(0);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const horizontalScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      const index = Math.round(event.contentOffset.x / width) + 1;
      runOnJS(setActiveIndex)(index);
    },
  });

  const handleLightboxScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width) + 1;
    setActiveIndex(index);
  };

  // STICKY PARALLAX: This pins the image to the top and moves it slower than the scroll
  const heroAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          // translateY: scrollY pins it, * 0.5 creates the parallax speed difference
          translateY: scrollY.value * 0.5 
        },
        {
          scale: interpolate(scrollY.value, [-100, 0], [1.2, 1], Extrapolation.CLAMP)
        }
      ],
      opacity: interpolate(scrollY.value, [HERO_HEIGHT * 0.7, HERO_HEIGHT], [1, 0], Extrapolation.CLAMP)
    };
  });

  const images = useMemo(() => {
    if (details?.imageUrls && details.imageUrls.length > 0) return details.imageUrls;
    return [details?.imageUrl || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=1200'];
  }, [details]);

  const assignableDays = useMemo(() => {
    const days = itineraryDays.length ? itineraryDays : [1];
    const nextDay = Math.max(...days) + 1;
    return [...days, nextDay];
  }, [itineraryDays]);

  const loadItineraryContext = useCallback(async (selectedId?: string | null) => {
    try {
      const builder = await itineraryService.loadBuilderData(selectedId);
      if (builder.bundle?.days.length) {
        setItineraryDays(builder.bundle.days.map(day => day.dayIndex));
      } else {
        setItineraryDays([1]);
      }
    } catch {
      setItineraryDays([1]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await activitiesService.getActivityDetails(locationId);
      if (!data) {
        setError('Activity not found in the dossier.');
        return;
      }
      setDetails(data);
      
      // GALLERY TEST MODE: Injecting extra images for verification
      data.imageUrls = [
        data.imageUrl || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643',
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1200',
        'https://images.unsplash.com/photo-1511871893393-82e9c1892d03?auto=format&fit=crop&q=80&w=1200'
      ];

      const resolvedActivityId = data.canonicalKey || data.id;
      const [explanation, bookingSummary] = await Promise.all([
        activitiesService.getTravisExplanation(data),
        bookingService.getBookingStateByActivity(resolvedActivityId),
      ]);
      setTravisExplanation(explanation);
      setBookingLabel(bookingSummary.statusLabel);
      setBookingTone(bookingSummary.statusTone);

      exploreService.trackEvent({
        eventName: 'activity_details_viewed',
        activityId: data.canonicalKey || data.id,
        metadata: { source: data.source },
      });
    } catch {
      setError('Unable to retrieve dossier details.');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const checkProximity = useCallback(async () => {
    if (!details || details.lat == null || details.lng == null) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const userLoc = await Location.getCurrentPositionAsync({});
      const dist = getDistance(userLoc.coords.latitude, userLoc.coords.longitude, details.lat, details.lng);
      setIsNearby(dist < 500);
    } catch {
      console.warn('Proximity check offline');
    }
  }, [details]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (details) checkProximity(); }, [details, checkProximity]);
  useEffect(() => {
    void loadItineraryContext();
  }, [loadItineraryContext]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async nextState => {
      if (nextState !== 'active' || !details) return;
      const summary = await bookingService.getBookingStateByActivity(details.canonicalKey || details.id);
      setBookingLabel(summary.statusLabel);
      setBookingTone(summary.statusTone);
    });
    return () => sub.remove();
  }, [details]);

  useEffect(() => {
    if (!dayPickerOpen) {
      setDuplicatePrompt(null);
    }
  }, [dayPickerOpen]);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const completeAddToDay = useCallback(
    async (itineraryId: string, dayIndex: number, duplicateOverride: boolean) => {
      if (!details) return;
      setAddingToItinerary(true);
      try {
        await itineraryService.addActivityToDay({
          itineraryId,
          activityId: details.id,
          dayIndex,
        });

        AccessibilityInfo.announceForAccessibility(`Added ${details.title} to day ${dayIndex}`);
        exploreService.trackEvent({
          eventName: 'itinerary_item_added',
          activityId: details.id,
          metadata: {
            itinerary_id: itineraryId,
            day_index: dayIndex,
            source: 'details',
            duplicate_override: duplicateOverride,
          },
        });

        // Close local sheet first, then let native-stack back animation run cleanly.
        setDayPickerOpen(false);
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            navigation.goBack();
          }, 110);
        });
      } catch (error: any) {
        showNotice({
          title: 'ADD FAILED',
          message: error?.message || 'Could not add this stop to your itinerary right now.',
          type: 'error',
        });
      } finally {
        setAddingToItinerary(false);
        setDuplicatePrompt(null);
      }
    },
    [details, navigation, showNotice],
  );

  const handleAddToItinerary = useCallback(
    async (dayIndex: number) => {
      if (!details || addingToItinerary) return;
      try {
        const ensured = await itineraryService.ensureActiveItinerary({
          destinationCity: details.city || 'Open Road',
        });
        if (ensured.created) {
          exploreService.trackEvent({
            eventName: 'itinerary_created_auto',
            metadata: { source: 'details_add' },
          });
        }

        const builder = await itineraryService.loadBuilderData(ensured.itineraryId);
        const normalizedTargetKeys = getActivityIdentityKeys(details);
        const duplicateDay = builder.bundle?.days.find(day =>
          day.items.some(item => normalizedTargetKeys.has(normalizeIdentity(item.activityId))),
        )?.dayIndex;

        if (duplicateDay) {
          setDuplicatePrompt({
            itineraryId: ensured.itineraryId,
            dayIndex,
            duplicateDayIndex: duplicateDay,
          });
          return;
        }

        await completeAddToDay(ensured.itineraryId, dayIndex, false);
      } catch (error: any) {
        setDuplicatePrompt(null);
        showNotice({
          title: 'ADD FAILED',
          message: error?.message || 'Could not prepare this add right now.',
          type: 'error',
        });
      }
    },
    [addingToItinerary, completeAddToDay, details, showNotice],
  );

  const handleBookNow = async () => {
    if (!details || !details.bookingDeepLink) return;
    try {
      setBookingOpening(true);
      const intent = await bookingService.startBookingIntent({
        activityId: details.canonicalKey || details.id,
        provider: details.provider || 'manual',
        providerUrl: details.bookingDeepLink,
        surface: 'details',
        commissionPartnerId: details.provider || 'manual',
        commissionCampaignId: 'editorial_v1',
        commissionRateBps: null,
        commissionExpectedMinor: null,
      });
      await bookingService.openProviderHandoff(intent.id, details.bookingDeepLink);
    } catch {
      showNotice({ title: 'BOOKING ERROR', message: 'Unable to connect to booking provider.', type: 'error' });
    } finally { setBookingOpening(false); }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <TravisSignal status="thinking" size={60} editorial />
        <Text style={styles.loadingText}>CURATING DOSSIER...</Text>
      </View>
    );
  }

  if (error || !details) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>ACCESS DENIED</Text>
        <Text style={styles.errorSub}>{error || 'The dossier has been redacted or moved.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAll}><Text style={styles.retryText}>RETRY</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 
         FIX: Removed the absolute 'heroContainer' redundant rendering.
         The hero now exists exclusively inside the ScrollView for direct interaction 
         and clean layering.
      */}

      {/* Floating Top Navigation - Unified LIGHT blur */}
      <View style={[styles.topNav, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navCircle}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <ChevronLeft size={24} color="#1A1A1A" strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDayPickerOpen(true)}
          style={styles.navCircle}
          accessibilityRole="button"
          accessibilityLabel="Add this stop to itinerary"
        >
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          <Plus size={22} color="#1A1A1A" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Gallery Hero - Inside ScrollView for direct interaction */}
        <Animated.View style={[styles.heroInFlow, heroAnimatedStyle]}>
          <Animated.FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={horizontalScrollHandler}
            scrollEventThrottle={16}
            keyExtractor={(_, index) => `image-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => setLightboxVisible(true)}
                style={styles.heroImageItem}
              >
                <Image source={{ uri: item }} style={StyleSheet.absoluteFill} />
              </TouchableOpacity>
            )}
          />
          
          {/* Pagination Indicator */}
          {images.length > 1 && (
            <View style={styles.paginationContainer} pointerEvents="none">
              <BlurView intensity={40} tint="dark" style={styles.paginationBlur}>
                <Text style={styles.paginationText}>
                  {activeIndex} / {images.length}
                </Text>
              </BlurView>
            </View>
          )}
        </Animated.View>

        {/* Rising Paper - The core content area */}
        <View style={styles.risingPaper}>
          <View style={styles.contentSpaced}>
            <View style={styles.headerBody}>
              <Text style={styles.categoryLabel}>
                {(details.categories?.[0] || 'EXPERIENCE').toUpperCase()} // {(details.city || 'GLOBAL').toUpperCase()}
              </Text>
              <Text style={styles.title}>{details.title}</Text>
            </View>

            {/* Editorial Fact Matrix */}
            <View style={styles.factMatrix}>
              <View style={styles.factItem}>
                <Banknote size={16} color={theme.colors.textSecondary} />
                <Text style={styles.factValue}>{priceLabel(details.priceTier)}</Text>
                <Text style={styles.factLabel}>EST. PRICE</Text>
              </View>
              <View style={styles.factItem}>
                <Clock size={16} color={theme.colors.textSecondary} />
                <Text style={styles.factValue}>{formatDuration(details.durationMinutesMin, details.durationMinutesMax)}</Text>
                <Text style={styles.factLabel}>DURATION</Text>
              </View>
              <View style={styles.factItem}>
                <Star size={16} color={theme.colors.textSecondary} />
                <Text style={styles.factValue}>{details.ratingAverage?.toFixed(1) || '4.5'}</Text>
                <Text style={styles.factLabel}>RATING</Text>
              </View>
            </View>

            {/* Travis Briefing as Pull-Quote */}
            <View style={styles.briefingContainer}>
              <Text style={styles.briefingQuote}>“</Text>
              <Text style={styles.briefingText}>{travisExplanation || "I'm still analyzing why this spot fits your journey. Stand by."}</Text>
              <View style={styles.briefingFooter}>
                <View style={styles.briefingLine} />
                <Text style={styles.briefingAuthor}>EXEC. CURATOR // TRAVIS</Text>
              </View>
            </View>

            <Text style={styles.summaryTitle}>THE NARRATIVE</Text>
            <Text style={styles.summaryText}>{details.summary || "This destination demands your personal discovery. Experience it first-hand."}</Text>

            {details.tags.length > 0 && (
              <View style={styles.tagsGrid}>
                {details.tags.map((tag, i) => (
                  <View key={i} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Editorial Brand Seal */}
            <View style={styles.signatureContainer}>
               <TravisSignal status="idle" size={40} editorial />
               <Text style={styles.signatureText}>OFFICIALLY CURATED BY TRAVIS</Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Full-Screen Image Lightbox (Centered Focus Pop-out) */}
      <Modal 
        visible={lightboxVisible} 
        transparent={true} 
        animationType="fade"
        onRequestClose={() => setLightboxVisible(false)}
      >
        <View style={styles.lightboxContainer}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.lightboxBackdrop} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLightboxVisible(false)} />
          
          <StatusBar barStyle="dark-content" />
          
          <Animated.FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={activeIndex - 1}
            onMomentumScrollEnd={handleLightboxScroll}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            keyExtractor={(_, index) => `lightbox-${index}`}
            renderItem={({ item }) => (
              <View style={styles.lightboxImageWrapper}>
                <View style={styles.shadowContainer}>
                  <Image source={{ uri: item }} style={styles.lightboxImage} resizeMode="cover" />
                </View>
              </View>
            )}
          />

          {/* Lightbox Pagination Counter */}
          {images.length > 1 && (
            <View style={[styles.paginationContainer, { bottom: 100 }]} pointerEvents="none">
              <BlurView intensity={40} tint="dark" style={styles.paginationBlur}>
                <Text style={styles.paginationText}>
                  {activeIndex} / {images.length}
                </Text>
              </BlurView>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.closeLightbox, { top: insets.top + 20 }]} 
            onPress={() => setLightboxVisible(false)}
          >
            <X size={24} color="#1A1A1A" strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={dayPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dayPickerCard}>
            <Text style={styles.dayPickerTitle}>ADD TO ITINERARY</Text>
            <Text style={styles.dayPickerSubtitle}>Choose a day for "{details.title}".</Text>

            {duplicatePrompt && (
              <View style={styles.duplicateInlineCard}>
                <Text style={styles.duplicateInlineText}>
                  {duplicatePrompt.duplicateDayIndex === duplicatePrompt.dayIndex
                    ? `Already in Day ${duplicatePrompt.dayIndex}. Add another copy?`
                    : `Already in Day ${duplicatePrompt.duplicateDayIndex}. Add to Day ${duplicatePrompt.dayIndex} too?`}
                </Text>
                <View style={styles.duplicateInlineActions}>
                  <TouchableOpacity
                    style={styles.duplicateInlineCancel}
                    onPress={() => setDuplicatePrompt(null)}
                    disabled={addingToItinerary}
                  >
                    <Text style={styles.duplicateInlineCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.duplicateInlineConfirm}
                    onPress={() => {
                      if (!duplicatePrompt) return;
                      void completeAddToDay(
                        duplicatePrompt.itineraryId,
                        duplicatePrompt.dayIndex,
                        true,
                      );
                    }}
                    disabled={addingToItinerary}
                  >
                    <Text style={styles.duplicateInlineConfirmText}>Add Anyway</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.dayPickerGrid}>
              {assignableDays.map(day => (
                <TouchableOpacity
                  key={day}
                  style={styles.dayPickerPill}
                  disabled={addingToItinerary}
                  onPress={() => {
                    void handleAddToItinerary(day);
                  }}
                >
                  <Text style={styles.dayPickerPillText}>
                    {day === Math.max(...assignableDays) ? `NEW DAY ${day}` : `DAY ${day}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.dayPickerCancel}
              onPress={() => {
                setDuplicatePrompt(null);
                setDayPickerOpen(false);
              }}
              disabled={addingToItinerary}
            >
              <Text style={styles.dayPickerCancelText}>{addingToItinerary ? 'ADDING...' : 'CANCEL'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating Frosted Action Bar */}
      <View style={[styles.bottomBarContainer, { paddingBottom: insets.bottom + 20 }]}>
        <BlurView intensity={90} tint="light" style={styles.bottomBar}>
          <TouchableOpacity 
            style={styles.primaryAction}
            onPress={() => setDayPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${details.title} to itinerary`}
          >
            <LinearGradient colors={['#1A1A1A', '#333']} style={StyleSheet.absoluteFill} />
            <Text style={styles.primaryActionText}>ADD TO ITINERARY</Text>
          </TouchableOpacity>
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.iconAction} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${details.lat},${details.lng}`)}>
              <Navigation size={20} color="#1A1A1A" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconAction, (!details.bookingDeepLink || bookingOpening) && styles.actionDisabled]}
              onPress={handleBookNow}
              disabled={!details.bookingDeepLink || bookingOpening}
            >
              <Text style={styles.iconActionText}>{bookingOpening ? '...' : 'BOOK'}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9FB', padding: 40 },
  loadingText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2, color: '#999', marginTop: 20 },
  
  heroInFlow: { width: '100%', height: HERO_HEIGHT, overflow: 'hidden', zIndex: 1 },
  heroImageItem: { width: width, height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject, zIndex: 10 },

  paginationContainer: { position: 'absolute', right: 24, bottom: 64, zIndex: 50 },
  paginationBlur: { borderRadius: 12, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6 },
  paginationText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#FFF', letterSpacing: 1 },

  topNav: { position: 'absolute', left: 24, right: 24, zIndex: 100, flexDirection: 'row', justifyContent: 'space-between' },
  navCircle: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingBottom: 180 },
  risingPaper: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: height - HERO_HEIGHT,
    paddingTop: 48,
    marginTop: -40, // Pulls the paper slightly over the hero image for a tight editorial seam
    zIndex: 20,
  },
  contentSpaced: { paddingHorizontal: 32 },
  
  headerBody: { marginBottom: 40 },
  categoryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2, color: '#999', marginBottom: 16 },
  title: { fontFamily: 'Inter_900Black', fontSize: 42, color: '#1A1A1A', lineHeight: 46 },

  factMatrix: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 48, paddingVertical: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  factItem: { alignItems: 'center', flex: 1 },
  factValue: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#1A1A1A', marginTop: 8 },
  factLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#BBB', letterSpacing: 1, marginTop: 4 },

  briefingContainer: { backgroundColor: '#F2F2F5', padding: 32, borderRadius: 24, marginBottom: 48 },
  briefingQuote: { fontFamily: 'Inter_900Black', fontSize: 60, color: '#E5E5E5', position: 'absolute', top: -10, left: 20 },
  briefingText: { fontFamily: 'Inter_400Regular', fontSize: 18, color: '#1A1A1A', fontStyle: 'italic', lineHeight: 28 },
  briefingFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 12 },
  briefingLine: { height: 1, flex: 1, backgroundColor: '#DDD' },
  briefingAuthor: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#999', letterSpacing: 2 },

  summaryTitle: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 3, color: '#999', marginBottom: 20 },
  summaryText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#444', lineHeight: 28, marginBottom: 32 },

  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 48 },
  tagPill: { backgroundColor: '#F2F2F5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#999' },

  signatureContainer: { alignItems: 'center', gap: 12, paddingVertical: 40, borderTopWidth: 1, borderColor: '#F0F0F0' },
  signatureText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#BBB', letterSpacing: 2 },

  lightboxContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lightboxBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
  lightboxImageWrapper: { width: width, height: height, justifyContent: 'center', alignItems: 'center' },
  shadowContainer: {
    width: width * 0.85,
    height: height * 0.5,
    backgroundColor: '#FFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
    overflow: 'hidden',
  },
  lightboxImage: { width: '100%', height: '100%' },
  closeLightbox: { position: 'absolute', right: 32, zIndex: 100, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  dayPickerCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  dayPickerTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 22,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  dayPickerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  duplicateInlineCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201, 122, 0, 0.35)',
    backgroundColor: 'rgba(201, 122, 0, 0.08)',
    padding: 12,
    marginBottom: 14,
  },
  duplicateInlineText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#5C4200',
    lineHeight: 18,
  },
  duplicateInlineActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  duplicateInlineCancel: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  duplicateInlineCancelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#444',
  },
  duplicateInlineConfirm: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  duplicateInlineConfirmText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#FFF',
  },
  dayPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayPickerPill: {
    backgroundColor: '#F2F2F5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dayPickerPillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  dayPickerCancel: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dayPickerCancelText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#777',
    letterSpacing: 0.8,
  },

  bottomBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, zIndex: 200 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  primaryAction: { flex: 1, height: 56, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFF', letterSpacing: 1 },
  secondaryActions: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  iconAction: { width: 56, height: 56, borderRadius: 24, backgroundColor: '#F2F2F5', alignItems: 'center', justifyContent: 'center' },
  iconActionText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#1A1A1A', letterSpacing: 0.8 },
  actionDisabled: { opacity: 0.5 },

  errorTitle: { fontFamily: 'Inter_900Black', fontSize: 24, color: '#1A1A1A' },
  errorSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#999', textAlign: 'center', marginTop: 12, marginBottom: 24 },
  retryButton: { backgroundColor: '#1A1A1A', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28 },
  retryText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFF' },
});

export default LocationDetailsScreen;
