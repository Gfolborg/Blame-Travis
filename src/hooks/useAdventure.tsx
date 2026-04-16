import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { Adventure, ItineraryStop } from '../types/adventure';

interface AdventureContextType {
  currentAdventure: Adventure | null;
  loading: boolean;
  error: string | null;
  refreshAdventure: () => Promise<void>;
  replaceItineraryStop: (oldStopId: string, newStop: ItineraryStop) => Promise<void>;
}

const AdventureContext = createContext<AdventureContextType | undefined>(undefined);

export const AdventureProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentAdventure, setCurrentAdventure] = useState<Adventure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveAdventure = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError || !session) {
        setCurrentAdventure(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('adventures')
        .select('*')
        .in('status', ['assigned', 'active', 'draft'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setCurrentAdventure(data as unknown as Adventure || null);
    } catch (err: any) {
      console.error('Error fetching Adventure:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const replaceItineraryStop = async (oldStopId: string, newStop: ItineraryStop) => {
    if (!currentAdventure) return;

    try {
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
  }, []);

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
