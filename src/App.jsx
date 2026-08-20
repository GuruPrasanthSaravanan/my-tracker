import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/useAuth';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { isSignedIn, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/my-tracker">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
