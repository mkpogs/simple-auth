import { useDispatch, useSelector } from "react-redux";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  setLoading,
  setError,
  clearError,
  updateUserProfile,
  selectUser,
  selectIsLoading,
} from "../store/slices/authSlice";
import { twoFactorService } from "../services";
import { queryKeys } from "../lib/queryClient";

/**
 * 🪝 use2FA Hook - Two-Factor Authentication Management
 *
 * WHAT IT DOES:
 *  - Manages 2FA setup, verification, and disable
 *  - Handles backup codes generation
 *  - Provides 2FA status checking
 *  - Integrates with Redux store and tanStack Query
 *  - Shows user-friendly notifications
 *
 * WHY SEPARATE FROM useAuth:
 *  - 2FA is a distinct feature set
 *  - keeps useAuth focused on core authentication
 *  - Better code organization and maintainability
 *  - Can be used independently in security settings
 *
 * HOW TO USE:
 * - const { enable2FA, disable2FA, is2FAEnabled, qrCode } = use2FA();
 */
export const use2FA = () => {
  const dispatch = useDispatch();

  // ===== SELECTORS =====
  const user = useSelector(selectUser);
  const isLoading = useSelector(selectIsLoading);

  // ===== 2FA STATUS QUERY =====
  /**
   * 🔍 Get 2FA Status - Checks if 2FA is enabled for the user
   */
  const {
    data: twoFactorStatus,
    isLoading: isStatusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: queryKeys.twoFactor.status,
    queryFn: twoFactorService.getStatus,
    enabled: !!user, // Only run if user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // ===== MUTATIONS =====

  /**
   * 🔐 Enable 2FA Mutation - Initiates 2FA setup process
   *  - Returns QR code and secret for authenticator app
   */
  const enable2FAMutation = useMutation({
    mutationFn: twoFactorService.enable,

    // Before API call starts
    onMutate: () => {
      console.log("🔄 Starting 2FA setup");
      dispatch(setLoading(true));
      dispatch(clearError());
    },

    // API call successful
    onSuccess: (response) => {
      console.log("✅ 2FA setup initiated");

      toast.success(
        "2FA setup started! 🔐\nScan the QR code with your authenticator app."
      );
      dispatch(setLoading(false));

      // Response contains QR code and secret
      return response;
    },

    // API call failed
    onError: (error) => {
      console.error("❌ 2FA setup failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to setup 2FA. Please try again.";

      dispatch(setError(errorMessage));
      toast.error(errorMessage);
    },

    // After API call settles
    onSettled: () => {
      dispatch(setLoading(false));
    },
  });

  /**
   * Verify 2FA Setup - Complete 2FA setup with TOTP code
   */
  const verify2FAMutation = useMutation({
    mutationFn: twoFactorService.verifySetup,

    // Before API call starts
    onMutate: (token) => {
      console.log("🔄 Verifying 2FA setup");
      dispatch(setLoading(true));
      dispatch(clearError());
    },

    // API call successful
    onSuccess: (response) => {
      console.log("✅ 2FA setup completed");

      // Update user profile to reflect 2FA enabled
      dispatch(
        updateUserProfile({
          twoFactorEnabled: true,
          twoFactorSetupAt: new Date().toISOString(),
        })
      );

      toast.success(
        "2FA enabled successfully! 🎉\nYour account is now more secure."
      );

      // Refresh 2FA status
      refetchStatus();
    },

    // API call failed
    onError: (error) => {
      console.error("❌ 2FA setup verification failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Invalid verification code. Please try again.";

      dispatch(setError(errorMessage));
      toast.error(errorMessage);
    },

    // After API call settles
    onSettled: () => {
      dispatch(setLoading(false));
    },
  });
};

export default use2FA;
