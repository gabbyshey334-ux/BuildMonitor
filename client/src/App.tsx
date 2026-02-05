import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import DemoPage from "@/pages/demo";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardPageWrapper from "@/pages/DashboardPage";
import NotFound from "@/pages/not-found";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
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
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Landing />}
      </Route>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Login />}
      </Route>
      <Route path="/signup">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Signup />}
      </Route>
      <Route path="/forgot-password">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <ForgotPassword />}
      </Route>
      <Route path="/reset-password">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <ResetPassword />}
      </Route>
      <Route path="/dashboard">
        {isAuthenticated ? (
          <DashboardLayout>
            <Switch>
              <Route path="/dashboard" component={DashboardPageWrapper} />
              <Route path="/dashboard/budget" component={() => <div className="p-6">Budget Page - Coming Soon</div>} />
              <Route path="/dashboard/tasks" component={() => <div className="p-6">Tasks Page - Coming Soon</div>} />
              <Route path="/dashboard/materials" component={() => <div className="p-6">Materials Page - Coming Soon</div>} />
              <Route path="/dashboard/issues" component={() => <div className="p-6">Issues Page - Coming Soon</div>} />
              <Route path="/dashboard/photos" component={() => <div className="p-6">Photos Page - Coming Soon</div>} />
              <Route path="/dashboard/reports" component={() => <div className="p-6">Reports Page - Coming Soon</div>} />
              <Route path="/dashboard/settings" component={() => <div className="p-6">Settings Page - Coming Soon</div>} />
              <Route path="/dashboard/help" component={() => <div className="p-6">Help Page - Coming Soon</div>} />
            </Switch>
          </DashboardLayout>
        ) : (
          <Login />
        )}
      </Route>
      <Route path="/demo">
        <DemoPage />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={true}
        storageKey="jengatrack-theme"
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
