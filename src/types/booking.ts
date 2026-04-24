import { Enums } from './database';

export type BookingIntentStatus = Enums<'booking_intent_status'>;
export type BookingOutcomeStatus = Enums<'booking_outcome_status'>;
export type BookingSurface = 'details' | 'journeys';

export interface BookingCommissionAttribution {
  commissionPartnerId: string | null;
  commissionCampaignId: string | null;
  commissionRateBps: number | null;
  commissionExpectedMinor: number | null;
}

export interface BookingIntentRecord extends BookingCommissionAttribution {
  id: string;
  userId: string;
  activityId: string;
  itineraryId: string | null;
  itineraryItemId: string | null;
  provider: Enums<'activity_source'>;
  providerUrl: string | null;
  surface: BookingSurface;
  status: BookingIntentStatus;
  startedAt: string;
  lastTransitionAt: string;
  failureReason: string | null;
  authSyncRequired: boolean;
  syncState: 'pending_auth' | 'synced' | 'failed';
}

export interface BookingOutcomeRecord extends BookingCommissionAttribution {
  id: string;
  bookingIntentId: string;
  userId: string;
  status: BookingOutcomeStatus;
  providerConfirmationRef: string | null;
  bookedForStartAt: string | null;
  totalMinor: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  authSyncRequired: boolean;
  syncState: 'pending_auth' | 'synced' | 'failed';
}

export interface BookingStateSummary {
  intent: BookingIntentRecord | null;
  outcome: BookingOutcomeRecord | null;
  statusLabel: string;
  statusTone: 'neutral' | 'success' | 'warning' | 'error';
}

export interface StartBookingIntentInput extends BookingCommissionAttribution {
  activityId: string;
  itineraryId?: string | null;
  itineraryItemId?: string | null;
  provider: Enums<'activity_source'>;
  providerUrl?: string | null;
  surface: BookingSurface;
}

export interface RecordBookingOutcomeInput extends BookingCommissionAttribution {
  bookingIntentId: string;
  status: BookingOutcomeStatus;
  providerConfirmationRef?: string | null;
  bookedForStartAt?: string | null;
  totalMinor?: number | null;
  currency?: string | null;
}

