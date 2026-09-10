// Защита маршрутов: требует авторизацию и (опционально) роль.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { RoleType } from '@arbuz/shared';
import { useAuth } from '../auth/AuthContext';
import { StateMessage } from '../components/ui';

export interface ProtectedRouteProps {
  roles?: RoleType[];
  children: ReactNode;
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) return <StateMessage state="loading" message="Проверка сессии…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/forbidden" replace />;

  return <>{children}</>;
}
