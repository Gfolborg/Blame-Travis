import AsyncStorage from '@react-native-async-storage/async-storage';
import { bookingService } from './booking';

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

const { Linking } = jest.requireMock('react-native') as {
  Linking: {
    canOpenURL: jest.Mock;
    openURL: jest.Mock;
  };
};

describe('bookingService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('creates intent and marks pending when handoff opens', async () => {
    Linking.canOpenURL.mockResolvedValue(true);
    Linking.openURL.mockResolvedValue(undefined);

    const intent = await bookingService.startBookingIntent({
      activityId: 'provider:abc123',
      provider: 'google_places',
      providerUrl: 'https://example.com/book',
      surface: 'details',
      commissionPartnerId: 'google_places',
      commissionCampaignId: 'phase4_guest_local',
      commissionRateBps: null,
      commissionExpectedMinor: null,
    });

    const opened = await bookingService.openProviderHandoff(intent.id);
    expect(opened).toBe(true);

    const pending = await bookingService.getPendingReturnIntent();
    expect(pending?.id).toBe(intent.id);

    const summary = await bookingService.getBookingStateByActivity('provider:abc123');
    expect(summary.statusLabel).toBe('Redirected');
  });

  it('records outcome and clears pending intent', async () => {
    Linking.canOpenURL.mockResolvedValue(true);
    Linking.openURL.mockResolvedValue(undefined);

    const intent = await bookingService.startBookingIntent({
      activityId: 'provider:def456',
      provider: 'google_places',
      providerUrl: 'https://example.com/book-2',
      surface: 'journeys',
      itineraryId: 'it-1',
      itineraryItemId: 'item-1',
      commissionPartnerId: 'google_places',
      commissionCampaignId: 'phase4_guest_local',
      commissionRateBps: 250,
      commissionExpectedMinor: 500,
    });
    await bookingService.openProviderHandoff(intent.id);

    const outcome = await bookingService.recordBookingOutcome({
      bookingIntentId: intent.id,
      status: 'booked',
      currency: 'USD',
      totalMinor: 1299,
      providerConfirmationRef: 'CONF-1',
      commissionPartnerId: null,
      commissionCampaignId: null,
      commissionRateBps: null,
      commissionExpectedMinor: null,
    });

    expect(outcome?.bookingIntentId).toBe(intent.id);

    const pending = await bookingService.getPendingReturnIntent();
    expect(pending).toBeNull();

    const summary = await bookingService.getBookingStateByItineraryItem('item-1', 'provider:def456');
    expect(summary.statusLabel).toBe('Booked');
  });

  it('ignores stale pending return intents on cold start', async () => {
    const intentId = 'guest-intent-stale-1';
    const now = Date.now();

    await AsyncStorage.setItem(
      'booking.guest_funnel.v1',
      JSON.stringify({
        version: 1,
        savedAt: new Date(now).toISOString(),
        pendingIntentId: intentId,
        lastHandoffAt: new Date(now - 16 * 60 * 1000).toISOString(),
        intents: [
          {
            id: intentId,
            userId: 'guest-local',
            activityId: 'provider:abc123',
            itineraryId: null,
            itineraryItemId: null,
            provider: 'google_places',
            providerUrl: 'https://example.com/book',
            surface: 'details',
            status: 'provider_redirected',
            startedAt: new Date(now - 17 * 60 * 1000).toISOString(),
            lastTransitionAt: new Date(now - 16 * 60 * 1000).toISOString(),
            failureReason: null,
            authSyncRequired: true,
            syncState: 'pending_auth',
            commissionPartnerId: null,
            commissionCampaignId: null,
            commissionRateBps: null,
            commissionExpectedMinor: null,
          },
        ],
        outcomes: [],
      }),
    );

    const pending = await bookingService.getPendingReturnIntent({
      maxHandoffAgeMs: 15 * 60 * 1000,
    });

    expect(pending).toBeNull();

    const raw = await AsyncStorage.getItem('booking.guest_funnel.v1');
    const parsed = raw ? JSON.parse(raw) : null;
    expect(parsed?.pendingIntentId).toBeNull();
  });

  it('supports retry after handoff failure without sticky state', async () => {
    Linking.canOpenURL.mockResolvedValue(false);

    const failedIntent = await bookingService.startBookingIntent({
      activityId: 'provider:retry123',
      provider: 'google_places',
      providerUrl: 'not-a-valid-url',
      surface: 'journeys',
      itineraryId: 'it-2',
      itineraryItemId: 'item-2',
      commissionPartnerId: 'google_places',
      commissionCampaignId: 'phase4_guest_local',
      commissionRateBps: null,
      commissionExpectedMinor: null,
    });

    const firstOpen = await bookingService.openProviderHandoff(failedIntent.id);
    expect(firstOpen).toBe(false);

    const failedSummary = await bookingService.getBookingStateByItineraryItem('item-2', 'provider:retry123');
    expect(failedSummary.statusLabel).toBe('Failed');
    expect(await bookingService.getPendingReturnIntent()).toBeNull();

    Linking.canOpenURL.mockResolvedValue(true);
    Linking.openURL.mockResolvedValue(undefined);

    const retryIntent = await bookingService.startBookingIntent({
      activityId: 'provider:retry123',
      provider: 'google_places',
      providerUrl: 'https://example.com/retry',
      surface: 'journeys',
      itineraryId: 'it-2',
      itineraryItemId: 'item-2',
      commissionPartnerId: 'google_places',
      commissionCampaignId: 'phase4_guest_local',
      commissionRateBps: null,
      commissionExpectedMinor: null,
    });

    const retryOpen = await bookingService.openProviderHandoff(retryIntent.id);
    expect(retryOpen).toBe(true);

    const summaryAfterRetry = await bookingService.getBookingStateByItineraryItem('item-2', 'provider:retry123');
    expect(summaryAfterRetry.intent?.id).toBe(retryIntent.id);
    expect(summaryAfterRetry.statusLabel).toBe('Redirected');
  });
});
