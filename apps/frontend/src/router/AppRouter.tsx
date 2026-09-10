// Маршруты приложения.
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { UsersPage } from '../features/users/UsersPage';
import { ApplicationsPage } from '../features/applications/ApplicationsPage';
import { ApplicationDetailPage } from '../features/applications/ApplicationDetailPage';
import { ReviewsPage } from '../features/reviews/ReviewsPage';
import { PostsPage } from '../features/posts/PostsPage';
import { TendersPage } from '../features/references/TendersPage';
import { DirectionsPage } from '../features/references/DirectionsPage';
import { StatusesPage } from '../features/references/StatusesPage';
import { DesignSystemPage } from '../pages/DesignSystemPage/DesignSystemPage';
import { AccountPage } from '../pages/AccountPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { Roles } from '../lib/roles';
import { ProtectedRoute } from './ProtectedRoute';
import { HomeRedirect } from './HomeRedirect';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={[Roles.admin]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="applications/:applicationId" element={<ApplicationDetailPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="tenders" element={<TendersPage />} />
        <Route path="directions" element={<DirectionsPage />} />
        <Route path="statuses" element={<StatusesPage />} />
        <Route path="design-system" element={<DesignSystemPage />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
