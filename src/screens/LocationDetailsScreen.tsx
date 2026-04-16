import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { PlaceDetails, placesService } from '../services/places';
import { TravisSignal } from '../components/TravisSignal';
import { useAdventure } from '../hooks/useAdventure';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.45;

type Props = NativeStackScreenProps<RootStackParamList, 'LocationDetails'>;

const LocationDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { locationId } = route.params;
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNearby, setIsNearby] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const { currentAdventure, refreshAdventure } = useAdventure();

  useEffect(() => {
    fetchDetails();
  }, [locationId]);

  useEffect(() => {
    if (details) {
      checkProximity();
    }
  }, [details]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await placesService.getPlaceDetails(locationId);
      setDetails(data);
    } catch (err: any) {
      console.error('Error fetching details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkProximity = async () => {
    if (!details) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const userLoc = await Location.getCurrentPositionAsync({});
      
      const dist = getDistance(
        userLoc.coords.latitude, 
        userLoc.coords.longitude, 
        details.location.latitude, 
        details.location.longitude
      );

      setIsNearby(dist < 500); // 500 meters
    } catch (error) {
      console.error('Error checking proximity:', error);
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const handleCheckIn = async () => {
    if (!isNearby) {
      Alert.alert("NOT QUITE THERE", "Travis: 'Nice try. Get a little closer and then we'll count it.'");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      try {
        setCheckingIn(true);
        // Stamp would be saved to DB here (Phase 4.3)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        Alert.alert(
          "STAMP EARNED", 
          "Travis: 'Perfect. That one officially counts. Keep the streak alive.'"
        );
        
        navigation.navigate('MainTabs', { screen: 'Passport' });
      } catch (error) {
        console.error('Check-in failed:', error);
      } finally {
        setCheckingIn(false);
      }
    }
  };

  const openInMaps = () => {
    if (!details) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.formattedAddress)}&query_place_id=${details.id}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <TravisSignal status="thinking" size={80} />
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 24 }} />
        <Text style={styles.loadingText}>TRAVIS IS PULLING THE DOSSIER...</Text>
      </View>
    );
  }

  if (error || !details) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="warning" size={60} color={theme.colors.primary} />
        <Text style={styles.errorText}>DOSSIER MISSING</Text>
        <Text style={styles.errorSubtitle}>{error || "We couldn't retrieve the location details."}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDetails}>
          <Text style={styles.retryText}>RETRY</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mainPhoto = details.photos?.[0];

  return (
    <View style={styles.container}>
      {/* FIXED HERO IMAGE (Background) */}
      <View style={styles.heroSection}>
        {mainPhoto ? (
          <Image 
            source={{ uri: placesService.getPhotoUri(mainPhoto.name, 1200) }} 
            style={styles.heroImage} 
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroImage, styles.imagePlaceholder]}>
            <Ionicons name="map" size={80} color={theme.colors.lightGray} />
          </View>
        )}
        <View style={styles.imageOverlay} />
      </View>

      {/* FIXED HEADER BAR (Over image) */}
      <SafeAreaView style={styles.headerBar}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.goBack()}>
          <Ionicons name="menu" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Home</Text>
        <TouchableOpacity style={styles.profileButton}>
          <View style={styles.profilePlaceholder}>
            <Ionicons name="person" size={20} color={theme.colors.textPrimary} />
          </View>
        </TouchableOpacity>
      </SafeAreaView>

      {/* SCROLLABLE DESCRIPTION OVERLAY */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        style={styles.descriptionScroll}
      >
        <View style={styles.spacer} />
        
        <View style={styles.detailsContent}>
          {/* TITLE & RATING ROW */}
          <View style={styles.titleRatingRow}>
            <Text style={styles.title}>{details.displayName}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={16} color={theme.colors.primary} />
              <Text style={styles.ratingValue}>{details.rating ? details.rating.toFixed(1) : 'New'}</Text>
            </View>
          </View>

          {/* LOCATION ROW */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={theme.colors.primary} />
            <Text style={styles.address}>{details.formattedAddress}</Text>
          </View>

          <View style={styles.tabsRow}>
            <Text style={styles.activeTab}>Description</Text>
            <Text style={styles.inactiveTab}>Reviews</Text>
            <Text style={styles.inactiveTab}>Tips</Text>
          </View>

          <Text style={styles.summary}>
            {details.editorialSummary || "Travis thinks you should just experience this one yourself. No spoilers."}
          </Text>
<View style={styles.divider} />

<Text style={styles.sectionTitle}>TRAVIS'S BRIEFING</Text>
<Text style={styles.briefingText}>
  I picked this spot specifically for your {currentAdventure?.adventure_type || 'journey'}. 
  Don't waste time looking for other options—this is the one.
</Text>
</View>
</ScrollView>

{/* HEADER OVERLAY */}

      {/* FOOTER ACTIONS (Fixed at bottom) */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <View style={styles.proximityRow}>
          <Ionicons 
            name={isNearby ? "checkmark-circle" : "location-outline"} 
            size={14} 
            color={isNearby ? theme.colors.success : theme.colors.textSecondary} 
          />
          <Text style={[styles.proximityText, isNearby && { color: theme.colors.success }]}>
            {isNearby ? "YOU ARE ON TARGET" : "GET WITHIN 500M TO STAMP"}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.mainButton, styles.secondaryButton]} 
            onPress={openInMaps}
          >
            <Text style={styles.secondaryButtonText}>OPEN MAPS</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.mainButton, !isNearby && styles.buttonDisabled]} 
            activeOpacity={0.8} 
            onPress={handleCheckIn}
            disabled={checkingIn}
          >
            {checkingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>CHECK-IN & PHOTO</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: 140 },
  centerContainer: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 16 },
  errorText: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 20 },
  errorSubtitle: { color: theme.colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  retryButton: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, backgroundColor: theme.colors.primary },
  retryText: { color: '#FFFFFF', fontWeight: 'bold' },

  heroSection: { height: HERO_HEIGHT, width: '100%', position: 'absolute', top: 0, left: 0 },
  heroImage: { width: '100%', height: '100%' },
  imagePlaceholder: { backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  
  headerBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 40 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  menuButton: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  profileButton: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  profilePlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  descriptionScroll: { flex: 1 },
  spacer: { height: HERO_HEIGHT - 40 },
  detailsContent: { padding: 32, backgroundColor: theme.colors.background, borderTopLeftRadius: 40, borderTopRightRadius: 40, minHeight: height },
  
  titleRatingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: theme.colors.textPrimary, flex: 1, marginRight: 16 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingValue: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  address: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '700' },
  
  tabsRow: { flexDirection: 'row', gap: 24, marginBottom: 24, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 12 },
  activeTab: { color: theme.colors.primary, fontSize: 14, fontWeight: '900', borderBottomWidth: 2, borderBottomColor: theme.colors.primary, paddingBottom: 8 },
  inactiveTab: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700' },

  summary: { fontSize: 16, color: theme.colors.textPrimary, lineHeight: 26, fontWeight: '500' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 32 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: theme.colors.textSecondary, letterSpacing: 3, marginBottom: 16 },
  briefingText: { fontSize: 14, color: theme.colors.textPrimary, fontStyle: 'italic', lineHeight: 22, fontWeight: '600' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.background, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  proximityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  proximityText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: theme.colors.textSecondary, marginLeft: 8 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  mainButton: { flex: 2, backgroundColor: theme.colors.primary, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  secondaryButton: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: theme.colors.primary, elevation: 0 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  secondaryButtonText: { color: theme.colors.primary, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  buttonDisabled: { opacity: 0.5 },
});

export default LocationDetailsScreen;
