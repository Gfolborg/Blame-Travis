import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { theme } from '../theme';
import { useAdventure } from '../hooks/useAdventure';
import { useProfile } from '../hooks/useProfile';
import { useNotice } from '../components/TravisNotice';
import { RootStackParamList } from '../types/navigation';
import { TravisSignal } from '../components/TravisSignal';
import { MapBackground } from '../components/MapBackground';
import { discoveryService } from '../services/discovery';
import { InkBleedItem } from '../components/InkBleedItem';
import { StopCard } from '../components/StopCard';
import { supabase } from '../services/supabase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { currentAdventure, loading: adventureLoading, replaceItineraryStop, refreshAdventure } = useAdventure();
  const { profile, loading: profileLoading } = useProfile();
  const { showNotice } = useNotice();
  const [rerollTimeLeft, setRerollTimeLeft] = useState<number>(0);

  // Parallax Scroll Tracking
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentAdventure && currentAdventure.status === 'active' && profile?.is_premium) {
        const updatedAt = new Date(currentAdventure.updated_at).getTime();
        const now = new Date().getTime();
        const diffInSeconds = Math.max(0, 300 - Math.floor((now - updatedAt) / 1000));
        setRerollTimeLeft(diffInSeconds);
      } else {
        setRerollTimeLeft(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentAdventure, profile]);

  if (adventureLoading || profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <TravisSignal status="thinking" size={80} />
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: theme.spacing.lg }} />
      </View>
    );
  }

  const handleStopReroll = async (stopId: string, category: string) => {
    if (!currentAdventure) return;

    showNotice({
      title: "SWAP THIS STOP",
      message: "Travis: 'All right, this one isn't doing it for you. I'll find something with a little more personality.'",
      type: 'warning',
      actions: [
        { text: "CANCEL", style: 'cancel', onPress: () => {} },
        { 
          text: "CONFIRM", 
          onPress: async () => {
            try {
              const firstStop = currentAdventure.itinerary_json[0];
              const coords = { lat: firstStop.lat, lng: firstStop.lng };
              const alternatives = await discoveryService.fetchRealStops(
                coords, 
                category, 
                '1_day', 
                currentAdventure.budget_level || 'mid'
              );
              const currentIds = currentAdventure.itinerary_json.map(s => s.place_id);
              const replacement = alternatives.find(s => !currentIds.includes(s.place_id)) || alternatives[0];
              if (replacement) await replaceItineraryStop(stopId, replacement);
            } catch (error) {
              console.error('Failed to reroll stop:', error);
            }
          }
        }
      ]
    });
  };

  const handleAbandon = async () => {
    if (!currentAdventure) return;

    showNotice({
      title: "ABANDON JOURNEY?",
      message: "Travis: 'Giving up already? Fine. I'll shred the itinerary, but don't expect me to be happy about it.'",
      type: 'error',
      actions: [
        { text: "STAY THE COURSE", style: 'cancel', onPress: () => {} },
        { 
          text: "ABANDON", 
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('adventures').delete().eq('id', currentAdventure.id);
              await refreshAdventure();
            } catch (error) {
              console.error('Failed to abandon journey:', error);
            }
          }
        }
      ]
    });
  };

  const adventureTitle = currentAdventure?.title?.toUpperCase() || 'EMPTY PAGES';
  const isDraft = currentAdventure?.status === 'draft';
  const isActive = currentAdventure?.status === 'active';
  const canReroll = rerollTimeLeft > 0;
  const showEmptyDesk =
    !currentAdventure ||
    currentAdventure.status === 'completed' ||
    currentAdventure.status === 'missed';

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
        <TravisSignal status={isActive ? 'tracking' : 'idle'} size={40} />
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
              onPress={() => navigation.navigate('AdventureRequest')}
            >
              <Text style={styles.emptyDeskButtonText}>Draft an itinerary</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.AdventureHeader}>
              <View style={styles.titleRow}>
                <Text style={styles.AdventureTitle}>{adventureTitle}</Text>
                {isDraft && (
                  <View style={styles.draftBadge}>
                    <Text style={styles.draftText}>DRAFT</Text>
                  </View>
                )}
              </View>
              <Text style={styles.AdventureSubtitle}>
                {isDraft ? "Awaiting your signature..." : "The open road awaits, Explorer."}
              </Text>
            </View>

            {isDraft && (
              <TouchableOpacity 
                style={styles.commitButton}
                onPress={() => navigation.navigate('AdventureReveal', { AdventureId: currentAdventure!.id })}
              >
                  <Text style={styles.commitButtonText}>REVIEW THE ITINERARY</Text>
              </TouchableOpacity>
            )}

            {currentAdventure && (
              <View style={styles.itinerarySection}>
                <View style={styles.itineraryHeader}>
                  <View>
                    <Text style={styles.itineraryTitle}>Itinerary</Text>
                    {canReroll && (
                      <Text style={styles.rerollTimer}>
                        Reroll window: {Math.floor(rerollTimeLeft / 60)}:{(rerollTimeLeft % 60).toString().padStart(2, '0')}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity><Text style={styles.viewAllText}>Map View</Text></TouchableOpacity>
                </View>

                {currentAdventure.itinerary_json.map((stop, index) => (
                  <InkBleedItem key={stop.place_id} delay={index * 200}>
                    <StopCard 
                      stop={stop}
                      onPress={() => navigation.navigate('LocationDetails', { locationId: stop.place_id })}
                      renderRightAction={() => canReroll ? (
                        <TouchableOpacity 
                          onPress={() => handleStopReroll(stop.place_id, stop.category)}
                          style={styles.rerollIconButton}
                        >
                          <Ionicons name="refresh-circle" size={28} color={theme.colors.primary} />
                        </TouchableOpacity>
                      ) : null}
                    />
                  </InkBleedItem>
                ))}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  loadingContainer: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, height: 60 },
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
  AdventureHeader: { marginBottom: theme.spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  AdventureTitle: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: 0.5, marginRight: 12 },
  draftBadge: { backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  draftText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  AdventureSubtitle: { color: theme.colors.textSecondary, fontSize: 16, fontWeight: '500', marginTop: 4 },
  commitButton: { backgroundColor: theme.colors.textPrimary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 32 },
  commitButtonText: { color: theme.colors.surface, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  itinerarySection: { marginTop: theme.spacing.md },
  itineraryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  itineraryTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '800' },
  rerollTimer: { color: theme.colors.primary, fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  viewAllText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  rerollIconButton: { padding: 4 },
});

export default HomeScreen;
