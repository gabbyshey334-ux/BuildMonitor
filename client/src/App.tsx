import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import { ProjectProvider } from "@/contexts/ProjectContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import DemoPage from "@/pages/demo";
import NotFound from "@/pages/not-found";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import ProjectsPage from "@/pages/ProjectsPage";
import { AppLayout } from "@/components/layout/AppLayout";
import FullDashboard from "@/components/dashboard-new/DashboardPage";
import BudgetPage from "@/pages/BudgetPage";
import MaterialsPage from "@/pages/MaterialsPage";
import DailyPage from "@/pages/DailyPage";
import TrendsPage from "@/pages/TrendsPage";
import SettingsPage from "@/pages/SettingsPage";
import HelpPage from "@/pages/HelpPage";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function DashboardRoute() {
  const projectId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("project") || undefined : undefined;
  return (
    <AppLayout>
      <FullDashboard projectId={projectId} />
    </AppLayout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [forceReady, setForceReady] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setForceReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (isLoading && !forceReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to="/projects" /> : <Landing />}
      </Route>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/projects" /> : <Login />}
      </Route>
      <Route path="/signup">
        {isAuthenticated ? <Redirect to="/projects" /> : <Signup />}
      </Route>
      <Route path="/forgot-password">
        {isAuthenticated ? <Redirect to="/projects" /> : <ForgotPassword />}
      </Route>
      <Route path="/reset-password">
        {isAuthenticated ? <Redirect to="/projects" /> : <ResetPassword />}
      </Route>
      <Route path="/projects">
        {isAuthenticated ? (
          <AppLayout>
            <ProjectsPage />
          </AppLayout>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/dashboard">
        {isAuthenticated ? <DashboardRoute /> : <Redirect to="/login" />}
      </Route>
      <Route path="/budget">
        {isAuthenticated ? (
          <AppLayout>
            <BudgetPage />
          </AppLayout>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/materials">
        {isAuthenticated ? (
          <AppLayout>
            <MaterialsPage />
          </AppLayout>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/daily">
        {isAuthenticated ? (
          <AppLayout>
            <DailyPage />
          </AppLayout>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/trends">
        {isAuthenticated ? (
          <AppLayout>
            <TrendsPage />
          </AppLayout>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/settings">
        {isAuthenticated ? (
          <AppLayout>
            <SettingsPage />
          </AppLayout>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/help">
        {isAuthenticated ? (
          <AppLayout>
            <HelpPage />
          </AppLayout>
        ) : <Redirect to="/login" />}
      </Route>
      <Route path="/demo">
        <DemoPage />
      </Route>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ProjectProvider>
                <TooltipProvider>
                  <Toaster />
                  <Router />
                </TooltipProvider>
              </ProjectProvider>
            </AuthProvider>
          </QueryClientProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
