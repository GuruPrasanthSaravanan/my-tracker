import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { GOOGLE_CLIENT_ID, SCOPES } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isSignedIn = !!token;

  const signIn = useCallback(() => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.access_token) {
          setToken(response.access_token);
          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          })
            .then((res) => res.json())
            .then((info) => setUser({ name: info.name, email: info.email, picture: info.picture }));
        }
      },
    });
    client.requestAccessToken();
  }, []);

  const signOut = useCallback(() => {
    if (token) {
      window.google.accounts.oauth2.revoke(token);
    }
    setToken(null);
    setUser(null);
  }, [token]);

  useEffect(() => {
    const checkGIS = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(checkGIS);
        setIsLoading(false);
      }
    }, 100);
    return () => clearInterval(checkGIS);
  }, []);

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
