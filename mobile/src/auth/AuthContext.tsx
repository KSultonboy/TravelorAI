import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import i18n from '../i18n';
import { setUnauthorizedHandler } from '../utils/api';
import { type AuthUser } from '../utils/auth';
import { signOutGoogleIfSignedIn } from '../utils/googleSession';
import {
  clearAuthSession,
  getItem,
  getJSON,
  KEYS,
  removeLegacyKeys,
  subscribeAuthSession,
} from '../utils/storage';

interface AuthContextValue {
  /** true once the stored session has been read from AsyncStorage */
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  isLoggedIn: boolean;
  /** Clears the session (and the native Google session). */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readSession() {
  const [token, user] = await Promise.all([getItem(KEYS.TOKEN), getJSON<AuthUser>(KEYS.USER)]);
  return { token: token || null, user: user || null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const handlingUnauthorized = useRef(false);

  const reload = useCallback(async () => {
    try {
      const session = await readSession();
      setToken(session.token);
      setUser(session.user);
    } finally {
      setReady(true);
    }
  }, []);

  // Load once on startup, then follow every storage write.
  useEffect(() => {
    void reload();
    removeLegacyKeys().catch(() => {});
    return subscribeAuthSession(() => {
      void reload();
    });
  }, [reload]);

  const signOut = useCallback(async () => {
    await clearAuthSession();
    await signOutGoogleIfSignedIn();
  }, []);

  // Expired/invalid JWT on an authenticated request → end session, go to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (handlingUnauthorized.current) return;
      handlingUnauthorized.current = true;
      (async () => {
        try {
          await signOut();
          Alert.alert(
            i18n.t('auth.sessionExpiredTitle'),
            i18n.t('auth.sessionExpiredMsg')
          );
          router.push('/login');
        } catch {
          // ignore
        } finally {
          setTimeout(() => {
            handlingUnauthorized.current = false;
          }, 1500);
        }
      })();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, token, user, isLoggedIn: Boolean(token), signOut }),
    [ready, token, user, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
