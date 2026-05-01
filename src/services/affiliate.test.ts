import { featureFlags } from '../config/featureFlags';
import { affiliateService } from './affiliate';
import { supabase } from './supabase';

describe('affiliateService', () => {
  const baselineFlags = { ...featureFlags };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(featureFlags, baselineFlags);
  });

  it('does not invoke edge endpoint when affiliate flags are disabled', async () => {
    const invokeMock = supabase.functions.invoke as jest.Mock;

    const result = await affiliateService.resolveOffer({
      activityId: 'provider:abc',
      surface: 'details',
      placementKey: 'details_primary_cta',
      destinationCity: 'Austin',
      category: 'museum',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('affiliate_disabled');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('invokes edge endpoint when affiliate surface is enabled', async () => {
    Object.assign(featureFlags, {
      affiliate_enabled: true,
      affiliate_details_enabled: true,
    });
    const invokeMock = supabase.functions.invoke as jest.Mock;
    invokeMock.mockResolvedValueOnce({
      data: {
        ok: true,
        offer: {
          id: 'offer-1',
          partnerId: 'partner-1',
          partnerName: 'Mock Partner',
          title: 'Mock Offer',
          status: 'active',
          commissionModel: 'cpa',
          trackingTemplate: 'https://partner.example.com/book',
          validFrom: '2026-05-01T00:00:00.000Z',
          validTo: null,
        },
        placementKey: 'details_primary_cta',
        disclosureWording: 'Partner offer',
      },
      error: null,
    });

    const result = await affiliateService.resolveOffer({
      activityId: 'provider:abc',
      surface: 'details',
      placementKey: 'details_primary_cta',
      destinationCity: 'Austin',
      category: 'museum',
    });

    expect(result.ok).toBe(true);
    expect(result.offer?.id).toBe('offer-1');
    expect(invokeMock).toHaveBeenCalledWith('affiliate-handoff', {
      body: {
        action: 'resolve_offer',
        payload: {
          activityId: 'provider:abc',
          surface: 'details',
          placementKey: 'details_primary_cta',
          destinationCity: 'Austin',
          category: 'museum',
        },
      },
    });
  });
});

