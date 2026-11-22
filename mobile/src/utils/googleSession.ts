import { Platform } from 'react-native';

interface GoogleSigninLike {
  signOut?: () => Promise<unknown>;
  hasPreviousSignIn?: () => boolean;
  getCurrentUser?: () => unknown | null;
}

function getGoogleSignin(): GoogleSigninLike | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin') as { GoogleSignin?: GoogleSigninLike };
    return mod?.GoogleSignin ?? null;
  } catch {
    return null;
  }
}

/**
 * Signs the native Google session out (without revoking app consent) when one
 * exists. Used on app logout and before letting the user pick another account.
 * Never throws.
 */
export async function signOutGoogleIfSignedIn(): Promise<void> {
  const google = getGoogleSignin();
  if (!google?.signOut) return;
  try {
    const signedIn = Boolean(google.hasPreviousSignIn?.() || google.getCurrentUser?.());
    if (signedIn) {
      await google.signOut();
    }
  } catch {
    // ignore: Google session state is best-effort
  }
}
