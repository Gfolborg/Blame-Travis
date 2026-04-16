import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Alert,
  Image,
  Dimensions
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { TravisSignal } from '../components/TravisSignal';
import { supabase } from '../services/supabase';
import { Adventure, ItineraryStop } from '../types/adventure';
import { useAdventure } from '../hooks/useAdventure';
import { useProfile } from '../hooks/useProfile';
import { notificationsService } from '../services/notifications';
import { StopCard } from '../components/StopCard';
import { InkBleedItem } from '../components/InkBleedItem';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'AdventureReveal'>;

const AdventureRevealScreen: React.FC<Props> = ({ navigation, route }) => {
  const { AdventureId } = route.params;
  const [adventure, setAdventure] = useState<Adventure | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const { refreshAdventure } = useAdventure();
  const { profile, updateProfile } = useProfile();

  // Date Selector Logic
  const getNext7Days = () => {
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const [dates] = useState(getNext7Days());
  const [selectedDate, setSelectedDate] = useState<Date>(dates[0]);

  useEffect(() => {
    fetchAdventure();
  }, [AdventureId]);

  const fetchAdventure = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('adventures')
        .select('*')
        .eq('id', AdventureId)
        .single();

      if (error) throw error;
      setAdventure(data as unknown as Adventure);
    } catch (error) {
      console.error('Error fetching adventure reveal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!adventure || !profile) return;
    
    try {
      setCommitting(true);
      const deadline = new Date(selectedDate);
      const durationDays = adventure.adventure_type.includes('weekend') ? 3 : 
                          adventure.adventure_type.includes('vacation') ? 7 : 1;
      deadline.setDate(deadline.getDate() + durationDays);

      const { error } = await supabase
        .from('adventures')
        .update({ 
          status: 'active',
          deadline: deadline.toISOString(),
          drop_date: selectedDate.toISOString() 
        } as any)
        .eq('id', adventure.id);

      if (error) throw error;

      await notificationsService.scheduleAdventureReminders(adventure.id, selectedDate.toISOString());
      await refreshAdventure();
      navigation.navigate('MainTabs', { screen: 'Home' });

    } catch (error) {
      console.error('Error accepting adventure:', error);
    } finally {
      setCommitting(false);
    }
  };

  const handleReroll = async () => {
    Alert.alert(
      "DISCARD THIS PLAN?",
      "Travis: 'Throwing this one in the fire? It will be gone forever. Ready to try again?'",
      [
        { text: "KEEP IT", style: "cancel" },
        { text: "DISCARD & RE-DRAFT", style: "destructive", onPress: executeReroll }
      ]
    );
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

  const formatDate = (date: Date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return {
      dayName: days[date.getDay()],
      dayNum: date.getDate()
    };
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

  // Group stops by Day
  const groupedStops: Record<number, ItineraryStop[]> = {};
  adventure.itinerary_json.forEach(stop => {
    const day = stop.day || 1;
    if (!groupedStops[day]) groupedStops[day] = [];
    groupedStops[day].push(stop);
  });

  const isDayTrip = adventure.adventure_type.includes('1_day');

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* JOURNEY ASSIGNMENT SECTION (Top) */}
        <View style={styles.assignmentContainer}>
          <View style={styles.imageHeader}>
             <Image 
                source={require('../../assets/textures/vintage-satellite-map.png')} 
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
          <Text style={styles.sectionHeader}>THE ITINERARY</Text>
          
          {Object.keys(groupedStops).sort((a, b) => Number(a) - Number(b)).map((dayKey) => {
            const day = Number(dayKey);
            const stops = groupedStops[day];
            
            return (
              <View key={day} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayLine} />
                  <Text style={styles.dayTitle}>
                    {isDayTrip ? "TODAY'S FLOW" : `DAY ${day}`}
                  </Text>
                  <View style={styles.dayLine} />
                </View>
                
                {stops.map((stop, idx) => {
                  // Fake time for day trips
                  const time = isDayTrip ? `${9 + idx * 2}:00` : null;
                  
                  return (
                    <View key={stop.place_id} style={styles.stopRow}>
                      {time && (
                        <View style={styles.timeContainer}>
                          <Text style={styles.timeText}>{time}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <InkBleedItem delay={idx * 150}>
                          <StopCard stop={stop} />
                        </InkBleedItem>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <Text style={styles.sectionHeader}>COMMIT TO THE ROAD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datePicker}>
            {dates.map((date, idx) => {
              const { dayName, dayNum } = formatDate(date);
              const isSelected = selectedDate.toDateString() === date.toDateString();
              return (
                <TouchableOpacity 
                  key={idx}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[styles.dayName, isSelected && styles.dateTextSelected]}>{dayName}</Text>
                  <Text style={[styles.dayNum, isSelected && styles.dateTextSelected]}>{dayNum}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
              <Text style={styles.acceptButtonText}>STAMP THIS DAY</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 12 }} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.rerollButton} onPress={handleReroll}>
              <Text style={styles.rerollButtonText}>RE-DRAFT PLAN</Text>
            </TouchableOpacity>
          </View>
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

  datePicker: { flexDirection: 'row', marginBottom: 20 },
  dateCard: { width: 65, height: 80, backgroundColor: theme.colors.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: theme.colors.border },
  dateCardSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayName: { fontSize: 10, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 4 },
  dayNum: { fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary },
  dateTextSelected: { color: '#FFFFFF' },

  actionContainer: { gap: 12, marginTop: 20 },
  acceptButton: { backgroundColor: theme.colors.primary, height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  acceptButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  rerollButton: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.primary },
  rerollButtonText: { color: theme.colors.primary, fontSize: 16, fontWeight: '900', letterSpacing: 2 },

  closeButton: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});

export default AdventureRevealScreen;
