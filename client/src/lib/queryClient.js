import { QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

/**
 * TanStack Query Client Configuration
 *
 * WHAT IT DOES:
 *  - Configures caching strategies for API calls
 *  - Sets up retry logic for failed requests
 *  - Handles background refetching
 *  - Manages error states
 *
 * WHY WE NEED IT:
 *  - Automatic caching (faster app performance)
 *  - Smart refetching (data always fresh)
 *  - Error handling (better user experience)
 *  - Optimistic updates (Instant UI feedback)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long data is considered "FRESH" (won't refetch)
      staleTime: 5 * 60 * 1000, // 5 minutes

      // How long data stays in cache when component unmounts
      cacheTime: 10 * 60 * 1000, // 10 minutes

      // Retry failed requests
      retry: (failureCount, error) => {
        // Don't retry 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 3 times for 5xx errors (server errors)
        return failureCount < 3;
      },

      // Refetch when window becomes visible (user comes back to tab)
      refetchOnWindowFocus: true,

      // Refetch on network reconnect
      refetchOnReconnect: true,

      // Show loading state  for at least 100ms (prevents flash)
      suspense: false,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,

      // Global error handling for mutations
      onError: (error) => {
        // Don't show toast for validation errors (handled by forms)
        if (error?.response?.status !== 422) {
          const message = error?.response?.data?.message || "Operation failed";
          toast.error(message);
        }
      },
    },
  },
});

/**
 * Query Key Factor
 *
 * WHAT IT DOES:
 *  - Creates consistent cache  keys for API calls
 *  - Helps with cache invalidation
 *  - Makes  debugging easier
 *
 * WHY WE NEED IT:
 *  - Prevents cache key typos
 *  - Easy to invalidate related queries
 *  - Better organization
 *
 * BASED ON API ENDPOINTS IN SERVER
 *  - /api/auth/*   (auth.routes.js)
 *  - /api/users/*  (user.routes.js)
 *  - /api/admin/*  (admin.routes.js)
 *  - /api/2fa/*    (twoFactor.routes.js)
 */
export const queryKeys = {
  // ===== AUTH QUERIES (/api/auth/*) =====
  auth: {
    // NOTE: No /auth/me - use /users/profile instead
    login: ["auth", "login"],
    register: ["auth", "register"],
    verify: (email) => ["auth", "verify-otp", email],
    refreshToken: ["auth", "refresh-token"],
  },

  // ===== USER QUERIES (/api/users/*) =====
  user: {
    profile: ["users", "profile"],
    avatar: ["user", "avatar"],
  },

  // ===== TWO-FACTOR QUERIES (/api/2fa/*) =====
  twoFactor: {
    status: ["2fa", "status"],
    enable: ["2fa", "enable"],
    verify: ["2fa", "verify"],
    disable: ["2fa", "disable"],
    backupCodes: ["2fa", "backup-codes"],
    verifyLogin: ["2fa", "verify-login"],
  },

  // ===== ADMIN QUERIES (/api/admin/*) =====
  admin: {
    stats: ["admin", "stats"],
    users: (filters) => ["admin", "users", filters],
    user: (id) => ["admin", "users", id],
  },
};
