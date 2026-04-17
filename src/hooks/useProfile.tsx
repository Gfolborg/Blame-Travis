import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { Tables } from '../types/database';
import { Session } from '@supabase/supabase-js';

type Profile = Tables<'profiles'>;

// Stable Guest ID for development
const GUEST_ID = '00000000-0000-0000-0000-000000000000';

interface ProfileContextType {
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isOnboarded: boolean;
  signOut: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Attempt to get real session
      const { data: { session: realSession } } = await supabase.auth.getSession();
      setSession(realSession);

      const userId = realSession?.user.id || GUEST_ID;

      // Fetch profile (Real or Guest)
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist yet, create a default one for this ID
        const defaultProfile: any = {
          id: userId,
          home_city: 'Austin, TX',
          transport_mode: 'driving',
          travis_tone: 'bold',
          budget_default: 2,
          is_premium: true,
          notifications_enabled: true,
        };

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .single();
        
        if (insertError) throw insertError;
        setProfile(newProfile);
      } else if (fetchError) {
        throw fetchError;
      } else {
        setProfile(data);
      }

    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    const userId = session?.user.id || GUEST_ID;
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) throw updateError;
      await fetchProfile();
    } catch (err: any) {
      console.error('Error updating profile:', err.message);
      throw err;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await fetchProfile(); // Reset to guest
  };

  useEffect(() => {
    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Always consider onboarded for guest/dev mode
  const isOnboarded = true;

  return (
    <ProfileContext.Provider
      value={{
        profile,
        session,
        loading,
        error,
        updateProfile,
        refreshProfile: fetchProfile,
        isOnboarded,
        signOut,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
