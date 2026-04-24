import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { theme } from '../../theme';
import { supabase } from '../../services/supabase';
import { TravisSignal } from '../../components/TravisSignal';
import { useNotice } from '../../components/TravisNotice';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

const SignUpScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { showNotice } = useNotice();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fullNameTrimmed = fullName.trim();
  const emailTrimmed = email.trim();
  const passwordTrimmed = password.trim();
  const canSubmit = useMemo(
    () => !loading && Boolean(fullNameTrimmed) && Boolean(emailTrimmed) && Boolean(passwordTrimmed),
    [emailTrimmed, fullNameTrimmed, loading, passwordTrimmed],
  );

  const handleSignUp = async () => {
    if (!fullNameTrimmed || !emailTrimmed || !passwordTrimmed) {
      showNotice({
        title: 'MISSING INFO',
        message: "Travis: 'I need your name, email, and passphrase before we hit the open road.'",
        type: 'warning',
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password: passwordTrimmed,
        options: {
          data: {
            full_name: fullNameTrimmed,
          },
        },
      });

      if (error) {
        showNotice({
          title: 'SIGN UP FAILED',
          message: error.message,
          type: 'error',
        });
        return;
      }

      showNotice({
        title: 'ACCOUNT CREATED',
        message: "Travis: 'Profile stamped. Check your inbox for next steps if confirmation is enabled.'",
        type: 'success',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TravisSignal status="tracking" size={100} />
            <Text style={styles.title}>Join the Expedition</Text>
            <Text style={styles.subtitle}>Travis is ready to plan. Give him your details and let us get moving.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Indiana Jones"
                placeholderTextColor={theme.colors.textSecondary}
                value={fullName}
                onChangeText={setFullName}
                accessibilityLabel="Full name"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="you@adventure.com"
                placeholderTextColor={theme.colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PASSPHRASE</Text>
              <TextInput
                style={styles.input}
                placeholder="********"
                placeholderTextColor={theme.colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                accessibilityLabel="Passphrase"
              />
            </View>

            <TouchableOpacity
              style={[styles.signUpButton, !canSubmit && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Start my journey"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>START MY JOURNEY</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
              accessibilityLabel="Log in instead"
            >
              <Text style={styles.linkText}>
                ALREADY ON THE ROAD? <Text style={styles.linkHighlight}>LOG IN</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  signUpButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  linkHighlight: {
    color: theme.colors.primary,
    fontWeight: '900',
  },
});

export default SignUpScreen;
