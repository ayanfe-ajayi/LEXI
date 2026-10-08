import { Component, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { DataProvider } from "./providers/DataProvider";
import { UIProvider } from "./providers/UIProvider";
import { Layout } from "../components/Layout";
import { Spinner } from "../components/ui";
import { Login } from "../pages/Login";
import { Dashboard } from "../pages/Dashboard";
import { Vocabulary } from "../pages/Vocabulary";
import { WordDetails } from "../pages/WordDetails";
import { Review } from "../pages/Review";
import { ReverseSearch } from "../pages/ReverseSearch";
import { Tutor } from "../pages/Tutor";
import { ProgressPage } from "../pages/Progress";
import { SettingsPage } from "../pages/Settings";
function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Opening your learning space…" />;
  return user ? (
    <DataProvider key={user.id}>
      <Outlet />
    </DataProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <h1>Let’s try that again.</h1>
        <p>
          Lexi hit an unexpected problem. Your saved words are safe in your
          account.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload Lexi
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <UIProvider>
          <BrowserRouter>
            <a className="skip-link" href="#main-content">
              Skip to content
            </a>
            <Routes>
              <Route path="/" element={<Login welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<Login reset />} />
              <Route element={<Protected />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/vocabulary" element={<Vocabulary />} />
                  <Route path="/words/:id" element={<WordDetails />} />
                  <Route path="/review" element={<Review />} />
                  <Route path="/quiz" element={<Review quiz />} />
                  <Route path="/search" element={<ReverseSearch />} />
                  <Route path="/tutor" element={<Tutor />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </UIProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
