import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import CalculatorDashboard from './components/CalculatorDashboard';
import LoginView from './components/LoginView';
import { authRepository } from './services/apiRepository';
import type { UserProfile } from './types/rolecalc';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const hydrateSession = async () => {
      try {
        const current = await authRepository.getCurrentUser();
        if (active) {
          setUser(current);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsCheckingSession(false);
        }
      }
    };
    void hydrateSession();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await authRepository.logout();
    setUser(null);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" aria-hidden="true" />
          <span>Memuat sesi RoleCalc...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onAuthenticated={setUser} />;
  }

  return <CalculatorDashboard user={user} onLogout={handleLogout} />;
}
