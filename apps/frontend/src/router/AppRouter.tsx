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
import { ExpertApplicationsPage } from '../features/expert/ExpertApplicationsPage';
import { ReviewsPage } from '../features/reviews/ReviewsPage';
import { PostsPage } from '../features/posts/PostsPage';
import { PostEditorPage } from '../features/posts/PostEditorPage';
import { ContestSettingsPage } from '../features/references/ContestSettingsPage';
import { ExpertiseSettingsPage } from '../features/references/ExpertiseSettingsPage';
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
        <Route
          path="/expert"
          element={
            <ProtectedRoute roles={[Roles.expert]}>
              <ExpertApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expert/applications/:applicationId"
          element={
            <ProtectedRoute roles={[Roles.expert]}>
              <ApplicationDetailPage area="expert" />
            </ProtectedRoute>
          }
        />
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
        <Route path="posts/new" element={<PostEditorPage />} />
        <Route path="posts/:postId" element={<PostEditorPage />} />
        <Route path="contests" element={<ContestSettingsPage />} />
        <Route path="tenders" element={<Navigate to="/admin/contests" replace />} />
        <Route path="directions" element={<Navigate to="/admin/contests" replace />} />
        <Route path="expertise" element={<ExpertiseSettingsPage />} />
        <Route path="statuses" element={<Navigate to="/admin/expertise" replace />} />
      </Route>

      <Route path="design-system" element={<DesignSystemPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
