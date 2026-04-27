export interface FeatureFlags {
  explore_search_v1_enabled: boolean;
  activity_details_v1_enabled: boolean;
  saved_activities_v1_enabled: boolean;
  itinerary_builder_v1_enabled: boolean;
  booking_tracking_v1_enabled: boolean;
}

export const featureFlags: FeatureFlags = {
  explore_search_v1_enabled: true,
  activity_details_v1_enabled: true,
  saved_activities_v1_enabled: true,
  itinerary_builder_v1_enabled: true,
  booking_tracking_v1_enabled: true,
};

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag];
}
