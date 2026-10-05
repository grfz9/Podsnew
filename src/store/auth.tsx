import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';
import { mergeSynced, type SyncedData } from '../lib/sync';
import { useLibrary, type LibraryState } from './library';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

interface AuthValue {
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<void>;
  signInPhone: (phone: string, password: string) => Promise<void>;
  /** Inscription par téléphone : un code est envoyé par SMS (à confirmer avec verifyPhone). */
  signUpPhone: (phone: string, password: string, username: string, displayName: string) => Promise<void>;
  verifyPhone: (phone: string, code: string) => Promise<void>;
  setUsername: (username: string) => Promise<void>;
  /** Renvoie true si une confirmation par e-mail est nécessaire. */
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  /** Nouveau mot de passe pour le compte connecté (aussi pour un compte créé avec Google ou Apple). */
  changePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'display_name'>>) => Promise<void>;
  syncNow: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function syncedPart(s: LibraryState): SyncedData {
  const { subscriptions, savedEpisodes, history, clips, playlists, progress, stats, modified, settings } = s;
  const prefs = {
    quran: settings.quran,
    interests: settings.interests,
    episodeOrder: settings.episodeOrder,
    prayer: settings.prayer,
    wallpaper: settings.wallpaper,
    sidebarWallpaper: settings.sidebarWallpaper,
    updatedAt: s.prefsModified,
  };
  return { subscriptions, savedEpisodes, history, clips, playlists, progress, stats, modified, prefs };
}

const PUSH_DELAY_MS = 3000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const library = useLibrary();
  const libraryRef = useRef(library);
  libraryRef.current = library;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off');
  const pulledFor = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  /* ---------- Session ---------- */
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle<Profile>()
      .then(({ data }) => setProfile(data));
  }, [userId]);

  /* ---------- Synchronisation ---------- */
  const push = useCallback(async (uid: string, data?: SyncedData) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('user_state')
      .upsert({ user_id: uid, data: data ?? syncedPart(libraryRef.current.state), updated_at: new Date().toISOString() });
    setSyncStatus(error ? 'error' : 'synced');
  }, []);

  const pullAndMerge = useCallback(
    async (uid: string) => {
      if (!supabase) return;
      setSyncStatus('syncing');
      const { data, error } = await supabase.from('user_state').select('data').eq('user_id', uid).maybeSingle<{ data: Partial<SyncedData> }>();
      if (error) {
        setSyncStatus('error');
        return;
      }
      const lib = libraryRef.current;
      const firstSync = lib.state.sync.userId !== uid || !lib.state.sync.lastSyncedAt;
      const merged = mergeSynced(syncedPart(lib.state), data?.data ?? {}, firstSync);
      lib.applySynced(merged, uid);
      pulledFor.current = uid;
      await push(uid, merged);
    },
    [push],
  );

  useEffect(() => {
    if (!userId) {
      pulledFor.current = null;
      setSyncStatus('off');
      return;
    }
    void pullAndMerge(userId);
    const onVisible = () => document.visibilityState === 'visible' && void pullAndMerge(userId);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, pullAndMerge]);

  // Envoi différé après chaque modification locale des données synchronisées.
  const { subscriptions, savedEpisodes, history, clips, playlists, progress, stats, prefsModified } = library.state;
  useEffect(() => {
    if (!userId || pulledFor.current !== userId) return;
    const t = setTimeout(() => void push(userId), PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [userId, push, subscriptions, savedEpisodes, history, clips, playlists, progress, stats, prefsModified]);

  /* ---------- Actions ---------- */
  const value = useMemo<AuthValue>(
    () => ({
      enabled: !!supabase,
      loading,
      session,
      userId,
      email: session?.user.email || (session?.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : null),
      profile,
      syncStatus,
      lastSyncedAt: library.state.sync.lastSyncedAt,
      signIn: async (email, password) => {
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message);
      },
      signInWithProvider: async (provider) => {
        const { error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}${location.pathname}` } });
        if (error) throw new Error(error.message);
      },
      signInPhone: async (phone, password) => {
        const { error } = await supabase!.auth.signInWithPassword({ phone, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Numéro ou mot de passe incorrect.' : error.message);
      },
      signUpPhone: async (phone, password, username, displayName) => {
        const { error } = await supabase!.auth.signUp({
          phone,
          password,
          options: { data: { username: username.toLowerCase(), display_name: displayName || username }, channel: 'sms' },
        });
        if (error) throw new Error(error.message);
      },
      verifyPhone: async (phone, code) => {
        const { error } = await supabase!.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
        if (error) throw new Error(error.message.includes('expired') || error.message.includes('invalid') ? 'Code incorrect ou expiré.' : error.message);
      },
      setUsername: async (username) => {
        const { error } = await supabase!.rpc('set_username', { p_username: username });
        if (error) throw new Error(error.message);
        setProfile((p) => (p ? { ...p, username: username.trim().toLowerCase(), username_set: true } : p));
      },
      signUp: async (email, password, username, displayName) => {
        const { data, error } = await supabase!.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.toLowerCase(), display_name: displayName || username },
            emailRedirectTo: `${location.origin}${location.pathname}`,
          },
        });
        if (error) throw new Error(error.message);
        return !data.session;
      },
      resetPassword: async (email) => {
        const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}#/account` });
        if (error) throw new Error(error.message);
      },
      changePassword: async (password) => {
        const { error } = await supabase!.auth.updateUser({ password });
        if (error) {
          throw new Error(
            /same/i.test(error.message)
              ? 'Le nouveau mot de passe doit être différent de l’ancien.'
              : /reauth|recent/i.test(error.message)
                ? 'Par sécurité, déconnectez-vous puis reconnectez-vous avant de changer de mot de passe.'
                : error.message,
          );
        }
      },
      signOut: async () => {
        if (userId) await push(userId);
        await supabase!.auth.signOut();
        libraryRef.current.resetSync();
      },
      updateProfile: async (patch) => {
        if (!userId) return;
        const previous = profile;
        // Mise à jour optimiste : l'interface réagit tout de suite, on revient en arrière en cas d'échec.
        setProfile((p) => (p ? { ...p, ...patch } : p));
        const { data, error } = await supabase!.from('profiles').update(patch).eq('id', userId).select().single<Profile>();
        if (error) {
          setProfile(previous);
          throw new Error(error.message);
        }
        setProfile(data);
      },
      syncNow: () => userId && void pullAndMerge(userId),
    }),
    [loading, session, userId, profile, syncStatus, library.state.sync.lastSyncedAt, push, pullAndMerge],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
