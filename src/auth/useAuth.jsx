import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { GOOGLE_CLIENT_ID, SCOPES } from '../config';

const AuthContext = createContext(null);

// Extract token from URL hash (after OAuth implicit redirect)
function getTokenFromHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    // Check for fresh token from OAuth redirect hash first
    const hashToken = getTokenFromHash();
    if (hashToken) {
      sessionStorage.setItem('auth_token', hashToken);
      // Clean hash from URL
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return hashToken;
    }
    return sessionStorage.getItem('auth_token') || null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const userFetched = useRef(false);

  const isSignedIn = !!token;

  // Fetch user info when token is available
  useEffect(() => {
    if (!token) {
      setUser(null);
      userFetched.current = false;
      return;
    }
    if (userFetched.current) return;
    userFetched.current = true;

    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          sessionStorage.removeItem('auth_token');
          setToken(null);
          userFetched.current = false;
          throw new Error('Token expired');
        }
        return res.json();
      })
      .then((info) => setUser({ name: info.name, email: info.email, picture: info.picture }))
      .catch(() => {});
  }, [token]);

  const signIn = useCallback(() => {
    // For localhost: redirect to bare origin (Google doesn't allow paths for implicit flow on localhost)
    // For production: redirect to the app path
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const redirectUri = isLocalhost
      ? window.location.origin + '/'
      : window.location.origin + '/my-tracker/';

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: SCOPES,
      include_granted_scopes: 'true',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }, []);

  const signOut = useCallback(() => {
    if (token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {});
    }
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('auth_token');
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isSignedIn, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
