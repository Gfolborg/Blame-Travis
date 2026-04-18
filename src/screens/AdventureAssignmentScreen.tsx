import React, { useCallback, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { TravisSignal } from '../components/TravisSignal';
import { supabase } from '../services/supabase';
import { Adventure } from '../types/adventure';
import { useAdventure } from '../hooks/useAdventure';
import { useNotice } from '../components/TravisNotice';

type Props = NativeStackScreenProps<RootStackParamList, 'AdventureAssignment'>;

const AdventureAssignmentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { AdventureId, initialAdventure } = route.params;
  const [adventure, setAdventure] = useState<Adventure | null>(initialAdventure || null);
  const [dataLoading, setDataLoading] = useState(!initialAdventure);
  const [imageReady, setImageReady] = useState(false);
  const { refreshAdventure } = useAdventure();
  const { showNotice } = useNotice();

  const fetchAdventure = useCallback(async (): Promise<Adventure | null> => {
    try {
      const { data, error } = await supabase
        .from('adventures')
        .select('*')
        .eq('id', AdventureId)
        .single();

      if (error) throw error;
      const nextAdventure = data as unknown as Adventure;
      setAdventure(nextAdventure);
      return nextAdventure;
    } catch (error) {
      console.error('Error fetching assignment:', error);
      return null;
    } finally {
      setDataLoading(false);
    }
  }, [AdventureId]);

  useEffect(() => {
    if (!adventure) {
      fetchAdventure();
    }
  }, [adventure, fetchAdventure]);

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const pollForHeroImage = async () => {
      if (isCancelled || adventure?.hero_image_url) {
        return;
      }

      try {
        const updatedAdventure = await fetchAdventure();
        if (isCancelled || updatedAdventure?.hero_image_url) {
          return;
        }

        attempts += 1;
        if (attempts < 10) {
          timeoutId = setTimeout(pollForHeroImage, 3000);
        }
      } catch (error) {
        console.error('Error polling for hero image:', error);
      }
    };

    if (adventure && !adventure.hero_image_url) {
      timeoutId = setTimeout(pollForHeroImage, 1500);
    }

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [adventure, fetchAdventure]);

  const handleScrap = () => {
    showNotice({
      title: "SCRAP THIS PLAN?",
      message: "Travis: 'Not feeling this one? I can toss it in the shredder and we can start over.'",
      type: 'warning',
      actions: [
        { text: "KEEP IT", style: 'cancel', onPress: () => {} },
        { 
          text: "SCRAP", 
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('adventures').delete().eq('id', AdventureId);
              await refreshAdventure();
              navigation.navigate('MainTabs', { screen: 'Home' });
            } catch (error) {
              console.error('Failed to scrap plan:', error);
            }
          }
        }
      ]
    });
  };

  const hasLoadedAdventure = !dataLoading && !!adventure;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* BACKGROUND IMAGE - Always rendering in background, but hidden until ready */}
      {adventure?.hero_image_url ? (
        <Image 
          source={{ uri: adventure.hero_image_url }} 
          style={[styles.backgroundImage, !imageReady && { opacity: 0 }]}
          resizeMode="cover"
          onLoad={() => setImageReady(true)}
        />
      ) : (
        /* FALLBACK: Show map texture or dark color while Travis paints */
        <Image 
          source={require('../../assets/textures/map-texture.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
          blurRadius={10}
        />
      )}
      
      {!hasLoadedAdventure ? (
        <View style={styles.loadingContainer}>
          <TravisSignal status="thinking" size={120} />
          <Text style={styles.loadingText}>DEVELOPING THE ITINERARY...</Text>
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        </View>
      ) : (
        <>
          <View style={[styles.imageOverlay, !imageReady && styles.imageOverlayFallback]} />
          <SafeAreaView style={styles.safeArea}>
            {/* TOP MENU */}
            <View style={styles.header}>
               <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.signalBadge}>
                <TravisSignal status="tracking" size={30} />
              </View>
            </View>

            {/* BOTTOM CONTENT OVERLAY */}
            <View style={styles.bottomContent}>
              <View style={styles.glassCard}>
                <Text style={styles.title}>{adventure?.title}</Text>
                <Text style={styles.description}>{adventure?.why_travis_picked_this}</Text>

                <View style={styles.footerActions}>
                  <TouchableOpacity 
                    style={styles.button}
                    onPress={() => navigation.replace('AdventureReveal', { AdventureId: adventure?.id || '' })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.buttonText}>Let's Go!</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.scrapLink} onPress={handleScrap}>
                    <Text style={styles.scrapText}>SCRAP THIS PLAN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingText: {
    marginTop: 20,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  imageOverlayFallback: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 6,
    elevation: 5,
  },
  bottomContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 40,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    lineHeight: 38,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 32,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 60,
    paddingHorizontal: 32,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  scrapLink: {
    paddingVertical: 10,
  },
  scrapText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
});

export default AdventureAssignmentScreen;
