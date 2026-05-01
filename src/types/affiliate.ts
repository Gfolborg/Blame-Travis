export type AffiliatePartnerStatus = 'active' | 'paused' | 'retired';
export type AffiliateOfferStatus = 'active' | 'paused' | 'expired';
export type AffiliateCommissionModel = 'cpa' | 'rev_share' | 'flat';
export type AffiliatePlacementSurface = 'explore_card' | 'details_primary_cta' | 'journeys_stop_cta';
export type AffiliateAttributionStatus = 'candidate' | 'attributed' | 'expired' | 'superseded';
export type AffiliatePayoutStatus = 'reported' | 'confirmed' | 'rejected' | 'reversed';
export type AffiliateEventName =
  | 'affiliate_impression'
  | 'affiliate_click'
  | 'affiliate_handoff_started'
  | 'affiliate_handoff_returned'
  | 'affiliate_booking_reported'
  | 'affiliate_commission_confirmed';

export type AffiliateSurface = 'details' | 'journeys' | 'explore';

export interface AffiliatePartner {
  id: string;
  slug: string;
  name: string;
  status: AffiliatePartnerStatus;
  disclosureLabel: string;
  defaultCommissionModel: AffiliateCommissionModel;
}

export interface AffiliateOffer {
  id: string;
  partnerId: string;
  partnerName: string;
  title: string;
  status: AffiliateOfferStatus;
  commissionModel: AffiliateCommissionModel;
  trackingTemplate: string;
  validFrom: string;
  validTo: string | null;
}

export interface ResolveAffiliateOfferInput {
  activityId: string;
  surface: AffiliateSurface;
  placementKey: AffiliatePlacementSurface;
  destinationCity?: string | null;
  category?: string | null;
  sessionId?: string | null;
}

export interface ResolveAffiliateOfferResult {
  ok: boolean;
  reason?: string;
  offer: AffiliateOffer | null;
  placementKey: AffiliatePlacementSurface;
  disclosureWording: string | null;
}

export interface CreateAffiliateHandoffInput {
  activityId: string;
  offerId: string;
  surface: AffiliateSurface;
  placementKey: AffiliatePlacementSurface;
  sessionId: string;
  copyVariant: string;
  disclosureWording: string;
  partnerBrand: string | null;
}

export interface CreateAffiliateHandoffResult {
  ok: boolean;
  reason?: string;
  handoffUrl: string | null;
  attributionId: string | null;
}

export interface TrackAffiliateEventInput {
  eventName: AffiliateEventName;
  sessionId: string;
  activityId: string;
  surface: AffiliateSurface;
  partnerId: string;
  offerId: string;
  placementKey: AffiliatePlacementSurface;
  copyVariant: string;
  partnerBrand: string | null;
  disclosureWording: string;
  destinationCity?: string | null;
}

