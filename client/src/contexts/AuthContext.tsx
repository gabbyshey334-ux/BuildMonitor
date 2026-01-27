import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// User interface matching backend API response
export interface User {
  id: string;
  fullName: string;
  whatsappNumber?: string;
  defaultCurrency?: string;
  preferredLanguage?: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch current user from backend
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        // If unauthorized, user is not logged in (this is expected)
        if (res.status === 401) {
          return null;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch user profile");
        }

        const data = await res.json();
        
        if (!data.success || !data.user) {
          return null;
        }

        return data.user;
      } catch (error: any) {
        console.error("[Auth] Error fetching user:", error);
        // Don't throw - just return null for unauthenticated state
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Login failed");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      console.log("[Auth] Login successful:", data.user?.fullName);
      
      // Update React Query cache with user data
      queryClient.setQueryData(["/api/auth/me"], data.user);
      
      // Show success toast
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user?.fullName || "User"}!`,
      });
      
      // Redirect to dashboard
      setLocation("/");
    },
    onError: (error: Error) => {
      console.error("[Auth] Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Logout failed");
      }

      return await res.json();
    },
    onSuccess: () => {
      console.log("[Auth] Logout successful");
      
      // Clear all React Query cache
      queryClient.clear();
      
      // Update auth state to null
      queryClient.setQueryData(["/api/auth/me"], null);
      
      // Show success toast
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      // Redirect to landing page
      setLocation("/");
    },
    onError: (error: Error) => {
      console.error("[Auth] Logout error:", error);
      
      // Even if logout fails on server, clear client state
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
      
      toast({
        title: "Logged out",
        description: "Session cleared locally.",
        variant: "default",
      });
      
      setLocation("/");
    },
  });

  // Login function
  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  // Logout function
  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  // Show error toast if auth check fails (but not for 401 - that's expected)
  if (error && !error.message.includes("401")) {
    console.error("[Auth] Auth check error:", error);
  }

  const value: AuthContextType = {
    user: user,
    isLoading: isLoading || loginMutation.isPending || logoutMutation.isPending,
    isAuthenticated: !!user,
    login,
    logout,
    refetch: () => refetch(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}

