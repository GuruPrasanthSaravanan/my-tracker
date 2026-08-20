import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { fetchLists, addToList } from '../api/lists';

export function useLists() {
  const { token } = useAuth();
  const [lists, setLists] = useState({ accounts: [], types: [], vendors: [], projects: [] });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    fetchLists(token)
      .then(setLists)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const addListItem = useCallback(async (listName, value) => {
    if (!token) return value;
    const result = await addToList(token, listName, value);
    if (result.added) {
      // Optimistically add to local state so dropdown updates immediately
      setLists((prev) => ({
        ...prev,
        [listName]: [...prev[listName], result.value],
      }));
    }
    // Return the actual value used (may differ in case/whitespace if a duplicate was found)
    // so the caller can select it even when no new row was written.
    return result.value;
  }, [token]);

  return { lists, isLoading, addListItem, refresh };
}
