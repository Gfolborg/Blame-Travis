import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import {
  AUTO_STAMP_DWELL_MS,
  computeDistanceMeters,
  passportService,
  PassportStopTarget,
  PROXIMITY_STAMP_RADIUS_METERS,
} from '../services/passport';
import { useNotice } from './TravisNotice';

type ActiveStopsState = {
  itineraryId: string | null;
  stops: PassportStopTarget[];
};

type DwellCandidate = {
  placeId: string;
  firstSeenAt: number;
};

const LOCATION_REFRESH_INTERVAL_MS = 90000;
const STAMP_ATTEMPT_COOLDOWN_MS = 90000;

export const PassportAutoStampCoordinator = () => {
  const { showNotice } = useNotice();
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeStopsRef = useRef<ActiveStopsState>({ itineraryId: null, stops: [] });
  const dwellCandidateRef = useRef<DwellCandidate | null>(null);
  const lastStampAttemptByPlaceRef = useRef<Map<string, number>>(new Map());
  const stampingRef = useRef(false);

  const refreshActiveStops = useCallback(async () => {
    try {
      const next = await passportService.listActiveItineraryStops();
      activeStopsRef.current = {
        itineraryId: next.itineraryId,
        stops: next.stops,
      };
      if (!next.itineraryId || !next.stops.length) {
        dwellCandidateRef.current = null;
      }
    } catch {
      // no-op: keep previous context and retry on next interval
    }
  }, []);

  const handlePosition = useCallback(
    async (location: Location.LocationObject) => {
      const context = activeStopsRef.current;
      if (!context.itineraryId || !context.stops.length) {
        dwellCandidateRef.current = null;
        return;
      }

      const now = Date.now();
      const nearbyStop = context.stops
        .map(stop => ({
          stop,
          distanceMeters: computeDistanceMeters(
            {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            },
            {
              lat: stop.lat,
              lng: stop.lng,
            },
          ),
        }))
        .filter(entry => entry.distanceMeters <= PROXIMITY_STAMP_RADIUS_METERS)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

      if (!nearbyStop) {
        dwellCandidateRef.current = null;
        return;
      }

      const cooldownStart = lastStampAttemptByPlaceRef.current.get(nearbyStop.stop.placeId);
      if (cooldownStart && now - cooldownStart < STAMP_ATTEMPT_COOLDOWN_MS) {
        return;
      }

      const currentDwell = dwellCandidateRef.current;
      if (!currentDwell || currentDwell.placeId !== nearbyStop.stop.placeId) {
        dwellCandidateRef.current = {
          placeId: nearbyStop.stop.placeId,
          firstSeenAt: now,
        };
        return;
      }

      if (now - currentDwell.firstSeenAt < AUTO_STAMP_DWELL_MS) {
        return;
      }

      if (stampingRef.current) {
        return;
      }

      stampingRef.current = true;
      lastStampAttemptByPlaceRef.current.set(nearbyStop.stop.placeId, now);
      dwellCandidateRef.current = null;

      try {
        const result = await passportService.recordAutoStamp({
          itineraryId: nearbyStop.stop.itineraryId,
          dayIndex: nearbyStop.stop.dayIndex,
          activityId: nearbyStop.stop.activityId,
          canonicalKey: nearbyStop.stop.canonicalKey,
          placeId: nearbyStop.stop.placeId,
          title: nearbyStop.stop.title,
          city: nearbyStop.stop.city,
          countryCode: nearbyStop.stop.countryCode,
          lat: nearbyStop.stop.lat,
          lng: nearbyStop.stop.lng,
          distanceMeters: nearbyStop.distanceMeters,
          dayTotalStops: nearbyStop.stop.dayTotalStops,
        });

        if (!result.didStamp || !result.stamp) {
          return;
        }

        const cityLabel = result.stamp.city ? ` in ${result.stamp.city}` : '';
        showNotice({
          title: 'STAMPED',
          message: `Travis: '${result.stamp.title}${cityLabel} is now stamped in your passport.'`,
          type: 'success',
          duration: 2500,
        });
        AccessibilityInfo.announceForAccessibility(`${result.stamp.title} stamped in passport`);

        if (result.unlocked.length) {
          const unlockedTitles = result.unlocked.map(item => item.title).join(', ');
          showNotice({
            title: 'ACHIEVEMENT UNLOCKED',
            message: `Travis: '${unlockedTitles}. Keep rolling.'`,
            type: 'info',
            duration: 3200,
          });
          AccessibilityInfo.announceForAccessibility(`Achievement unlocked: ${unlockedTitles}`);
        }
      } finally {
        stampingRef.current = false;
      }
    },
    [showNotice],
  );

  useEffect(() => {
    let mounted = true;

    const ensureForegroundWatch = async () => {
      await refreshActiveStops();

      const currentPermission = await Location.getForegroundPermissionsAsync();
      let status = currentPermission.status;

      if (status !== 'granted' && currentPermission.canAskAgain) {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }

      if (!mounted) return;

      if (status !== 'granted') {
        await passportService.setLocationPermissionStatus('denied');
        // Keep startup quiet when location is denied. The UI surfaces inline guidance
        // and users can enable permission from settings when they need auto-stamping.
        return;
      }

      await passportService.setLocationPermissionStatus('granted');

      if (!watchRef.current) {
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 25,
            mayShowUserSettingsDialog: true,
          },
          position => {
            void handlePosition(position);
          },
        );
      }
    };

    const stopForegroundWatch = async () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };

    void ensureForegroundWatch();
    refreshIntervalRef.current = setInterval(() => {
      void refreshActiveStops();
    }, LOCATION_REFRESH_INTERVAL_MS);

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void ensureForegroundWatch();
      } else {
        void stopForegroundWatch();
      }
    });

    return () => {
      mounted = false;
      appStateSub.remove();
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      void stopForegroundWatch();
    };
  }, [handlePosition, refreshActiveStops, showNotice]);

  return null;
};
