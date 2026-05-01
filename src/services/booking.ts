import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

import { supabase } from './supabase';
import { exploreService } from './explore';
import {
  BookingIntentRecord,
  BookingOutcomeRecord,
  BookingStateSummary,
  RecordBookingOutcomeInput,
  StartBookingIntentInput,
} from '../types/booking';

type BookingStore = {
  version: number;
  savedAt: string;
  pendingIntentId: string | null;
  lastHandoffAt: string | null;
  intents: BookingIntentRecord[];
  outcomes: BookingOutcomeRecord[];
};

type PendingIntentOptions = {
  maxHandoffAgeMs?: number;
};

const BOOKING_STORE_KEY = 'booking.guest_funnel.v1';
const BOOKING_STORE_VERSION = 1;
const GUEST_USER_ID = 'guest-local';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const normalizeProviderId = (value: string) => (value.startsWith('provider:') ? value.replace('provider:', '') : value);

const defaultStore = (): BookingStore => ({
  version: BOOKING_STORE_VERSION,
  savedAt: new Date().toISOString(),
  pendingIntentId: null,
  lastHandoffAt: null,
  intents: [],
  outcomes: [],
});

const parseIsoTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const readStore = async (): Promise<BookingStore> => {
  try {
    const raw = await AsyncStorage.getItem(BOOKING_STORE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as BookingStore;
    if (
      parsed.version !== BOOKING_STORE_VERSION ||
      !Array.isArray(parsed.intents) ||
      !Array.isArray(parsed.outcomes)
    ) {
      return defaultStore();
    }
    return parsed;
  } catch {
    return defaultStore();
  }
};

const writeStore = async (next: BookingStore) => {
  await AsyncStorage.setItem(
    BOOKING_STORE_KEY,
    JSON.stringify({
      ...next,
      version: BOOKING_STORE_VERSION,
      savedAt: new Date().toISOString(),
    }),
  );
};

const mutateStore = async <T>(mutator: (_state: BookingStore) => T): Promise<T> => {
  const current = await readStore();
  const result = mutator(current);
  await writeStore(current);
  return result;
};

const getAuthedUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    const message = error.message ?? '';
    if (message.includes('Invalid Refresh Token') || message.includes('Already Used')) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    return null;
  }
  return data.session?.user.id || null;
};

const buildStatusSummary = (
  intent: BookingIntentRecord | null,
  outcome: BookingOutcomeRecord | null,
): BookingStateSummary => {
  if (outcome) {
    if (outcome.status === 'booked') return { intent, outcome, statusLabel: 'Booked', statusTone: 'success' };
    if (outcome.status === 'attended') return { intent, outcome, statusLabel: 'Attended', statusTone: 'success' };
    if (outcome.status === 'cancelled') return { intent, outcome, statusLabel: 'Cancelled', statusTone: 'warning' };
    if (outcome.status === 'refunded') return { intent, outcome, statusLabel: 'Refunded', statusTone: 'warning' };
    if (outcome.status === 'no_show') return { intent, outcome, statusLabel: 'No Show', statusTone: 'warning' };
  }

  if (!intent) return { intent: null, outcome: null, statusLabel: 'Not Started', statusTone: 'neutral' };
  if (intent.status === 'initiated') return { intent, outcome, statusLabel: 'Started', statusTone: 'neutral' };
  if (intent.status === 'provider_redirected') {
    return { intent, outcome, statusLabel: 'Redirected', statusTone: 'neutral' };
  }
  if (intent.status === 'abandoned') return { intent, outcome, statusLabel: 'Abandoned', statusTone: 'warning' };
  if (intent.status === 'confirmed') return { intent, outcome, statusLabel: 'Confirmed', statusTone: 'success' };
  return { intent, outcome, statusLabel: 'Failed', statusTone: 'error' };
};

const matchesIntentTarget = (
  intent: BookingIntentRecord,
  params: { activityId?: string | null; itineraryItemId?: string | null },
): boolean => {
  const targetActivityId = params.activityId ? normalizeProviderId(params.activityId) : null;
  const intentActivityId = normalizeProviderId(intent.activityId);

  if (params.itineraryItemId && intent.itineraryItemId === params.itineraryItemId) return true;
  if (targetActivityId && (intentActivityId === targetActivityId || intent.activityId === params.activityId)) return true;
  return false;
};

const getLatestIntentForTarget = (
  intents: BookingIntentRecord[],
  params: { activityId?: string | null; itineraryItemId?: string | null },
): BookingIntentRecord | null => {
  const matched = intents
    .filter(intent => matchesIntentTarget(intent, params))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return matched[0] || null;
};

const getOutcomeForIntent = (outcomes: BookingOutcomeRecord[], intentId: string): BookingOutcomeRecord | null =>
  outcomes.find(outcome => outcome.bookingIntentId === intentId) || null;

const buildIntentTelemetryMetadata = (
  intent: BookingIntentRecord,
  extra?: Record<string, unknown>,
): Record<string, unknown> => ({
  booking_intent_id: intent.id,
  provider: intent.provider,
  provider_url_present: Boolean(intent.providerUrl),
  surface: intent.surface,
  itinerary_id: intent.itineraryId,
  itinerary_item_id: intent.itineraryItemId,
  mode: intent.userId === GUEST_USER_ID ? 'guest_local' : 'authenticated',
  auth_sync_required: intent.authSyncRequired,
  commission_partner_id: intent.commissionPartnerId,
  commission_campaign_id: intent.commissionCampaignId,
  commission_rate_bps: intent.commissionRateBps,
  commission_expected_minor: intent.commissionExpectedMinor,
  affiliate_partner_id: intent.partnerId ?? null,
  affiliate_offer_id: intent.offerId ?? null,
  affiliate_placement_key: intent.placementKey ?? null,
  affiliate_copy_variant: intent.copyVariant ?? null,
  affiliate_disclosure_wording: intent.disclosureWording ?? null,
  ...extra,
});

const emitBookingIntentStartedEvent = async (intent: BookingIntentRecord) => {
  await exploreService.trackEvent({
    eventName: 'booking_intent_started',
    activityId: intent.activityId,
    metadata: buildIntentTelemetryMetadata(intent),
  });
};

const emitBookingProviderOpenedEvent = async (intent: BookingIntentRecord) => {
  await exploreService.trackEvent({
    eventName: 'booking_provider_opened',
    activityId: intent.activityId,
    metadata: buildIntentTelemetryMetadata(intent),
  });
};

const emitBookingFailureEvent = async (intent: BookingIntentRecord, reason: string) => {
  await exploreService.trackEvent({
    eventName: 'booking_outcome_failed',
    activityId: intent.activityId,
    metadata: buildIntentTelemetryMetadata(intent, {
      error_code: reason,
    }),
  });
};

const resolveDbActivityId = async (activityId: string): Promise<string | null> => {
  if (!activityId) return null;
  if (isUuid(activityId)) return activityId;

  const canonicalKey = normalizeProviderId(activityId);
  const { data } = await supabase.from('activities').select('id').eq('canonical_key', canonicalKey).single();
  return data?.id || null;
};

export const bookingService = {
  async startBookingIntent(input: StartBookingIntentInput): Promise<BookingIntentRecord> {
    const authedUserId = await getAuthedUserId();
    const now = new Date().toISOString();
    const localId = `guest-intent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const remoteActivityId = await resolveDbActivityId(input.activityId);

    let remoteIntentId: string | null = null;
    if (authedUserId && remoteActivityId) {
      const { data } = await supabase
        .from('booking_intents')
        .insert({
          user_id: authedUserId,
          activity_id: remoteActivityId,
          itinerary_id: input.itineraryId || null,
          itinerary_item_id: input.itineraryItemId || null,
          provider: input.provider,
          provider_url: input.providerUrl || null,
          status: 'initiated',
        })
        .select('id')
        .single();
      remoteIntentId = data?.id || null;
    }

    const intent: BookingIntentRecord = {
      id: remoteIntentId || localId,
      userId: authedUserId || GUEST_USER_ID,
      activityId: input.activityId,
      itineraryId: input.itineraryId || null,
      itineraryItemId: input.itineraryItemId || null,
      provider: input.provider,
      providerUrl: input.providerUrl || null,
      surface: input.surface,
      status: 'initiated',
      startedAt: now,
      lastTransitionAt: now,
      failureReason: null,
      authSyncRequired: true,
      syncState: 'pending_auth',
      commissionPartnerId: input.commissionPartnerId || null,
      commissionCampaignId: input.commissionCampaignId || null,
      commissionRateBps: input.commissionRateBps ?? null,
      commissionExpectedMinor: input.commissionExpectedMinor ?? null,
      partnerId: input.partnerId ?? null,
      offerId: input.offerId ?? null,
      placementKey: input.placementKey ?? null,
      copyVariant: input.copyVariant ?? null,
      disclosureWording: input.disclosureWording ?? null,
    };

    await mutateStore(state => {
      state.intents = [intent, ...state.intents.filter(existing => existing.id !== intent.id)];
      state.pendingIntentId = null;
      state.lastHandoffAt = null;
      return intent;
    });

    await emitBookingIntentStartedEvent(intent);

    return intent;
  },

  async openProviderHandoff(intentId: string, providerUrl?: string | null): Promise<boolean> {
    const state = await readStore();
    const intent = state.intents.find(row => row.id === intentId);
    if (!intent) return false;

    const targetUrl = (providerUrl || intent.providerUrl || '').trim();
    if (!targetUrl) {
      await this.markIntentFailed(intentId, 'missing_provider_url');
      await emitBookingFailureEvent(intent, 'missing_provider_url');
      return false;
    }

    const canOpen = await Linking.canOpenURL(targetUrl).catch(() => false);
    if (!canOpen) {
      await this.markIntentFailed(intentId, 'provider_url_not_supported');
      await emitBookingFailureEvent(intent, 'provider_url_not_supported');
      return false;
    }

    await mutateStore(current => {
      const idx = current.intents.findIndex(row => row.id === intentId);
      if (idx >= 0) {
        current.intents[idx] = {
          ...current.intents[idx],
          providerUrl: targetUrl,
          status: 'provider_redirected',
          failureReason: null,
          lastTransitionAt: new Date().toISOString(),
        };
      }
      current.pendingIntentId = intentId;
      current.lastHandoffAt = new Date().toISOString();
      return true;
    });

    const refreshedState = await readStore();
    const refreshedIntent = refreshedState.intents.find(row => row.id === intentId) || intent;

    try {
      await Linking.openURL(targetUrl);
      await emitBookingProviderOpenedEvent(refreshedIntent);
      return true;
    } catch {
      await this.markIntentFailed(intentId, 'provider_open_failed');
      await emitBookingFailureEvent(refreshedIntent, 'provider_open_failed');
      return false;
    }
  },

  async markIntentFailed(intentId: string, reason: string) {
    await mutateStore(state => {
      const idx = state.intents.findIndex(row => row.id === intentId);
      if (idx >= 0) {
        state.intents[idx] = {
          ...state.intents[idx],
          status: 'failed',
          failureReason: reason,
          lastTransitionAt: new Date().toISOString(),
        };
      }
      if (state.pendingIntentId === intentId) state.pendingIntentId = null;
      return true;
    });
  },

  async markIntentAbandoned(intentId: string, reason = 'user_marked_abandoned') {
    await mutateStore(state => {
      const idx = state.intents.findIndex(row => row.id === intentId);
      if (idx >= 0) {
        state.intents[idx] = {
          ...state.intents[idx],
          status: 'abandoned',
          failureReason: reason,
          lastTransitionAt: new Date().toISOString(),
        };
      }
      if (state.pendingIntentId === intentId) state.pendingIntentId = null;
      return true;
    });
  },

  async recordBookingOutcome(input: RecordBookingOutcomeInput): Promise<BookingOutcomeRecord | null> {
    const authedUserId = await getAuthedUserId();
    const state = await readStore();
    const intent = state.intents.find(row => row.id === input.bookingIntentId);
    if (!intent) return null;

    const now = new Date().toISOString();
    const existing = state.outcomes.find(row => row.bookingIntentId === input.bookingIntentId);
    const outcome: BookingOutcomeRecord = {
      id: existing?.id || `guest-outcome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bookingIntentId: input.bookingIntentId,
      userId: authedUserId || intent.userId || GUEST_USER_ID,
      status: input.status,
      providerConfirmationRef: input.providerConfirmationRef || null,
      bookedForStartAt: input.bookedForStartAt || null,
      totalMinor: input.totalMinor ?? null,
      currency: input.currency || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      authSyncRequired: true,
      syncState: 'pending_auth',
      commissionPartnerId: input.commissionPartnerId ?? intent.commissionPartnerId ?? null,
      commissionCampaignId: input.commissionCampaignId ?? intent.commissionCampaignId ?? null,
      commissionRateBps: input.commissionRateBps ?? intent.commissionRateBps ?? null,
      commissionExpectedMinor: input.commissionExpectedMinor ?? intent.commissionExpectedMinor ?? null,
      partnerId: input.partnerId ?? intent.partnerId ?? null,
      offerId: input.offerId ?? intent.offerId ?? null,
      placementKey: input.placementKey ?? intent.placementKey ?? null,
      copyVariant: input.copyVariant ?? intent.copyVariant ?? null,
      disclosureWording: input.disclosureWording ?? intent.disclosureWording ?? null,
    };

    await mutateStore(current => {
      current.outcomes = [outcome, ...current.outcomes.filter(row => row.bookingIntentId !== input.bookingIntentId)];
      const intentIndex = current.intents.findIndex(row => row.id === input.bookingIntentId);
      if (intentIndex >= 0) {
        current.intents[intentIndex] = {
          ...current.intents[intentIndex],
          status: 'confirmed',
          failureReason: null,
          lastTransitionAt: now,
        };
      }
      if (current.pendingIntentId === input.bookingIntentId) current.pendingIntentId = null;
      return true;
    });

    if (authedUserId && isUuid(input.bookingIntentId)) {
      await supabase.from('booking_outcomes').upsert(
        {
          booking_intent_id: input.bookingIntentId,
          user_id: authedUserId,
          status: input.status,
          provider_confirmation_ref: input.providerConfirmationRef || null,
          booked_for_start_at: input.bookedForStartAt || null,
          total_minor: input.totalMinor ?? null,
          currency: input.currency || null,
        },
        { onConflict: 'booking_intent_id' },
      );
    }

    return outcome;
  },

  async getPendingReturnIntent(options?: PendingIntentOptions): Promise<BookingIntentRecord | null> {
    const state = await readStore();
    if (!state.pendingIntentId) return null;
    const intent = state.intents.find(row => row.id === state.pendingIntentId) || null;
    if (!intent) {
      await this.clearPendingReturnIntent();
      return null;
    }

    const maxHandoffAgeMs = options?.maxHandoffAgeMs;
    if (typeof maxHandoffAgeMs === 'number' && maxHandoffAgeMs > 0) {
      const handoffMs = parseIsoTimestamp(state.lastHandoffAt);
      const handoffAgeMs = handoffMs == null ? Number.POSITIVE_INFINITY : Date.now() - handoffMs;
      if (!Number.isFinite(handoffAgeMs) || handoffAgeMs > maxHandoffAgeMs) {
        await this.clearPendingReturnIntent(intent.id);
        return null;
      }
    }

    const outcome = getOutcomeForIntent(state.outcomes, intent.id);
    if (outcome) {
      await this.clearPendingReturnIntent(intent.id);
      return null;
    }
    return intent;
  },

  async clearPendingReturnIntent(intentId?: string) {
    await mutateStore(state => {
      if (!intentId || state.pendingIntentId === intentId) {
        state.pendingIntentId = null;
      }
      return true;
    });
  },

  async getBookingStateByActivity(activityId: string): Promise<BookingStateSummary> {
    const state = await readStore();
    const intent = getLatestIntentForTarget(state.intents, { activityId });
    const outcome = intent ? getOutcomeForIntent(state.outcomes, intent.id) : null;
    return buildStatusSummary(intent, outcome);
  },

  async getBookingStateByItineraryItem(itineraryItemId: string, activityId?: string | null): Promise<BookingStateSummary> {
    const state = await readStore();
    const intent = getLatestIntentForTarget(state.intents, { itineraryItemId, activityId: activityId || null });
    const outcome = intent ? getOutcomeForIntent(state.outcomes, intent.id) : null;
    return buildStatusSummary(intent, outcome);
  },

  async getBookingStateMapForItineraryItems(
    items: Array<{ itineraryItemId: string; activityId: string }>,
  ): Promise<Record<string, BookingStateSummary>> {
    const state = await readStore();
    const map: Record<string, BookingStateSummary> = {};
    for (const item of items) {
      const intent = getLatestIntentForTarget(state.intents, {
        itineraryItemId: item.itineraryItemId,
        activityId: item.activityId,
      });
      const outcome = intent ? getOutcomeForIntent(state.outcomes, intent.id) : null;
      map[item.itineraryItemId] = buildStatusSummary(intent, outcome);
    }
    return map;
  },
};
