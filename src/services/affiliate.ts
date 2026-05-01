import { isFeatureEnabled } from '../config/featureFlags';
import { supabase } from './supabase';
import {
  AffiliateSurface,
  CreateAffiliateHandoffInput,
  CreateAffiliateHandoffResult,
  ResolveAffiliateOfferInput,
  ResolveAffiliateOfferResult,
  TrackAffiliateEventInput,
} from '../types/affiliate';

const isSurfaceEnabled = (surface: AffiliateSurface): boolean => {
  if (!isFeatureEnabled('affiliate_enabled')) return false;
  if (surface === 'details') return isFeatureEnabled('affiliate_details_enabled');
  if (surface === 'journeys') return isFeatureEnabled('affiliate_journeys_enabled');
  return isFeatureEnabled('affiliate_explore_badge_enabled');
};

export const affiliateService = {
  isSurfaceEnabled(surface: AffiliateSurface): boolean {
    return isSurfaceEnabled(surface);
  },

  shouldRenderPlacement(surface: AffiliateSurface, hasActiveOffer: boolean): boolean {
    return isSurfaceEnabled(surface) && hasActiveOffer;
  },

  async resolveOffer(input: ResolveAffiliateOfferInput): Promise<ResolveAffiliateOfferResult> {
    if (!isSurfaceEnabled(input.surface)) {
      return {
        ok: false,
        reason: 'affiliate_disabled',
        offer: null,
        placementKey: input.placementKey,
        disclosureWording: null,
      };
    }

    const { data, error } = await supabase.functions.invoke('affiliate-handoff', {
      body: {
        action: 'resolve_offer',
        payload: input,
      },
    });

    if (error) {
      return {
        ok: false,
        reason: error.message || 'resolve_offer_failed',
        offer: null,
        placementKey: input.placementKey,
        disclosureWording: null,
      };
    }

    return {
      ok: Boolean(data?.ok),
      reason: data?.reason,
      offer: data?.offer || null,
      placementKey: data?.placementKey || input.placementKey,
      disclosureWording: data?.disclosureWording || null,
    };
  },

  async createHandoff(input: CreateAffiliateHandoffInput): Promise<CreateAffiliateHandoffResult> {
    if (!isSurfaceEnabled(input.surface)) {
      return {
        ok: false,
        reason: 'affiliate_disabled',
        handoffUrl: null,
        attributionId: null,
      };
    }

    const { data, error } = await supabase.functions.invoke('affiliate-handoff', {
      body: {
        action: 'create_handoff',
        payload: input,
      },
    });

    if (error) {
      return {
        ok: false,
        reason: error.message || 'create_handoff_failed',
        handoffUrl: null,
        attributionId: null,
      };
    }

    return {
      ok: Boolean(data?.ok),
      reason: data?.reason,
      handoffUrl: data?.handoffUrl || null,
      attributionId: data?.attributionId || null,
    };
  },

  async trackEvent(input: TrackAffiliateEventInput): Promise<boolean> {
    if (!isSurfaceEnabled(input.surface)) return false;

    const { data, error } = await supabase.functions.invoke('affiliate-handoff', {
      body: {
        action: 'track_event',
        payload: input,
      },
    });

    if (error) return false;
    return Boolean(data?.ok);
  },
};
