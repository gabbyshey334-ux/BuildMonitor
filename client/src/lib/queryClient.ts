import { QueryClient, QueryFunction } from "@tanstack/react-query";

// User-friendly error messages for common HTTP status codes
const USER_FRIENDLY_ERRORS: Record<number, string> = {
  400: 'Please check the information you entered',
  401: 'You need to log in to access this feature',
  403: 'You do not have permission to perform this action',
  404: 'The requested item was not found',
  409: 'This item already exists or conflicts with existing data',
  422: 'The information provided is not valid',
  429: 'Too many requests. Please wait a moment and try again',
  500: 'Something went wrong. Please try again later',
  502: 'Service is temporarily unavailable. Please try again later',
  503: 'Service is temporarily unavailable. Please try again later',
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse JSON error response from server
      const errorData = await res.json();
      
      // If server provides a user-friendly message, use it
      if (errorData.message) {
        throw new Error(errorData.message);
      }
      
      // Fall back to status-based message
      const userMessage = USER_FRIENDLY_ERRORS[res.status] || 'An unexpected error occurred';
      throw new Error(userMessage);
    } catch (parseError) {
      // If JSON parsing fails, use status-based message
      const userMessage = USER_FRIENDLY_ERRORS[res.status] || 'An unexpected error occurred';
      throw new Error(userMessage);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
