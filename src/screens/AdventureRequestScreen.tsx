import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { TravisSignal } from '../components/TravisSignal';
import { discoveryService } from '../services/discovery';
import { supabase } from '../services/supabase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AdventureRequest'>;

const DURATIONS = [
  { id: '1_day', label: '1 DAY', icon: '🏙️' },
  { id: 'weekend', label: 'WEEKEND', icon: '⛺' },
  { id: 'vacation', label: '1+ WEEKS', icon: '✈️' },
];

const LOCATIONS = [
  { id: 'current', label: 'CURRENT', icon: '📍' },
  { id: 'specific', label: 'SPECIFIC CITY', icon: '🔍' },
  { id: 'brave', label: 'BRAVE MODE', icon: '🏹' },
  { id: 'worldwide', label: 'WORLDWIDE', icon: '🌍' },
  { id: 'surprise', label: 'SURPRISE ME', icon: '🎲' },
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
  const [duration, setDuration] = useState('1_day');
  const [locationMode, setLocationMode] = useState('current');
  const [city, setCity] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>(['food']);
  const [budget, setBudget] = useState('mid');
  const [isCalculating, setIsCalculating] = useState(false);

  const fetchSuggestions = async (input: string) => {
    setCity(input);
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

  const selectSuggestion = (suggestion: any) => {
    const text = suggestion.placePrediction?.text?.text || '';
    setCity(text);
    setSuggestions([]);
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
      const location = locationMode === 'specific' ? city : locationMode;
      
      const adventure = await discoveryService.generateAdventure({
        location,
        duration,
        vibe: selectedVibes.join(','),
        budget,
        date: new Date(),
      });

      navigation.navigate('AdventureAssignment', { AdventureId: adventure.id });
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
        <Text style={styles.calculatingTitle}>TRAVIS IS PUTTING THIS TOGETHER...</Text>
        <Text style={styles.calculatingSubtitle}>Give him a second. He's finding something better than your usual routine.</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <SafeAreaHeader navigation={navigation} />

        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Draft Your Journey</Text>

          {/* Step 1: Duration */}
          <Text style={styles.sectionTitle}>How long are we out for?</Text>
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

          {/* Step 2: Location */}
          <Text style={styles.sectionTitle}>Where are we headed?</Text>
          <View style={styles.optionsGrid}>
            {LOCATIONS.map((opt) => (
              <OptionCard 
                key={opt.id}
                item={opt}
                isSelected={locationMode === opt.id}
                onPress={() => setLocationMode(opt.id)}
              />
            ))}
          </View>


          {locationMode === 'specific' && (
            <View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Search City (e.g., Manila, Philippines)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={city}
                  onChangeText={fetchSuggestions}
                  autoFocus
                />
              </View>
              
              {suggestions.length > 0 && (
                <View style={styles.suggestionsList}>
                  {suggestions.map((s, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={styles.suggestionItem}
                      onPress={() => selectSuggestion(s)}
                    >
                      <Ionicons name="location-sharp" size={16} color={theme.colors.primary} />
                      <Text style={styles.suggestionText}>{s.placePrediction?.text?.text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Step 3: Budget Slider */}
          <Text style={styles.sectionTitle}>What's the damage? (Budget)</Text>
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

          {/* Step 4: Vibes */}
          <Text style={styles.sectionTitle}>What's the vibe? (Pick multiple)</Text>
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
    </KeyboardAvoidingView>
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
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    letterSpacing: 0.5,
  },
  cardLabelSelected: {
    color: theme.colors.primary,
  },
  inputContainer: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    color: theme.colors.textPrimary,
    height: 50,
    fontSize: 16,
  },
  suggestionsList: {
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  budgetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
});

export default AdventureRequestScreen;
