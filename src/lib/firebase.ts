import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Provider for Google Sheets API access
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;

const TOKEN_STORAGE_KEY = 'sheets_access_token_session';
const TOKEN_EXPIRY_KEY = 'sheets_access_token_expiry';
const USER_INFO_KEY = 'sheets_user_info';

// Get cached access token from memory or persistent session
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
})();

/**
 * Checks if the current token has expired or is absent.
 */
export const isAccessTokenExpired = (): boolean => {
  try {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return !cachedAccessToken;
    return Date.now() > parseInt(expiry, 10);
  } catch {
    return true;
  }
};

/**
 * Initializes the auth state listener.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        localStorage.setItem(
          USER_INFO_KEY,
          JSON.stringify({
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          })
        );
      } catch {}

      const token = cachedAccessToken || localStorage.getItem(TOKEN_STORAGE_KEY);
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      cachedAccessToken = null;
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Initiates the Google Sign-in popup and captures OAuth access token for Google Sheets.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso da conta Google.');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, cachedAccessToken);
      // Google OAuth access tokens expire in 60 minutes. Set expiry to 55 minutes for safety margin.
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 55 * 60 * 1000));
    } catch {}

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Gets the current cached access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    try {
      cachedAccessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {}
  }
  return cachedAccessToken;
};

/**
 * Clears cached access token when expired or invalid.
 */
export const clearStoredToken = (): void => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {}
};

/**
 * Signs the user out and clears cache.
 */
export const logout = async (): Promise<void> => {
  await signOut(auth);
  clearStoredToken();
};
