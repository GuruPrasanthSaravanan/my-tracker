import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { fetchLists } from '../api/lists';

export function useLists() {
  const { token } = useAuth();
  const [lists, setLists] = useState({ accounts: [], types: [], vendors: [], projects: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    fetchLists(token)
      .then(setLists)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  return { lists, isLoading };
}
