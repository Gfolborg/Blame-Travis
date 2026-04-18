import React, { createContext, useCallback, useContext, useEffect, ReactNode, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { Adventure, ItineraryStop } from '../types/adventure';
import { fetchCurrentAdventureForUser } from '../services/adventureData';
import { discoveryService } from '../services/discovery';

const GUEST_ID = '00000000-0000-0000-0000-000000000000';

interface AdventureContextType {
  currentAdventure: Adventure | null;
  loading: boolean;
  error: string | null;
  refreshAdventure: () => Promise<void>;
  replaceItineraryStop: (_oldStopId: string, _newStop: ItineraryStop) => Promise<void>;
}

const AdventureContext = createContext<AdventureContextType | undefined>(undefined);

export const AdventureProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentAdventure, setCurrentAdventure] = useState<Adventure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentAdventureRef = useRef<Adventure | null>(null);

  useEffect(() => {
    currentAdventureRef.current = currentAdventure;
  }, [currentAdventure]);

  const fetchActiveAdventure = useCallback(async () => {
    try {
      if (!currentAdventureRef.current) {
        setLoading(true);
      }
      setError(null);

      const { data: { session }, error: authError } = await supabase.auth.getSession();

      const userId = authError || !session ? GUEST_ID : session.user.id;
      const nextAdventure = await fetchCurrentAdventureForUser(userId);
      setCurrentAdventure(nextAdventure);

      if (nextAdventure && nextAdventure.days?.length) {
        discoveryService.ensureHydrationWindow(nextAdventure)
          .then(updatedAdventure => {
            if (updatedAdventure) {
              setCurrentAdventure(updatedAdventure);
            }
          })
          .catch(err => {
            console.warn('Hydration window update skipped:', err);
          });
      }
    } catch (err: any) {
      console.error('Error fetching Adventure:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const replaceItineraryStop = async (oldStopId: string, newStop: ItineraryStop) => {
    if (!currentAdventure) return;

    try {
      if (currentAdventure.days?.length) {
        const targetDay = currentAdventure.days.find(day =>
          day.itinerary_json.some(stop => stop.place_id === oldStopId)
        );

        if (!targetDay) {
          throw new Error('Could not find the stop to replace.');
        }

        const updatedDayStops = targetDay.itinerary_json.map(stop =>
          stop.place_id === oldStopId
            ? { ...newStop, order: stop.order, day: targetDay.day_number, day_number: targetDay.day_number }
            : stop
        );

        const { error: dayUpdateError } = await supabase
          .from('adventure_days')
          .update({ itinerary_json: updatedDayStops as any })
          .eq('adventure_id', currentAdventure.id)
          .eq('day_number', targetDay.day_number);

        if (dayUpdateError && dayUpdateError.code !== '42P01') throw dayUpdateError;

        const updatedDays = currentAdventure.days.map(day =>
          day.day_number === targetDay.day_number
            ? { ...day, itinerary_json: updatedDayStops }
            : day
        );

        const updatedItinerary = updatedDays.flatMap(day => day.itinerary_json);
        const { error: legacyUpdateError } = await supabase
          .from('adventures')
          .update({ itinerary_json: updatedItinerary as any })
          .eq('id', currentAdventure.id);

        if (legacyUpdateError) throw legacyUpdateError;

        setCurrentAdventure({
          ...currentAdventure,
          days: updatedDays,
          itinerary_json: updatedItinerary,
        });
        return;
      }

      const updatedItinerary = currentAdventure.itinerary_json.map(stop =>
        stop.place_id === oldStopId ? { ...newStop, order: stop.order } : stop
      );

      const { error: updateError } = await supabase
        .from('adventures')
        .update({ itinerary_json: updatedItinerary as any })
        .eq('id', currentAdventure.id);

      if (updateError) throw updateError;

      setCurrentAdventure({
        ...currentAdventure,
        itinerary_json: updatedItinerary
      });
    } catch (err: any) {
      console.error('Error replacing itinerary stop:', err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchActiveAdventure();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchActiveAdventure();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchActiveAdventure]);

  return (
    <AdventureContext.Provider 
      value={{ 
        currentAdventure, 
        loading, 
        error, 
        refreshAdventure: fetchActiveAdventure,
        replaceItineraryStop
      }}
    >
      {children}
    </AdventureContext.Provider>
  );
};

export const useAdventure = () => {
  const context = useContext(AdventureContext);
  if (context === undefined) {
    throw new Error('useAdventure must be used within a AdventureProvider');
  }
  return context;
};
