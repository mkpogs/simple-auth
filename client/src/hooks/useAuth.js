import { useDispatch, useSelector } from "react-redux";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  loginStart,
  loginSuccess,
  loginRequires2FA,
  twoFactorSuccess,
  loginFailure,
  logout as logoutAction,
  clearError,
  setError,
  setLoading,
  selectAuth,
  selectIsAuthenticated,
  selectUser,
  selectIsLoading,
  selectRequires2FA,
  selectAuthError,
  selectTwoFactorData,
  selectUserRole,
} from "../store/slices/authSlice";
import { authService, twoFactorService } from "../services";

/**
 * 🪝 useAuth Hook - Authentication Made simple
 *
 * WHAT IT DOES:
 *  - Provides all authentication functionality in one place
 *  - Handles login, logout, register with automatic error management
 *  - Manages 2FA flows seamlessly
 *  - Syncs with Redux store and localStorage
 *  - Shows user friendly toast notifications
 *
 * WHY CUSTOM HOOK:
 *  - Components don't need to know about Redux complexity
 *  - Centralized auth logic for easier maintenance
 *  - Consistent error handling across the entire app
 *  - Automatic loading states and notifications
 *  - Easy to test and refactor
 *
 * HOW TO USE:
 *  - const { login, logout, user, isLoading, error } = useAuth();
 */
export const useAuth = () => {};

export default useAuth;
