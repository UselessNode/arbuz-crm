// Редирект с корня в зависимости от роли.
import { Navigate } from 'react-router-dom';
import { StateMessage } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { Roles } from '../lib/roles';

export function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <StateMessage state="loading" message="Проверка сессии…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === Roles.admin ? '/admin' : '/account'} replace />;
}
