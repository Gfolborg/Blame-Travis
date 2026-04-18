import React, { useCallback, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Image
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';

import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { TravisSignal } from '../components/TravisSignal';
import { supabase } from '../services/supabase';
import { Adventure } from '../types/adventure';
import { useAdventure } from '../hooks/useAdventure';
import { useNotice } from '../components/TravisNotice';
import { StopCard } from '../components/StopCard';
import { InkBleedItem } from '../components/InkBleedItem';
import { DayShellCard } from '../components/DayShellCard';
import { fetchAdventureById, getCurrentTripDay } from '../services/adventureData';

type Props = NativeStackScreenProps<RootStackParamList, 'AdventureReveal'>;

const AdventureRevealScreen: React.FC<Props> = ({ navigation, route }) => {
  const { AdventureId } = route.params;
  const [adventure, setAdventure] = useState<Adventure | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const { refreshAdventure } = useAdventure();
  const { showNotice } = useNotice();

  // Calendar Logic
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchAdventure = useCallback(async () => {
    try {
      setLoading(true);
      const nextAdventure = await fetchAdventureById(AdventureId);
      setAdventure(nextAdventure);
    } catch (error) {
      console.error('Error fetching adventure reveal:', error);
    } finally {
      setLoading(false);
    }
  }, [AdventureId]);

  useEffect(() => {
    fetchAdventure();
  }, [fetchAdventure]);

  const handleAccept = async () => {
    if (!adventure) return;
    
    try {
      setCommitting(true);
      
      const maxDay = adventure.days?.length || 1;
      const startDate = new Date(selectedDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (maxDay - 1));

      const { error } = await supabase
        .from('adventures')
        .update({ 
          status: 'active',
          drop_date: startDate.toISOString(),
          deadline: endDate.toISOString() 
        } as any)
        .eq('id', adventure.id);

      if (error) throw error;

      await refreshAdventure();
      navigation.navigate('MainTabs', { screen: 'Home' });

    } catch (error) {
      console.error('Error accepting adventure:', error);
    } finally {
      setCommitting(false);
    }
  };

  const handleReroll = async () => {
    showNotice({
      title: 'DISCARD THIS PLAN?',
      message: "Travis: 'Throwing this one in the fire? It will be gone forever. Ready to try again?'",
      type: 'warning',
      actions: [
        { text: 'KEEP IT', style: 'cancel', onPress: () => {} },
        { text: 'DISCARD & RE-DRAFT', style: 'destructive', onPress: executeReroll },
      ],
    });
  };

  const executeReroll = async () => {
    if (!adventure) return;
    try {
      setLoading(true);
      
      // OPTION 2: Actually delete the old draft
      await supabase.from('adventures').delete().eq('id', adventure.id);
      
      // Navigate back to start over
      navigation.navigate('AdventureRequest');
    } catch (error) {
      console.error('Error executing reroll:', error);
      setLoading(false);
    }
  };

  if (loading || committing) {
    return (
      <View style={styles.container}>
        <View style={styles.heroPlaceholder}>
          <TravisSignal status={committing ? 'tracking' : 'thinking'} size={120} />
          <Text style={styles.placeholderText}>
            {committing ? 'STAMPING YOUR PASSPORT...' : 'TRAVIS IS DRAFTING...'}
          </Text>
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  if (!adventure) return null;

  const isDayTrip = adventure.adventure_type.includes('1_day');
  const isDraftMode = adventure.status === 'draft';
  const isActiveMode = adventure.status === 'active';
  const fullWindowStartDay = isActiveMode ? getCurrentTripDay(adventure) : 1;
  const fullWindowDays = new Set([fullWindowStartDay, fullWindowStartDay + 1, fullWindowStartDay + 2]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* JOURNEY ASSIGNMENT SECTION (Top) */}
        <View style={styles.assignmentContainer}>
          <View style={styles.imageHeader}>
             <Image 
                source={adventure.hero_image_url ? { uri: adventure.hero_image_url } : require('../../assets/textures/vintage-satellite-map.png')} 
                style={styles.heroImage}
                resizeMode="cover"
             />
             <View style={styles.imageOverlay} />
             <View style={styles.signalPosition}>
                <TravisSignal status="tracking" size={80} />
             </View>
          </View>
          
          <View style={styles.briefingHeader}>
            <Text style={styles.title}>{adventure.title}</Text>
            <Text style={styles.description}>{adventure.why_travis_picked_this}</Text>
            
            {adventure.bonus_goal && (
              <View style={styles.bonusBadge}>
                <Ionicons name="star" size={14} color="#FFFFFF" />
                <Text style={styles.bonusLabel}>SIDE QUEST: {adventure.bonus_goal}</Text>
              </View>
            )}
          </View>
        </View>

        {/* JOURNEY DETAILS SECTION (Itinerary) */}
        <View style={styles.itineraryContainer}>
          <Text style={styles.sectionHeader}>{isDraftMode ? 'THE ITINERARY' : 'FULL ROUTE'}</Text>
          
          {(adventure.days || []).sort((a, b) => a.day_number - b.day_number).map((dayData) => {
            const day = dayData.day_number;
            const stops = dayData.itinerary_json;
            const inRollingWindow = fullWindowDays.has(day);
            
            return (
              <View key={day} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayLine} />
                  <Text style={styles.dayTitle}>
                    {isDayTrip ? "TODAY'S FLOW" : `DAY ${day}`}
                  </Text>
                  <View style={styles.dayLine} />
                </View>
                
                {dayData.status === 'ready' && inRollingWindow ? (
                  <>
                    {stops.map((stop, idx) => {
                      const time = isDayTrip ? `${9 + idx * 2}:00` : null;

                      return (
                        <View key={`${stop.place_id}_${idx}`} style={styles.stopRow}>
                          {time && (
                            <View style={styles.timeContainer}>
                              <Text style={styles.timeText}>{time}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <InkBleedItem
                              animationKey={`reveal-stop-${dayData.day_number}-${stop.place_id}`}
                              delay={idx * 150}
                            >
                              <StopCard stop={stop} />
                            </InkBleedItem>
                          </View>
                        </View>
                      );
                    })}

                    {dayData.alternates_json.length > 0 && (
                      <View style={styles.alternateBlock}>
                        <Text style={styles.alternateLabel}>BACKUP PICKS</Text>
                        <View style={styles.alternateRow}>
                          {dayData.alternates_json.slice(0, 3).map(alternate => (
                            <View key={alternate.place_id} style={styles.alternateChip}>
                              <Text style={styles.alternateChipText} numberOfLines={1}>
                                {alternate.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <InkBleedItem animationKey={`reveal-shell-${dayData.day_number}`} delay={dayData.day_number * 80}>
                    <DayShellCard day={dayData} />
                  </InkBleedItem>
                )}
              </View>
            );
          })}

          {isDraftMode ? (
            <>
              <Text style={styles.sectionHeader}>READY TO ROLL? PICK YOUR START DATE.</Text>
              <View style={styles.calendarWrapper}>
                <Calendar
                  current={selectedDate}
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  markedDates={{
                    [selectedDate]: { selected: true, disableTouchEvent: true, selectedColor: theme.colors.primary }
                  }}
                  theme={{
                    calendarBackground: 'transparent',
                    textSectionTitleColor: theme.colors.textSecondary,
                    selectedDayBackgroundColor: theme.colors.primary,
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: theme.colors.primary,
                    dayTextColor: theme.colors.textPrimary,
                    monthTextColor: theme.colors.textPrimary,
                    textDayFontWeight: '600',
                    textMonthFontWeight: '900',
                    textDayHeaderFontWeight: '900',
                  }}
                />
              </View>

              <View style={styles.actionContainer}>
                <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                  <Text style={styles.acceptButtonText}>COMMIT & STAMP</Text>
                  <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" style={{ marginLeft: 12 }} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.rerollButton} onPress={handleReroll}>
                  <Text style={styles.rerollButtonText}>RE-DRAFT PLAN</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {isActiveMode ? (
            <View style={styles.readOnlyFooter}>
              <Text style={styles.readOnlyFooterText}>
                Travis already stamped this trip. The Desk will handle what matters today.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: 60 },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  placeholderText: { marginTop: 20, color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  
  assignmentContainer: { backgroundColor: '#FFFFFF', paddingBottom: 32 },
  imageHeader: { height: 400, width: '100%', position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)' },
  signalPosition: { position: 'absolute', bottom: -40, right: 30, backgroundColor: theme.colors.surface, borderRadius: 50, padding: 10, elevation: 5 },
  
  briefingHeader: { paddingHorizontal: 32, paddingTop: 40 },
  title: { fontSize: 36, fontWeight: '900', color: theme.colors.textPrimary, lineHeight: 40 },
  description: { fontSize: 16, color: theme.colors.textSecondary, marginTop: 16, lineHeight: 24, fontWeight: '500' },
  bonusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 20 },
  bonusLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', marginLeft: 6, letterSpacing: 0.5 },

  itineraryContainer: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: { fontSize: 12, fontWeight: '900', color: theme.colors.textSecondary, letterSpacing: 3, marginTop: 40, marginBottom: 20, textAlign: 'center' },
  
  dayGroup: { marginBottom: 32 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  dayLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dayTitle: { marginHorizontal: 16, fontSize: 14, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: 1 },
  
  stopRow: { flexDirection: 'row', gap: 12 },
  timeContainer: { width: 50, paddingTop: 15 },
  timeText: { fontSize: 12, fontWeight: 'bold', color: theme.colors.primary },
  alternateBlock: { marginTop: 8, marginLeft: 4 },
  alternateLabel: { fontSize: 10, fontWeight: '900', color: theme.colors.textSecondary, letterSpacing: 1.5, marginBottom: 10 },
  alternateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alternateChip: { backgroundColor: theme.colors.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  alternateChipText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '700', maxWidth: 120 },

  calendarWrapper: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 10,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  actionContainer: { gap: 12, marginTop: 20 },
  acceptButton: { backgroundColor: theme.colors.primary, height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  acceptButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  rerollButton: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.primary },
  rerollButtonText: { color: theme.colors.primary, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  readOnlyFooter: {
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  readOnlyFooterText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '600',
  },

  closeButton: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});

export default AdventureRevealScreen;
