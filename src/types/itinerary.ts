export type ItineraryWarningSeverity = 'none' | 'medium' | 'high';
export type DistanceUnit = 'mi' | 'km';

export interface ItineraryHeader {
  id: string;
  userId: string;
  title: string;
  destinationCity: string;
  startDate: string | null;
  endDate: string | null;
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'archived';
  updatedAt: string;
  createdAt: string;
  legacyAdventureId: string | null;
}

export interface ItineraryListItem {
  id: string;
  title: string;
  destinationCity: string;
  status: ItineraryHeader['status'];
  updatedAt: string;
  startDate: string | null;
  endDate: string | null;
  legacyAdventureId: string | null;
}

export interface ItineraryActivityItem {
  id: string;
  itineraryId: string;
  activityId: string;
  canonicalKey: string | null;
  dayIndex: number;
  positionIndex: number;
  scheduledAt: string | null;
  narrativeWhy: string | null;
  title: string;
  imageUrl: string | null;
  category: string | null;
  city: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  durationMinutesMin: number | null;
  durationMinutesMax: number | null;
}

export interface ItineraryDay {
  dayIndex: number;
  items: ItineraryActivityItem[];
}

export interface DayConflictSummary {
  dayIndex: number;
  hasDuplicateActivityConflict: boolean;
  hasCapacityConflict: boolean;
}

export interface HopDistanceWarning {
  dayIndex: number;
  fromItemId: string;
  toItemId: string;
  distanceValue: number;
  distanceUnit: DistanceUnit;
  severity: ItineraryWarningSeverity;
}

export interface ItineraryWarnings {
  dayConflicts: DayConflictSummary[];
  hopWarnings: HopDistanceWarning[];
}

export interface ItinerarySummary {
  plannedDayCount: number;
  totalItemCount: number;
  averageItemsPerDay: number;
  daysWithCapacityConflict: number;
  highDistanceHopCount: number;
}

export interface ItineraryBundle {
  header: ItineraryHeader;
  days: ItineraryDay[];
  warnings: ItineraryWarnings;
  summary: ItinerarySummary;
}

export interface JourneysLoadResult {
  itineraries: ItineraryListItem[];
  activeItineraryId: string | null;
  bundle: ItineraryBundle | null;
  offline: boolean;
  offlineSavedAt: string | null;
}

export interface CreateItineraryInput {
  title: string;
  destinationCity: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AddSavedToDayInput {
  itineraryId: string;
  activityId: string;
  dayIndex: number;
}

export interface AddActivityToDayInput {
  itineraryId: string;
  activityId: string;
  dayIndex: number;
}

export interface EnsureActiveItineraryInput {
  title?: string;
  destinationCity?: string;
}

export interface UpdateItineraryDetailsInput {
  itineraryId: string;
  title: string;
  destinationCity: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface RemoveItineraryItemInput {
  itineraryId: string;
  itemId: string;
}

export interface ReorderDayInput {
  itineraryId: string;
  dayIndex: number;
  fromIndex: number;
  toIndex: number;
}

export interface MoveItemToDayInput {
  itineraryId: string;
  itemId: string;
  targetDayIndex: number;
  targetIndex?: number;
}
