import { useAuth } from '../auth/useAuth';

export default function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen pb-16">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">MyTracker</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button onClick={signOut} className="text-xs text-red-500">Sign out</button>
        </div>
      </header>
      <main className="p-4">
        <p className="text-gray-500">Signed in! Pages coming next...</p>
      </main>
    </div>
  );
}
