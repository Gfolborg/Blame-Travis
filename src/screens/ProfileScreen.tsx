import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { useNotice } from '../components/TravisNotice';
import { useProfile } from '../hooks/useProfile';
import { theme } from '../theme';

const ProfileScreen = () => {
  const { profile, updateProfile, loading } = useProfile();
  const { showNotice } = useNotice();
  const [saving, setSaving] = useState(false);

  const notificationsEnabled = profile?.notifications_enabled ?? true;

  const handleToggle = async (nextValue: boolean) => {
    try {
      setSaving(true);
      await updateProfile({ notifications_enabled: nextValue });
      showNotice({
        title: nextValue ? 'TRAVIS: GOOD' : 'TRAVIS: QUIET MODE',
        message: nextValue
          ? 'I’ll handle the timing from here.'
          : 'All right. I’ll keep the nudges to myself until you turn them back on.',
        type: nextValue ? 'success' : 'info',
        duration: 3500,
      });
    } catch (error: any) {
      showNotice({
        title: 'TRAVIS: THAT DIDN’T STICK',
        message: error?.message ?? 'The setting did not update. Give me another second.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.authRequiredContainer}>
        <Text style={styles.title}>PROFILE</Text>
        <Text style={styles.authRequiredTitle}>Guest Testing Mode</Text>
        <Text style={styles.authRequiredSubtitle}>
          Auth is disabled for QA right now. Local test data is active on this device.
        </Text>
        <TouchableOpacity style={styles.primaryButton} disabled>
          <Text style={styles.primaryButtonText}>Auth Deferred</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PROFILE</Text>
      <Text style={styles.subtitle}>Manage your Adventure boundaries and settings.</Text>

      <View style={styles.settingCard}>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>Travis nudges</Text>
          <Text style={styles.settingBody}>
            Keep the reminder system on so Travis can handle the timing for draft drops, itinerary days, and the quiet stretches in between.
          </Text>
        </View>

        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggle}
          disabled={saving}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {saving && <ActivityIndicator size="small" color={theme.colors.primary} style={styles.inlineLoader} />}

      <Text style={styles.footnote}>
        Quiet hours stay fixed between 9 PM and 8 AM local time.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xxl,
    fontWeight: 'bold',
    marginTop: theme.spacing.xl,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  settingCard: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    marginBottom: 6,
  },
  settingBody: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 20,
  },
  inlineLoader: {
    marginTop: theme.spacing.md,
  },
  footnote: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.lg,
    lineHeight: 20,
  },
  authRequiredContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  authRequiredTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    marginTop: theme.spacing.lg,
  },
  authRequiredSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
    lineHeight: 22,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
  },
});

export default ProfileScreen;
