import React, { createContext, useContext, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, UserProfile, UserRole } from "@/stores/useAuthStore";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data as UserProfile | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { 
    user, 
    session, 
    profile, 
    isLoading,
    setUser, 
    setSession, 
    setProfile, 
    setIsLoading,
    reset 
  } = useAuthStore();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id).then(setProfile);
          }, 0);
        } else {
          setProfile(null);
        }

        if (event === 'SIGNED_OUT') {
          reset();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id).then((profile) => {
          setProfile(profile);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession, setProfile, setIsLoading, reset]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    setIsLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      return { error: error.message };
    }

    if (data.user) {
      const profile = await fetchUserProfile(data.user.id);
      if (!profile) {
        setIsLoading(false);
        return { error: "No profile found for this user. Please contact an administrator." };
      }
      
      if (!profile.is_active) {
        await supabase.auth.signOut();
        setIsLoading(false);
        return { error: "Your account has been deactivated. Please contact an administrator." };
      }
      
      setProfile(profile);
    }

    setIsLoading(false);
    return {};
  }, [setIsLoading, setProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string): Promise<{ error?: string }> => {
    setIsLoading(true);
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });

    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        return { error: "An account with this email already exists. Please sign in instead." };
      }
      return { error: error.message };
    }

    return {};
  }, [setIsLoading]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    reset();
  }, [reset]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const updatedProfile = await fetchUserProfile(user.id);
      setProfile(updatedProfile);
    }
  }, [user, setProfile]);

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Convenience hook to get just the profile with role checking
export function useUserRole(): UserRole | null {
  const { profile } = useAuth();
  return profile?.role ?? null;
}
