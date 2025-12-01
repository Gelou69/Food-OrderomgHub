// hooks/useSupabase.js
import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

export const useSupabase = () => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setAuthReady(true);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);
  
  return { supabase, user, authReady };
};