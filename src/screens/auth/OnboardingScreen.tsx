import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { useProfile } from '../../hooks/useProfile';
import { TravisSignal } from '../../components/TravisSignal';

const ONBOARDING_STEPS = [
  {
    id: 'location',
    title: 'Where\'s your base?',
    subtitle: 'Travis needs a starting point for your local adventures.',
    placeholder: 'Enter your city',
  },
  {
    id: 'transport',
    title: 'How do you move?',
    subtitle: 'Travis will calculate routes based on your preference.',
    options: [
      { id: 'driving', label: 'DRIVING', icon: '🚗' },
      { id: 'walking', label: 'WALKING', icon: '🚶' },
      { id: 'transit', label: 'TRANSIT', icon: '🚆' },
    ],
  },
  {
    id: 'tone',
    title: 'Travis\'s Personality',
    subtitle: 'How should Travis talk to you?',
    options: [
      { id: 'bold', label: 'BOLD', icon: '🔥' },
      { id: 'balanced', label: 'BALANCED', icon: '⚖️' },
      { id: 'chill', label: 'CHILL', icon: '🌊' },
    ],
  },
];

const OnboardingScreen = () => {
  const { profile, updateProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [homeCity, setHomeCity] = useState('');
  const [transportMode, setTransportMode] = useState('driving');
  const [travisTone, setTravisTone] = useState('balanced');
  const [loading, setLoading] = useState(false);

  const currentStep = ONBOARDING_STEPS[step];

  const handleNext = async () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      // Finalize onboarding
      setLoading(true);
      try {
        await updateProfile({
          home_city: homeCity,
          transport_mode: transportMode,
          travis_tone: travisTone,
        });
      } catch (e) {
        console.error('Onboarding failed:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TravisSignal status="thinking" size={80} />
        <View style={styles.progressContainer}>
          {ONBOARDING_STEPS.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.progressDot, 
                i <= step && styles.progressDotActive
              ]} 
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.subtitle}>{currentStep.subtitle}</Text>

        {currentStep.id === 'location' && (
          <TextInput
            style={styles.input}
            placeholder={currentStep.placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            value={homeCity}
            onChangeText={setHomeCity}
            autoFocus
          />
        )}

        {(currentStep.id === 'transport' || currentStep.id === 'tone') && (
          <View style={styles.optionsGrid}>
            {currentStep.options?.map((opt) => {
              const isSelected = currentStep.id === 'transport' 
                ? transportMode === opt.id 
                : travisTone === opt.id;
              
              const onPress = () => currentStep.id === 'transport'
                ? setTransportMode(opt.id)
                : setTravisTone(opt.id);

              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={onPress}
                >
                  <Text style={styles.optionIcon}>{opt.icon}</Text>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextButton, (!homeCity && step === 0) && styles.buttonDisabled]} 
          onPress={handleNext}
          disabled={loading || (!homeCity && step === 0)}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {step === ONBOARDING_STEPS.length - 1 ? 'READY FOR ADVENTURE' : 'NEXT STEP'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 8,
  },
  progressDot: {
    width: 24,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary,
  },
  content: {
    padding: theme.spacing.xl,
    paddingTop: 48,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginTop: 12,
    lineHeight: 24,
    marginBottom: 40,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 18,
  },
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  optionCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  optionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  optionLabelSelected: {
    color: theme.colors.primary,
  },
  footer: {
    padding: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
});

export default OnboardingScreen;
