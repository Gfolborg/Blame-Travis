import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

export interface PlaceDetails {
  id: string;
  displayName: string;
  formattedAddress: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  editorialSummary?: string;
  reviews: Array<{
    text: string;
    rating: number;
    authorName: string;
    relativePublishTime: string;
  }>;
  photos: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
  }>;
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractLocation = (payload: any): PlaceDetails['location'] => {
  const latitude = toNumber(
    payload?.location?.latitude ??
    payload?.location?.lat ??
    payload?.geocodes?.main?.latitude ??
    payload?.geometry?.location?.lat
  );
  const longitude = toNumber(
    payload?.location?.longitude ??
    payload?.location?.lng ??
    payload?.geocodes?.main?.longitude ??
    payload?.geometry?.location?.lng
  );

  if (latitude == null || longitude == null) {
    return undefined;
  }

  return { latitude, longitude };
};

const isFunctionsHttpError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  (error as { name?: string }).name === 'FunctionsHttpError';

export const placesService = {
  /**
   * Fetches rich details for a specific place via Edge Function.
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const { data, error } = await supabase.functions.invoke('place-details', {
        body: { placeId }
      });

      if (error) {
        if (isFunctionsHttpError(error)) {
          return null;
        }
        throw error;
      }
      if (!data || typeof data !== 'object') {
        throw new Error(`Invalid place-details payload for placeId ${placeId}`);
      }
      if ('error' in data && data.error) {
        return null;
      }

      const location = extractLocation(data);
      
      return {
        id: data.id || placeId,
        displayName: data.displayName?.text || 'Unknown Place',
        formattedAddress: data.formattedAddress || '',
        location,
        rating: data.rating,
        userRatingCount: data.userRatingCount,
        priceLevel: data.priceLevel,
        editorialSummary: data.editorialSummary?.text,
        reviews: (data.reviews || []).map((r: any) => ({
          text: r.text?.text,
          rating: r.rating,
          authorName: r.authorAttribution?.displayName,
          relativePublishTime: r.relativePublishTimeDescription,
        })),
        photos: data.photos || [],
      };
    } catch (error) {
      if (isFunctionsHttpError(error)) {
        return null;
      }
      console.error('Error in getPlaceDetails via Edge:', error);
      throw error;
    }
  },

  /**
   * Gets a direct photo URI proxied through Supabase to keep API key hidden.
   */
  getPhotoUri(photoName: string, maxWidth = 800): string {
    // The photo is requested from the place-photo Edge Function
    return `${SUPABASE_URL}/functions/v1/place-photo?name=${encodeURIComponent(photoName)}&maxWidthPx=${maxWidth}`;
  },

  /**
   * Fetches multiple photo URIs for a list of photo metadata.
   */
  async getPhotoUris(photos: Array<{ name: string }>, maxWidth = 800): Promise<string[]> {
    return photos.map(p => this.getPhotoUri(p.name, maxWidth));
  }
};
