// Маршруты приложения: публичная зона, личный кабинет, админ-раздел.
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { UsersPage } from '../features/users/UsersPage';
import { ApplicationsPage } from '../features/applications/ApplicationsPage';
import { ApplicantApplicationsPage } from '../features/applications/ApplicantApplicationsPage';
import { ApplicationDetailPage } from '../features/applications/ApplicationDetailPage';
import { ReviewsPage } from '../features/reviews/ReviewsPage';
import { PostsPage } from '../features/posts/PostsPage';
import { TendersPage } from '../features/references/TendersPage';
import { DirectionsPage } from '../features/references/DirectionsPage';
import { StatusesPage } from '../features/references/StatusesPage';
import { DesignSystemPage } from '../pages/DesignSystemPage/DesignSystemPage';
import { HomePage } from '../pages/HomePage/HomePage';
import { AboutPage } from '../pages/AboutPage';
import { PrivacyPolicyPage } from '../pages/PrivacyPolicyPage';
import { AccountPage } from '../pages/AccountPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { Roles } from '../lib/roles';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/account" element={<AccountPage />} />
        <Route path="/applications" element={<ApplicantApplicationsPage />} />
        <Route path="/applications/:applicationId" element={<ApplicationDetailPage area="applicant" />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={[Roles.admin]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="applications/:applicationId" element={<ApplicationDetailPage area="admin" />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="tenders" element={<TendersPage />} />
        <Route path="directions" element={<DirectionsPage />} />
        <Route path="statuses" element={<StatusesPage />} />
        <Route path="design-system" element={<DesignSystemPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
