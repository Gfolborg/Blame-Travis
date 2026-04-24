import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { bookingService } from '../services/booking';
import { activitiesService } from '../services/activities';
import { exploreService } from '../services/explore';
import { useNotice } from './TravisNotice';
import { BookingIntentRecord, BookingOutcomeStatus } from '../types/booking';
import { theme } from '../theme';
import { isFeatureEnabled } from '../config/featureFlags';

const OUTCOME_OPTIONS: Array<{ value: BookingOutcomeStatus; label: string }> = [
  { value: 'booked', label: 'Booked' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'attended', label: 'Attended' },
  { value: 'no_show', label: 'No Show' },
];

const RETURN_PROMPT_MAX_HANDOFF_AGE_MS = 15 * 60 * 1000;

export const BookingOutcomeCoordinator: React.FC = () => {
  const bookingTrackingEnabled = isFeatureEnabled('booking_tracking_v1_enabled');
  const { showNotice } = useNotice();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<BookingIntentRecord | null>(null);
  const [activityTitle, setActivityTitle] = useState<string>('Activity');
  const [status, setStatus] = useState<BookingOutcomeStatus>('booked');
  const [providerConfirmationRef, setProviderConfirmationRef] = useState('');
  const [totalMinor, setTotalMinor] = useState('');
  const [currency, setCurrency] = useState('USD');

  const hydratePendingIntent = useCallback(async () => {
    if (!bookingTrackingEnabled) return;

    const intent = await bookingService.getPendingReturnIntent({
      maxHandoffAgeMs: RETURN_PROMPT_MAX_HANDOFF_AGE_MS,
    });
    if (!intent) return;

    setPendingIntent(intent);
    setStatus('booked');
    setProviderConfirmationRef('');
    setTotalMinor('');
    setCurrency('USD');
    setVisible(true);

    const details = await activitiesService.getActivityDetails(intent.activityId);
    setActivityTitle(details?.title || 'Activity');
  }, [bookingTrackingEnabled]);

  useEffect(() => {
    if (!bookingTrackingEnabled) return;

    void hydratePendingIntent();
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void hydratePendingIntent();
      }
    });
    return () => sub.remove();
  }, [bookingTrackingEnabled, hydratePendingIntent]);

  const closeModal = useCallback(async () => {
    setVisible(false);
    setPendingIntent(null);
    setActivityTitle('Activity');
  }, []);

  const handleLater = useCallback(async () => {
    setVisible(false);
    showNotice({
      title: 'BOOKING PENDING',
      message: "Travis: 'No problem. We will log the outcome when you are ready.'",
      type: 'info',
    });
  }, [showNotice]);

  const handleMarkAbandoned = useCallback(async () => {
    if (!pendingIntent) return;
    await bookingService.markIntentAbandoned(pendingIntent.id);
    exploreService.trackEvent({
      eventName: 'booking_outcome_failed',
      activityId: pendingIntent.activityId,
      metadata: {
        booking_intent_id: pendingIntent.id,
        error_code: 'abandoned_by_user',
        surface: pendingIntent.surface,
        mode: 'guest_local',
        auth_sync_required: true,
      },
    });
    await closeModal();
  }, [closeModal, pendingIntent]);

  const handleSubmit = useCallback(async () => {
    if (!pendingIntent) return;
    const normalizedCurrency = currency.trim().toUpperCase() || 'USD';
    const parsedTotalMinor = totalMinor.trim() ? Number(totalMinor.trim()) : null;
    if (parsedTotalMinor != null && Number.isNaN(parsedTotalMinor)) {
      showNotice({
        title: 'TOTAL FORMAT',
        message: 'Enter total in minor units (for example 1299 for $12.99).',
        type: 'warning',
      });
      return;
    }

    try {
      setSubmitting(true);
      await bookingService.recordBookingOutcome({
        bookingIntentId: pendingIntent.id,
        status,
        providerConfirmationRef: providerConfirmationRef.trim() || null,
        totalMinor: parsedTotalMinor,
        currency: normalizedCurrency,
        commissionPartnerId: null,
        commissionCampaignId: null,
        commissionRateBps: null,
        commissionExpectedMinor: null,
      });

      exploreService.trackEvent({
        eventName: 'booking_outcome_recorded',
        activityId: pendingIntent.activityId,
        metadata: {
          booking_intent_id: pendingIntent.id,
          outcome_status: status,
          total_minor: parsedTotalMinor,
          currency: normalizedCurrency,
          provider: pendingIntent.provider,
          surface: pendingIntent.surface,
          mode: 'guest_local',
          auth_sync_required: true,
          commission_partner_id: pendingIntent.commissionPartnerId,
          commission_campaign_id: pendingIntent.commissionCampaignId,
          commission_rate_bps: pendingIntent.commissionRateBps,
          commission_expected_minor: pendingIntent.commissionExpectedMinor,
        },
      });

      AccessibilityInfo.announceForAccessibility('Booking outcome saved');
      showNotice({
        title: 'BOOKING UPDATED',
        message: "Travis: 'Perfect. The booking record is updated in your route log.'",
        type: 'success',
      });
      await closeModal();
    } catch (error: any) {
      exploreService.trackEvent({
        eventName: 'booking_outcome_failed',
        activityId: pendingIntent.activityId,
        metadata: {
          booking_intent_id: pendingIntent.id,
          error_code: error?.message || 'outcome_save_failed',
          surface: pendingIntent.surface,
          mode: 'guest_local',
          auth_sync_required: true,
        },
      });
      showNotice({
        title: 'OUTCOME FAILED',
        message: 'Could not save booking outcome right now. Try again.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [closeModal, currency, pendingIntent, providerConfirmationRef, showNotice, status, totalMinor]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="receipt-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.title}>Record Booking Outcome</Text>
          </View>
          <Text style={styles.subtitle}>
            {activityTitle} | {pendingIntent?.provider?.toUpperCase() || 'PROVIDER'}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            {OUTCOME_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionPill, status === option.value && styles.optionPillActive]}
                onPress={() => setStatus(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: status === option.value }}
                accessibilityLabel={`Outcome ${option.label}`}
              >
                <Text style={[styles.optionText, status === option.value && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.input}
            placeholder="Provider confirmation ref (optional)"
            placeholderTextColor={theme.colors.textSecondary}
            value={providerConfirmationRef}
            onChangeText={setProviderConfirmationRef}
          />
          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.input, styles.inlineInput]}
              placeholder="Total minor (optional)"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="numeric"
              value={totalMinor}
              onChangeText={setTotalMinor}
            />
            <TextInput
              style={[styles.input, styles.inlineInputSmall]}
              placeholder="Currency"
              placeholderTextColor={theme.colors.textSecondary}
              value={currency}
              onChangeText={setCurrency}
              maxLength={6}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleLater} disabled={submitting}>
              <Text style={styles.secondaryText}>Later</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.warnButton} onPress={handleMarkAbandoned} disabled={submitting}>
              <Text style={styles.warnText}>Mark Abandoned</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
              <Text style={styles.primaryText}>{submitting ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionRow: {
    gap: 8,
    paddingBottom: 8,
  },
  optionPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionPillActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(183, 28, 28, 0.08)',
  },
  optionText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
  },
  optionTextActive: {
    color: theme.colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    marginTop: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
  },
  inlineInputSmall: {
    width: 110,
  },
  buttonRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  secondaryText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
  },
  warnButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183, 28, 28, 0.06)',
  },
  warnText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
  },
});
