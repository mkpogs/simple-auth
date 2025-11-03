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
export const useAuth = () => {
  const dispatch = useDispatch();

  // ===== SELECTORS - Get Data from Redux Store =====
  const auth = useSelector(selectAuth);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const isLoading = useSelector(selectIsLoading);
  const requiresTwoFactor = useSelector(selectRequires2FA);
  const error = useSelector(selectAuthError);
  const twoFactorData = useSelector(selectTwoFactorData);
  const userRole = useSelector(selectUserRole);

  // ===== MUTATIONS - Define API Calls =====

  /**
   * Login Mutation - Handles user login with 2FA support
   */
  const loginMutation = useMutation({
    mutationFn: authService.login,

    // Before API call starts
    onMutate: (credentials) => {
      console.log("Starting Login for:", credentials.email);
      dispatch(loginStart());
      dispatch(clearError());
    },

    // API call successful
    onSuccess: (response, credentials) => {
      console.log("✅ Login API successful:", {
        requiresTwoFactor: response.requiresTwoFactor,
        user: response.user?.name,
      });

      if (response.requiresTwoFactor) {
        // Login valid but needs 2FA verification
        console.log("🔐 2FA required for user:", credentials.email);

        dispatch(
          loginRequires2FA({
            tempUserId: response.tempUserId,
            email: credentials.email,
          })
        );
        toast.success(`Verification code sent to ${credentials.email}`);
      } else {
        // Complete login success - no 2FA needed
        console.log("✅ Login completed successfully");

        dispatch(
          loginSuccess({
            user: response.user,
            tokens: response.tokens,
          })
        );

        toast.success(`Welcome back, ${response.user.name}! 🎉`);
      }
    },

    // API call failed
    onError: (error) => {
      console.error("❌ Login failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Login failed. Please try again.";

      dispatch(loginFailure(errorMessage));
      toast.error(errorMessage);
    },
  });

  /**
   * Register Mutation - Handles new user registration
   */
  const registerMutation = useMutation({
    mutationFn: authService.register,

    // Before API call starts
    onMutate: (userData) => {
      console.log("Starting Registration for:", userData.email);
      dispatch(setLoading(true));
      dispatch(clearError());
    },

    // API call successful
    onSuccess: (response, userData) => {
      console.log("✅ Registration successful");

      toast.success(
        `Registration successful! 📧\nPlease check ${userData.email} for verification code.`,
        { duration: 5000 }
      );

      // Registration doesn't auto-login - user needs to verify email first
      dispatch(setLoading(false));
    },

    // API call failed
    onError: (error) => {
      console.error("❌ Registration failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Registration failed. Please try again.";

      dispatch(setError(errorMessage));
      toast.error(errorMessage);
    },

    // After API call settles
    onSettled: () => {
      dispatch(setLoading(false));
    },
  });

  /**
   * 2FA Verification Mutation - Complete login with 2FA code
   */
  const verify2FAMutation = useMutation({
    mutationFn: twoFactorService.verifyLogin,

    // Before API call starts
    onMutate: (verificationData) => {
      console.log("🔄 Starting 2FA verification");
      dispatch(setLoading(true));
      dispatch(clearError());
    },

    // API call successful
    onSuccess: (response) => {
      console.log("✅ 2FA verification successful:", response.user.name);

      dispatch(
        twoFactorSuccess({
          user: response.user,
          tokens: response.tokens,
        })
      );

      toast.success(`Welcome back, ${response.user.name}! 🎉`);
    },

    // API call failed
    onError: (error) => {
      console.error("❌ 2FA verification failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Invalid verification code. Please try again.";

      dispatch(loginFailure(errorMessage));
      toast.error(errorMessage);
    },
  });

  /**
   * Logout Mutation - Sign out user
   */
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(auth.refreshToken),

    // Before API call starts
    onMutate: () => {
      console.log("🔄 Starting logout process");
    },

    // API call successful
    onSuccess: () => {
      console.log("✅ Logout API successful");
      dispatch(logoutAction());
      toast.success("Logged out successfully 👋");
    },

    // API call failed
    onError: (error) => {
      console.error("❌ Logout API error:", error);
      // Even if API fails, clear local data for security
      dispatch(logoutAction());
      toast.success("Logged out👋");
    },
  });

  /**
   * Email Verification Mutation - Verify email with OTP code
   */
  const verifyEmailMutation = useMutation({
    mutationFn: authService.verifyOTP,

    // Before API call starts
    onMutate: (verificationData) => {
      console.log("🔄 Starting email verification");
      dispatch(setLoading(true));
      dispatch(clearError());
    },

    // API call successful
    onSuccess: (response) => {
      console.log("✅ Email verification successful");

      toast.success(
        "Email verified successfully! ✅\nYou can now login with your credentials."
      );
      dispatch(setLoading(false));
    },

    // API call failed
    onError: (error) => {
      console.error("❌ Email verification failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Verification failed. Please check your code.";

      dispatch(setError(errorMessage));
      toast.error(errorMessage);
    },

    // After API call settles
    onSettled: () => {
      dispatch(setLoading(false));
    },
  });

  /**
   * Resend OTP Mutation - Send new verification code to email
   */
  const resendOTPMutation = useMutation({
    mutationFn: authService.resendOTP,

    // On successful resend
    onSuccess: (response, email) => {
      console.log("✅ OTP resent successfully");
      toast.success(`New verification code sent to ${email} 📧`);
    },

    onError: (error) => {
      console.error("❌ Resend OTP failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to send verification code.";
      toast.error(errorMessage);
    },
  });

  /**
   * Forgot Password Mutation - Send password reset email
   */
  const forgotPasswordMutation = useMutation({
    mutationFn: authService.forgotPassword,

    onSuccess: (response, email) => {
      console.log("✅ Password reset email sent");
      toast.success(`Password reset instructions sent to ${email} 📧`);
    },

    onError: (error) => {
      console.error("❌ Forgot password failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to send reset email.";
      toast.error(errorMessage);
    },
  });
};

export default useAuth;
