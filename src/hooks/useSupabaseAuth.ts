import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient, supabaseConfig } from "../lib/supabase";

interface AuthActionResult {
  error?: string;
  message?: string;
}

export function useSupabaseAuth() {
  const client = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseConfig.configured);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    client.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (!error) {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }

      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!client) {
        return { error: "Supabase is not configured." };
      }

      const { error } = await client.auth.signInWithPassword({ email, password });

      return error ? { error: error.message } : {};
    },
    [client],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!client) {
        return { error: "Supabase is not configured." };
      }

      const { data, error } = await client.auth.signUp({ email, password });

      if (error) {
        return { error: error.message };
      }

      return data.session
        ? {}
        : { message: "Check your email to confirm the new account." };
    },
    [client],
  );

  const sendMagicLink = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!client) {
        return { error: "Supabase is not configured." };
      }

      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });

      return error
        ? { error: error.message }
        : { message: "Magic link sent. Check your email." };
    },
    [client],
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!client) {
      return {};
    }

    const { error } = await client.auth.signOut();

    return error ? { error: error.message } : {};
  }, [client]);

  return useMemo(
    () => ({
      configured: supabaseConfig.configured,
      loading,
      session,
      user,
      signInWithPassword,
      signUpWithPassword,
      sendMagicLink,
      signOut,
    }),
    [
      loading,
      sendMagicLink,
      session,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      user,
    ],
  );
}
