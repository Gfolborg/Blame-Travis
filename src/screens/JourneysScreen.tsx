import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  Trash2, 
  Map as MapIcon, 
  BookOpen, 
} from 'lucide-react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';

import { useNotice } from '../components/TravisNotice';
import { TravisSignal } from '../components/TravisSignal';
import { isFeatureEnabled } from '../config/featureFlags';
import { bookingService } from '../services/booking';
import { isItineraryLimitError, itineraryService } from '../services/itinerary';
import { theme } from '../theme';
import { BookingStateSummary } from '../types/booking';
import {
  ItineraryActivityItem,
  ItineraryBundle,
} from '../types/itinerary';
import { MainTabScreenProps } from '../types/navigation';

const TITLE_MAX_LENGTH = 80;
const DESTINATION_MAX_LENGTH = 80;

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const buildMarkedRange = (startDate: string, endDate: string, color: string): Record<string, any> => {
  if (!startDate) return {};
  if (!endDate || endDate < startDate) {
    return {
      [startDate]: { startingDay: true, endingDay: true, color, textColor: '#FFF' },
    };
  }

  const marks: Record<string, any> = {};
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const cursor = new Date(start);

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    marks[key] = { color, textColor: '#FFF' };
    cursor.setTime(cursor.getTime() + DAY_MS);
  }

  marks[startDate] = { ...marks[startDate], startingDay: true };
  marks[endDate] = { ...marks[endDate], endingDay: true };
  return marks;
};

// Luxury Light Map Style
const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
];

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
} catch {
  MapView = null;
  Marker = null;
  Polyline = null;
}

type Props = MainTabScreenProps<'Journeys'>;

const JourneysScreen: React.FC<Props> = ({ navigation }) => {
  const itineraryBuilderEnabled = isFeatureEnabled('itinerary_builder_v1_enabled');
  const bookingTrackingEnabled = isFeatureEnabled('booking_tracking_v1_enabled');
  const { showNotice } = useNotice();
  const mapRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offlineReadOnly, setOfflineReadOnly] = useState(false);

  const [viewMode, setViewMode] = useState<'story' | 'map'>('story');
  const [activeItineraryId, setActiveItineraryId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ItineraryBundle | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(1);
  const [virtualDays, setVirtualDays] = useState<number[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCalendarOpen, setCreateCalendarOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [createTitle, setCreateTitle] = useState('');
  const [createDestination, setCreateDestination] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete_itinerary';
  } | {
    type: 'remove_day';
    dayIndex: number;
  } | null>(null);

  // Inline Draft State
  const [draftTitle, setDraftTitle] = useState('');
  
  const [bookingStateByItemId, setBookingStateByItemId] = useState<Record<string, BookingStateSummary>>({});

  const writesDisabled = offlineReadOnly || mutating || creating;

  const loadBuilderState = useCallback(
    async (selectedId?: string | null, isRefresh = false) => {
      if (isRefresh) {
        setMutating(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      try {
        const result = await itineraryService.loadBuilderData(selectedId);
        setActiveItineraryId(result.activeItineraryId);
        setBundle(result.bundle);
        setOfflineReadOnly(result.offline);
        setVirtualDays([]);

        if (result.bundle) {
          setDraftTitle(result.bundle.header.title);
          if (result.bundle.days?.length) {
            setSelectedDayIndex(result.bundle.days[0].dayIndex);
          } else {
            setSelectedDayIndex(1);
          }
        }
      } catch (error: any) {
        setErrorMessage(error?.message || 'Unable to load journeys right now.');
      } finally {
        setLoading(false);
        if (isRefresh) {
          setMutating(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!itineraryBuilderEnabled) return;
    loadBuilderState();
  }, [itineraryBuilderEnabled, loadBuilderState]);

  const dayIndexes = useMemo(() => {
    const indexedDays = new Set<number>();
    bundle?.days.forEach(day => indexedDays.add(day.dayIndex));
    virtualDays.forEach(day => indexedDays.add(day));
    indexedDays.add(selectedDayIndex);
    return [...indexedDays].filter(day => day > 0).sort((a, b) => a - b);
  }, [bundle, selectedDayIndex, virtualDays]);

  const selectedDayItems = useMemo(() => {
    const day = bundle?.days.find(item => item.dayIndex === selectedDayIndex);
    return day?.items || [];
  }, [bundle, selectedDayIndex]);

  const adaptiveTripTitleFontSize = useMemo(() => {
    const length = draftTitle.trim().length;
    if (length <= 24) return 18;
    if (length <= 36) return 16;
    if (length <= 52) return 14;
    return 12;
  }, [draftTitle]);

  const createDateDisplay = useMemo(() => {
    if (createStartDate && createEndDate) {
      return `${formatDateLabel(createStartDate)} - ${formatDateLabel(createEndDate)}`;
    }
    if (createStartDate) {
      return `${formatDateLabel(createStartDate)} - Pick end`;
    }
    return 'Set dates (optional)';
  }, [createEndDate, createStartDate]);

  const createMarkedDates = useMemo(
    () => buildMarkedRange(createStartDate, createEndDate, theme.colors.textPrimary),
    [createEndDate, createStartDate]
  );

  const mappableDayItems = useMemo(
    () =>
      selectedDayItems
        .map((item, listIndex) => ({ item, listIndex }))
        .filter(entry => entry.item.lat != null && entry.item.lng != null),
    [selectedDayItems]
  );

  const loadBookingStates = useCallback(async () => {
    if (!bookingTrackingEnabled || !selectedDayItems.length) {
      setBookingStateByItemId({});
      return;
    }

    const map = await bookingService.getBookingStateMapForItineraryItems(
      selectedDayItems.map(item => ({
        itineraryItemId: item.id,
        activityId: item.activityId,
      })),
    );
    setBookingStateByItemId(map);
  }, [bookingTrackingEnabled, selectedDayItems]);

  useEffect(() => {
    void loadBookingStates();
  }, [loadBookingStates, bundle, selectedDayIndex]);

  useFocusEffect(
    useCallback(() => {
      void loadBookingStates();
    }, [loadBookingStates]),
  );

  const handleSaveInlineDetails = useCallback(async () => {
    if (!activeItineraryId || !bundle || writesDisabled) return;
    
    const title = draftTitle.trim();
    const destinationCity = bundle.header.destinationCity.trim();

    if (title === bundle.header.title) return;

    if (title.length < 3 || title.length > TITLE_MAX_LENGTH) {
      setDraftTitle(bundle.header.title);
      return;
    }

    try {
      setMutating(true);
      const nextBundle = await itineraryService.updateItineraryDetails({
        itineraryId: activeItineraryId,
        title,
        destinationCity,
        startDate: bundle.header.startDate,
        endDate: bundle.header.endDate,
      });
      setBundle(nextBundle);
    } catch {
      showNotice({
        title: 'SAVE FAILED',
        message: 'Could not sync updates to the dossier.',
        type: 'error',
      });
      setDraftTitle(bundle.header.title);
    } finally {
      setMutating(false);
    }
  }, [activeItineraryId, bundle, draftTitle, showNotice, writesDisabled]);

  const handleCalendarSelect = useCallback(async (start: string, end: string) => {
    if (!activeItineraryId || !bundle || writesDisabled) return;

    try {
      setMutating(true);
      const nextBundle = await itineraryService.updateItineraryDetails({
        itineraryId: activeItineraryId,
        title: bundle.header.title,
        destinationCity: bundle.header.destinationCity,
        startDate: start,
        endDate: end,
      });
      setBundle(nextBundle);
      setCalendarOpen(false);
      showNotice({
        title: 'DATES UPDATED',
        message: "Travis: 'Mission timeline synchronized.'",
        type: 'success',
      });
    } catch {
      showNotice({
        title: 'UPDATE FAILED',
        message: 'Could not update trip dates.',
        type: 'error',
      });
    } finally {
      setMutating(false);
    }
  }, [activeItineraryId, bundle, showNotice, writesDisabled]);

  const handleCreateCalendarSelect = useCallback(
    (dateString: string) => {
      if (!createStartDate || (createStartDate && createEndDate)) {
        setCreateStartDate(dateString);
        setCreateEndDate('');
        return;
      }

      if (dateString < createStartDate) {
        setCreateStartDate(dateString);
        setCreateEndDate('');
        return;
      }

      setCreateEndDate(dateString);
      setCreateCalendarOpen(false);
    },
    [createEndDate, createStartDate]
  );

  const handleCreateItinerary = useCallback(async () => {
    if (writesDisabled) return;

    const title = createTitle.trim();
    const destinationCity = createDestination.trim();
    const startDate = createStartDate.trim();
    const endDate = createEndDate.trim();

    if (
      title.length < 3 ||
      title.length > TITLE_MAX_LENGTH ||
      destinationCity.length < 2 ||
      destinationCity.length > DESTINATION_MAX_LENGTH
    ) {
      showNotice({
        title: 'CHECK DETAILS',
        message: "Travis: 'I need a clear title and destination to build this dossier.'",
        type: 'warning',
      });
      return;
    }

    if (startDate && !endDate) {
      showNotice({
        title: 'ADD END DATE',
        message: 'Pick an end date or tap Set Later.',
        type: 'warning',
      });
      return;
    }

    try {
      setCreating(true);
      const created = await itineraryService.createItinerary({
        title,
        destinationCity,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      setCreateOpen(false);
      await loadBuilderState(created.id);
    } catch (error: any) {
      if (isItineraryLimitError(error)) {
        showNotice({
          title: 'LIMIT REACHED',
          message: "Travis: 'You can keep up to 5 itineraries at a time. Delete one to create another.'",
          type: 'warning',
        });
        return;
      }
      showNotice({
        title: 'CREATE FAILED',
        message: 'Could not create itinerary.',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  }, [createDestination, createEndDate, createStartDate, createTitle, loadBuilderState, showNotice, writesDisabled]);

  const handleRemoveItem = useCallback(
    async (item: ItineraryActivityItem) => {
      if (!bundle || !activeItineraryId || writesDisabled) return;

      try {
        setMutating(true);
        const nextBundle = await itineraryService.removeItem({
          itineraryId: activeItineraryId,
          itemId: item.id,
        });
        setBundle(nextBundle);
      } catch {
        showNotice({
          title: 'REMOVE FAILED',
          message: 'Could not remove stop.',
          type: 'error',
        });
      } finally {
        setMutating(false);
      }
    },
    [activeItineraryId, bundle, showNotice, writesDisabled]
  );

  const handleReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!activeItineraryId || writesDisabled) return;
      if (fromIndex === toIndex) return;

      try {
        setMutating(true);
        const nextBundle = await itineraryService.reorderDayItems({
          itineraryId: activeItineraryId,
          dayIndex: selectedDayIndex,
          fromIndex,
          toIndex,
        });
        setBundle(nextBundle);
      } catch {
        showNotice({
          title: 'REORDER FAILED',
          message: 'Could not reorder stops.',
          type: 'error',
        });
      } finally {
        setMutating(false);
      }
    },
    [activeItineraryId, selectedDayIndex, showNotice, writesDisabled]
  );

  const handleMoveItemToAdjacentDay = useCallback(
    async (item: ItineraryActivityItem, direction: -1 | 1) => {
      if (!activeItineraryId || writesDisabled) return;
      const nextDayIndex = Math.max(1, item.dayIndex + direction);

      if (direction === 1 && !dayIndexes.includes(nextDayIndex)) {
        setVirtualDays(current => [...new Set([...current, nextDayIndex])]);
      }

      try {
        setMutating(true);
        const nextBundle = await itineraryService.moveItemToDay({
          itineraryId: activeItineraryId,
          itemId: item.id,
          targetDayIndex: nextDayIndex,
        });
        setBundle(nextBundle);
      } catch {
        showNotice({
          title: 'MOVE FAILED',
          message: 'Could not move item.',
          type: 'error',
        });
      } finally {
        setMutating(false);
      }
    },
    [activeItineraryId, dayIndexes, showNotice, writesDisabled]
  );

  const handleAddDayShell = useCallback(() => {
    const nextDay = Math.max(...dayIndexes, 0) + 1;
    setVirtualDays(current => [...new Set([...current, nextDay])]);
    setSelectedDayIndex(nextDay);
  }, [dayIndexes]);

  const refresh = useCallback(async () => {
    await loadBuilderState(activeItineraryId, true);
  }, [activeItineraryId, loadBuilderState]);

  const handleDeleteItinerary = useCallback(() => {
    if (!activeItineraryId || writesDisabled) return;
    setConfirmAction({ type: 'delete_itinerary' });
  }, [activeItineraryId, writesDisabled]);

  const handleRemoveDay = useCallback(() => {
    if (!activeItineraryId || writesDisabled) return;
    setConfirmAction({ type: 'remove_day', dayIndex: selectedDayIndex });
  }, [activeItineraryId, selectedDayIndex, writesDisabled]);

  const handleConfirmAction = useCallback(async () => {
    if (!activeItineraryId || !confirmAction) return;
    if (writesDisabled) return;

    if (confirmAction.type === 'delete_itinerary') {
      try {
        setMutating(true);
        await itineraryService.deleteItinerary(activeItineraryId);
        setConfirmAction(null);
        await loadBuilderState(null);
      } catch {
        showNotice({ title: 'DELETE FAILED', message: 'Could not delete itinerary.', type: 'error' });
      } finally {
        setMutating(false);
      }
      return;
    }

    try {
      setMutating(true);
      const nextBundle = await itineraryService.removeDay(activeItineraryId, confirmAction.dayIndex);
      setBundle(nextBundle);
      setConfirmAction(null);
      if (nextBundle.days.length > 0) {
        setSelectedDayIndex(nextBundle.days[0].dayIndex);
      } else {
        setSelectedDayIndex(1);
      }
    } catch {
      showNotice({ title: 'REMOVE FAILED', message: 'Could not remove day.', type: 'error' });
    } finally {
      setMutating(false);
    }
  }, [activeItineraryId, confirmAction, loadBuilderState, showNotice, writesDisabled]);

  if (loading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.stateTitle}>Loading Dossier</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={44} color={theme.colors.primary} />
        <Text style={styles.stateTitle}>Could not load dossier</Text>
        <TouchableOpacity style={styles.primaryCta} onPress={refresh}>
          <Text style={styles.primaryCtaText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!bundle || !activeItineraryId) {
    return (
      <View style={styles.centeredState}>
        <TravisSignal status="idle" size={80} editorial />
        <Text style={styles.stateTitle}>No Active Dossier</Text>
        <Text style={styles.stateSubtitle}>Every great journey needs a narrative shell.</Text>
        <TouchableOpacity style={styles.primaryCta} onPress={() => setCreateOpen(true)}>
          <Text style={styles.primaryCtaText}>Create Itinerary</Text>
        </TouchableOpacity>
        
        <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Itinerary</Text>
              <TextInput
                style={styles.input}
                placeholder="Trip Name"
                placeholderTextColor={theme.colors.textSecondary}
                value={createTitle}
                onChangeText={setCreateTitle}
                maxLength={TITLE_MAX_LENGTH}
              />
              <TextInput
                style={styles.input}
                placeholder="Destination"
                placeholderTextColor={theme.colors.textSecondary}
                value={createDestination}
                onChangeText={setCreateDestination}
                maxLength={DESTINATION_MAX_LENGTH}
              />
              <TouchableOpacity
                style={styles.dateInputField}
                onPress={() => setCreateCalendarOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                <View style={styles.dateInputContent}>
                  <Text style={styles.dateInputLabel}>DATES</Text>
                  <Text style={styles.dateInputValue}>{createDateDisplay.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.dateInputActions}>
                <TouchableOpacity style={styles.inlineAction} onPress={() => setCreateCalendarOpen(true)}>
                  <Text style={styles.inlineActionText}>{createStartDate ? 'EDIT DATES' : 'PICK DATES'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.inlineAction}
                  onPress={() => {
                    setCreateStartDate('');
                    setCreateEndDate('');
                  }}
                  disabled={!createStartDate && !createEndDate}
                >
                  <Text style={styles.inlineActionText}>SET LATER</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.modalClose} onPress={() => setCreateOpen(false)}><Text style={styles.modalCloseText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.primaryCtaSmall} onPress={handleCreateItinerary} disabled={creating}>
                  <Text style={styles.primaryCtaText}>{creating ? 'Creating...' : 'Begin'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={createCalendarOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setCreateCalendarOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCardLarge}>
              <Text style={styles.modalTitle}>Choose Dates</Text>
              <Text style={styles.calendarHint}>Tap once for start date, tap again for end date.</Text>
              <Calendar
                theme={{
                  calendarBackground: '#FFF',
                  textSectionTitleColor: '#BBB',
                  selectedDayBackgroundColor: theme.colors.textPrimary,
                  selectedDayTextColor: '#FFF',
                  todayTextColor: theme.colors.primary,
                  dayTextColor: '#1A1A1A',
                  textDisabledColor: '#DDD',
                  dotColor: theme.colors.primary,
                  monthTextColor: '#1A1A1A',
                  indicatorColor: '#1A1A1A',
                  textDayFontFamily: theme.typography.fonts.narrative,
                  textMonthFontFamily: theme.typography.fonts.black,
                  textDayHeaderFontFamily: theme.typography.fonts.technicalBold,
                }}
                markingType={'period'}
                markedDates={createMarkedDates}
                onDayPress={(day) => handleCreateCalendarSelect(day.dateString)}
              />
              <View style={styles.createCalendarActions}>
                <TouchableOpacity style={styles.primaryCtaSmall} onPress={() => setCreateCalendarOpen(false)}>
                  <Text style={styles.primaryCtaText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const dossierHeader = (
    <View style={styles.listHeaderWrapper}>
      {/* Editorial Masthead */}
      <View style={styles.masthead}>
        <View style={styles.mastheadTop}>
          <View style={styles.mastheadTitleWrap}>
            <Text style={styles.mastheadLocationDisplay} numberOfLines={2}>
              {bundle.header.destinationCity.toUpperCase()}
            </Text>
            <TextInput
              style={[
                styles.mastheadTripTitleInput,
                { fontSize: adaptiveTripTitleFontSize, lineHeight: adaptiveTripTitleFontSize + 4 },
              ]}
              value={draftTitle}
              onChangeText={setDraftTitle}
              onBlur={handleSaveInlineDetails}
              onSubmitEditing={handleSaveInlineDetails}
              placeholder="Trip Title"
              placeholderTextColor={theme.colors.textSecondary}
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="words"
              multiline={false}
              numberOfLines={1}
              maxLength={TITLE_MAX_LENGTH}
            />
            <Text style={styles.titleCounter}>{draftTitle.trim().length}/{TITLE_MAX_LENGTH}</Text>
          </View>
          <View style={styles.mastheadRight}>
            <TouchableOpacity onPress={() => setCalendarOpen(true)} style={styles.settingsButton}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteItinerary} style={styles.settingsButton}>
              <Trash2 size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TravisSignal size={48} status={mutating ? 'thinking' : 'idle'} editorial />
          </View>
        </View>
      </View>

      <View style={styles.dayStripHeader}>
        <Text style={styles.dayStripLabel}>PLAN BY DAY</Text>
        <TouchableOpacity style={styles.inlineAction} onPress={handleAddDayShell} disabled={writesDisabled}>
          <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.inlineActionText}>ADD DAY</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
        {dayIndexes.map(day => (
          <TouchableOpacity
            key={day}
            style={[styles.dayPill, day === selectedDayIndex && styles.dayPillActive]}
            onPress={() => setSelectedDayIndex(day)}
          >
            <Text style={[styles.dayPillText, day === selectedDayIndex && styles.dayPillTextActive]}>DAY {day}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>DAY {selectedDayIndex} STOPS</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity style={styles.inlineAction} onPress={handleRemoveDay} disabled={writesDisabled}>
            <Trash2 size={14} color={theme.colors.primary} />
            <Text style={styles.inlineActionText}>REMOVE DAY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlineAction} onPress={() => navigation.navigate('Home' as any)}>
            <Ionicons name="compass-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.inlineActionText}>GO TO EXPLORE</Text>
          </TouchableOpacity>
        </View>
      </View>

      {selectedDayItems.length === 0 && (
        <View style={styles.emptyChapter}>
          <Text style={styles.emptyChapterTitle}>CHAPTER {selectedDayIndex}</Text>
          <Text style={styles.emptyChapterText}>
            Travis: "A blank chapter. Add stops from Explore and they will land here."
          </Text>
        </View>
      )}

      {viewMode === 'map' && (
        <View style={styles.mapDossier}>
          {MapView && (
            <View style={styles.mapContainer}>
              {mappableDayItems.length ? (
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFill}
                  customMapStyle={LIGHT_MAP_STYLE}
                  initialRegion={{
                    latitude: mappableDayItems[0].item.lat as number,
                    longitude: mappableDayItems[0].item.lng as number,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                >
                  {mappableDayItems.map(({ item, listIndex }) => (
                    <Marker key={item.id} coordinate={{ latitude: item.lat as number, longitude: item.lng as number }}>
                      <View style={styles.mapMarker}><Text style={styles.markerText}>{listIndex + 1}</Text></View>
                    </Marker>
                  ))}
                  {mappableDayItems.length > 1 && Polyline && (
                    <Polyline
                      coordinates={mappableDayItems.map(({ item }) => ({ latitude: item.lat as number, longitude: item.lng as number }))}
                      strokeColor={theme.colors.textPrimary} strokeWidth={2} lineDashPattern={[4, 4]}
                    />
                  )}
                </MapView>
              ) : (
                <View style={styles.mapUnavailable}>
                  <Text style={styles.mapUnavailableText}>No mapped stops for this day yet.</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DraggableFlatList
        data={viewMode === 'story' ? selectedDayItems : []}
        keyExtractor={item => item.id}
        activationDistance={12}
        ListHeaderComponent={dossierHeader}
        contentContainerStyle={viewMode === 'story' ? styles.scrapbookList : styles.mapModeContainer}
        onDragEnd={({ from, to }) => { if (from !== to) void handleReorder(from, to); }}
        renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<ItineraryActivityItem>) => {
          const index = getIndex();
          if (index == null) return null;
          const rotation = index % 2 === 0 ? '-1.5deg' : '1.5deg';
          const alignmentStyle = index % 2 === 0 ? { paddingRight: 40 } : { paddingLeft: 40 };
          const bookingToneStyle = bookingStateByItemId[item.id]?.statusTone === 'success' ? styles.bookingChipSuccess : bookingStateByItemId[item.id]?.statusTone === 'warning' ? styles.bookingChipWarning : bookingStateByItemId[item.id]?.statusTone === 'error' ? styles.bookingChipError : undefined;
          
          return (
            <View
              style={[
                styles.scrapbookItem,
                alignmentStyle,
                { transform: [{ rotate: isActive ? '0deg' : rotation }, { scale: isActive ? 1.05 : 1 }] },
              ]}
            >
              <TouchableOpacity onLongPress={drag} activeOpacity={0.9} disabled={writesDisabled} style={[styles.storyCard, isActive && styles.storyCardActive]}>
                <View style={styles.storyCardImageBox}>
                  <Image source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800' }} style={styles.storyCardImage} />
                </View>
                <View style={styles.storyCardBody}>
                  <View style={styles.storyCardHeader}>
                    <Text style={styles.storyCardTitle} numberOfLines={1}>{item.title}</Text>
                    {bookingTrackingEnabled && (
                      <View style={[styles.bookingChip, bookingToneStyle]}>
                        <Text style={styles.bookingChipText}>{(bookingStateByItemId[item.id]?.statusLabel || 'Not Started').toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.storyCardInsight}>"{item.narrativeWhy || `Travis: 'A strategic addition.'`}"</Text>
                  <View style={styles.storyCardFooter}>
                    <Text style={styles.storyCardMeta}>{(item.category || 'SPOT').toUpperCase()} â€¢ {item.city?.toUpperCase() || 'UNKNOWN'}</Text>
                    <View style={styles.stopActions}>
                      <TouchableOpacity onPress={() => handleMoveItemToAdjacentDay(item, -1)} style={styles.storyActionButton} disabled={writesDisabled || item.dayIndex <= 1}>
                        <Ionicons name="chevron-back" size={14} color={theme.colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleMoveItemToAdjacentDay(item, 1)} style={styles.storyActionButton} disabled={writesDisabled}>
                        <Ionicons name="chevron-forward" size={14} color={theme.colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRemoveItem(item)} style={styles.storyActionButton} disabled={writesDisabled}>
                        <Trash2 size={14} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
        ListFooterComponent={viewMode === 'map' ? (
          <View style={styles.mapItemsWrapper}>
            {selectedDayItems.map((item, index) => {
              const canMap = item.lat != null && item.lng != null;
              return (
                <TouchableOpacity key={item.id} onPress={() => { if (canMap && mapRef.current) mapRef.current.animateToRegion({ latitude: item.lat as number, longitude: item.lng as number, latitudeDelta: 0.01, longitudeDelta: 0.01 }); }} style={[styles.miniStopCard, !canMap && styles.miniStopCardDisabled]} disabled={!canMap}>
                  <View style={styles.miniStopIndex}><Text style={styles.miniStopIndexText}>{index + 1}</Text></View>
                  <View style={styles.miniStopContent}>
                    <Text style={styles.miniStopTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.miniStopMeta}>{(item.category || 'SPOT').toUpperCase()}{!canMap ? ' | NO MAP PIN' : ''}</Text>
                  </View>
                  <TouchableOpacity style={styles.miniStopRemove} onPress={() => handleRemoveItem(item)} disabled={writesDisabled}>
                    <Trash2 size={14} color={theme.colors.primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      />

      {/* FLOATING COMMAND PILL */}
      <View style={styles.commandPillContainer}>
        <View style={styles.commandPill}>
          <TouchableOpacity 
            onPress={() => setViewMode('story')}
            style={[styles.commandButton, viewMode === 'story' && styles.commandButtonActive]}
          >
            <BookOpen size={18} color={viewMode === 'story' ? '#FFF' : theme.colors.textSecondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.commandAdd}
            onPress={() => navigation.navigate('Home' as any)}
          >
            <Ionicons name="add" size={28} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setViewMode('map')}
            style={[styles.commandButton, viewMode === 'map' && styles.commandButtonActive]}
          >
            <MapIcon size={18} color={viewMode === 'map' ? '#FFF' : theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Picker Modal */}
      <Modal visible={calendarOpen} transparent animationType="slide" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardLarge}>
            <Text style={styles.modalTitle}>Mission Timeline</Text>
            <Calendar
              theme={{
                calendarBackground: '#FFF',
                textSectionTitleColor: '#BBB',
                selectedDayBackgroundColor: theme.colors.textPrimary,
                selectedDayTextColor: '#FFF',
                todayTextColor: theme.colors.primary,
                dayTextColor: '#1A1A1A',
                textDisabledColor: '#DDD',
                dotColor: theme.colors.primary,
                monthTextColor: '#1A1A1A',
                indicatorColor: '#1A1A1A',
                textDayFontFamily: theme.typography.fonts.narrative,
                textMonthFontFamily: theme.typography.fonts.black,
                textDayHeaderFontFamily: theme.typography.fonts.technicalBold,
              }}
              markingType={'period'}
              markedDates={{
                [bundle.header.startDate || '']: { startingDay: true, color: theme.colors.textPrimary, textColor: '#FFF' },
                [bundle.header.endDate || '']: { endingDay: true, color: theme.colors.textPrimary, textColor: '#FFF' },
              }}
              onDayPress={(day) => {
                if (!bundle.header.startDate || (bundle.header.startDate && bundle.header.endDate)) {
                  void handleCalendarSelect(day.dateString, day.dateString);
                } else {
                  void handleCalendarSelect(bundle.header.startDate, day.dateString);
                }
              }}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCalendarOpen(false)}>
              <Text style={styles.modalCloseText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(confirmAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmAction(null)}
      >
        <View style={styles.modalBackdropCentered}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setConfirmAction(null)} disabled={writesDisabled} />
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>
              {confirmAction?.type === 'delete_itinerary' ? 'BURN DOSSIER' : 'REDACT CHAPTER'}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmAction?.type === 'delete_itinerary'
                ? "Travis: 'Redaction is permanent. Are you sure you want to burn this mission data?'"
                : `Travis: 'Removing Chapter ${confirmAction?.dayIndex} will permanently remove its stops from this itinerary. Proceed?'`}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmAction(null)}
                disabled={writesDisabled}
              >
                <Text style={styles.confirmCancelText}>
                  {confirmAction?.type === 'delete_itinerary' ? 'ABORT' : 'STAY'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDanger}
                onPress={() => {
                  void handleConfirmAction();
                }}
                disabled={writesDisabled}
              >
                <Text style={styles.confirmDangerText}>
                  {writesDisabled
                    ? 'WORKING...'
                    : confirmAction?.type === 'delete_itinerary'
                      ? 'BURN IT'
                      : 'REDACT'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listHeaderWrapper: { paddingHorizontal: theme.spacing.md },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.lg },
  stateTitle: { marginTop: 20, color: theme.colors.textPrimary, fontSize: 24, fontFamily: theme.typography.fonts.black, textAlign: 'center' },
  stateSubtitle: { marginTop: 8, color: theme.colors.textSecondary, fontSize: 16, textAlign: 'center', fontFamily: theme.typography.fonts.narrative },
  primaryCta: { marginTop: 32, backgroundColor: theme.colors.textPrimary, borderRadius: 30, paddingHorizontal: 32, paddingVertical: 16 },
  primaryCtaSmall: { backgroundColor: theme.colors.textPrimary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  primaryCtaText: { color: '#fff', fontSize: 14, fontFamily: theme.typography.fonts.black, letterSpacing: 1 },
  masthead: { marginTop: 20, marginBottom: 32 },
  mastheadTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mastheadTitleWrap: { flex: 1, marginRight: 20 },
  mastheadLocationDisplay: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 40,
    lineHeight: 44,
    marginTop: -1,
    minHeight: 88,
  },
  mastheadTripTitleInput: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    padding: 0,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  titleCounter: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 3,
  },
  mastheadRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingsButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  dayStripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayStripLabel: { color: theme.colors.textPrimary, fontSize: 12, fontFamily: theme.typography.fonts.black, letterSpacing: 1 },
  dayStrip: { gap: 12, paddingBottom: 20, paddingRight: 6 },
  dayPill: { paddingHorizontal: 4, paddingVertical: 8, marginRight: 16, borderBottomWidth: 2, borderColor: 'transparent' },
  dayPillActive: { borderColor: theme.colors.primary },
  dayPillText: { color: theme.colors.textSecondary, fontFamily: theme.typography.fonts.technicalBold, fontSize: 10, letterSpacing: 1.5 },
  dayPillTextActive: { color: theme.colors.textPrimary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 12 },
  sectionTitle: { color: theme.colors.textPrimary, fontFamily: theme.typography.fonts.black, fontSize: 18 },
  sectionActions: { flexDirection: 'row', gap: 8 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.colors.surfaceElevated },
  inlineActionText: { color: theme.colors.textPrimary, fontFamily: theme.typography.fonts.technicalBold, fontSize: 9, letterSpacing: 1 },
  emptyChapter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyChapterTitle: { fontFamily: theme.typography.fonts.black, fontSize: 12, letterSpacing: 4, color: theme.colors.primary, marginBottom: 20 },
  emptyChapterText: { fontFamily: theme.typography.fonts.narrative, fontSize: 18, color: theme.colors.textPrimary, fontStyle: 'italic', textAlign: 'center', lineHeight: 28, paddingHorizontal: 40 },
  scrapbookList: { paddingBottom: 160, paddingTop: 10 },
  scrapbookItem: { marginBottom: 32 },
  storyCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, paddingBottom: 20, ...theme.shadows.float, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  storyCardActive: { shadowOpacity: 0.25, shadowRadius: 20, elevation: 20 },
  storyCardImageBox: { aspectRatio: 1, borderRadius: 4, overflow: 'hidden', backgroundColor: '#F0F0F0', marginBottom: 16 },
  storyCardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  storyCardBody: { paddingHorizontal: 4 },
  storyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  storyCardTitle: { fontFamily: theme.typography.fonts.black, fontSize: 18, color: theme.colors.textPrimary, flex: 1, marginRight: 8, letterSpacing: -0.5 },
  storyCardInsight: { fontFamily: theme.typography.fonts.narrative, fontSize: 14, color: theme.colors.textPrimary, fontStyle: 'italic', lineHeight: 22, marginBottom: 20 },
  storyCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  storyCardMeta: { fontFamily: theme.typography.fonts.technicalBold, fontSize: 9, color: theme.colors.textSecondary, letterSpacing: 1 },
  storyActionButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  mapModeContainer: { paddingBottom: 160 },
  mapDossier: { marginTop: 10 },
  mapContainer: { height: 300, borderRadius: 24, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  mapItemsWrapper: { paddingHorizontal: theme.spacing.md },
  miniStopCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 16, borderRadius: 20, marginBottom: 12, ...theme.shadows.card },
  miniStopCardDisabled: { opacity: 0.7 },
  miniStopIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.textPrimary, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  miniStopIndexText: { color: '#FFF', fontFamily: theme.typography.fonts.black, fontSize: 12 },
  miniStopContent: { flex: 1 },
  miniStopTitle: { fontFamily: theme.typography.fonts.black, fontSize: 15, color: theme.colors.textPrimary },
  miniStopMeta: { fontFamily: theme.typography.fonts.technicalBold, fontSize: 8, color: theme.colors.textSecondary, letterSpacing: 1, marginTop: 2 },
  miniStopRemove: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  mapMarker: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.textPrimary, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  markerText: { color: '#FFF', fontSize: 10, fontFamily: theme.typography.fonts.black },
  mapUnavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  mapUnavailableText: { color: theme.colors.textSecondary, fontFamily: theme.typography.fonts.narrative, fontSize: 14, textAlign: 'center' },
  bookingChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: theme.colors.surfaceElevated },
  bookingChipSuccess: { backgroundColor: 'rgba(46, 125, 50, 0.08)' },
  bookingChipWarning: { backgroundColor: 'rgba(178, 106, 0, 0.08)' },
  bookingChipError: { backgroundColor: 'rgba(183, 28, 28, 0.08)' },
  bookingChipText: { color: theme.colors.textPrimary, fontFamily: theme.typography.fonts.technicalBold, fontSize: 8, letterSpacing: 0.5 },
  stopActions: { flexDirection: 'row', gap: 8 },
  commandPillContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  commandPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 32, 
    paddingHorizontal: 8, 
    paddingVertical: 8, 
    gap: 12,
    ...theme.shadows.float,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  commandButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  commandButtonActive: { backgroundColor: theme.colors.textPrimary },
  commandAdd: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.textPrimary, alignItems: 'center', justifyContent: 'center', ...theme.shadows.card },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBackdropCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, ...theme.shadows.float },
  modalCardLarge: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, minHeight: 520, ...theme.shadows.float },
  confirmCard: { backgroundColor: theme.colors.surface, borderRadius: 22, padding: 20, ...theme.shadows.float },
  modalTitle: { fontFamily: theme.typography.fonts.black, color: theme.colors.textPrimary, fontSize: 24, marginBottom: 20, letterSpacing: -0.5 },
  confirmMessage: { marginTop: -6, marginBottom: 20, color: theme.colors.textSecondary, fontFamily: theme.typography.fonts.narrative, fontSize: 14, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmCancel: { flex: 1, height: 44, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceElevated },
  confirmCancelText: { color: theme.colors.textPrimary, fontFamily: theme.typography.fonts.technicalBold, fontSize: 11, letterSpacing: 0.8 },
  confirmDanger: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  confirmDangerText: { color: '#FFF', fontFamily: theme.typography.fonts.black, fontSize: 11, letterSpacing: 0.8 },
  calendarHint: { marginTop: -8, marginBottom: 12, color: theme.colors.textSecondary, fontFamily: theme.typography.fonts.narrative, fontSize: 13 },
  modalButtonRow: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: theme.typography.fonts.narrative,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  dateInputField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  dateInputContent: { flex: 1 },
  dateInputLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fonts.technicalBold,
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  dateInputValue: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fonts.black,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  dateInputActions: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  createCalendarActions: { marginTop: 16, alignItems: 'center' },
  modalClose: { alignSelf: 'center', marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, backgroundColor: theme.colors.surfaceElevated },
  modalCloseText: { color: theme.colors.textPrimary, fontFamily: theme.typography.fonts.technicalBold, fontSize: 10, letterSpacing: 1 },
  addButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
});

export default JourneysScreen;

