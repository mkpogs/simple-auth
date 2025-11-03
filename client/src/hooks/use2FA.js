import { useDispatch, useSelector } from "react-redux";
import { useMutation, useQuery } from "@tanstack/react-query";
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

  /**
   * Disable 2FA - Turn off 2FA for user account
   */
  const disable2FAMutation = useMutation({
    mutationFn: ({ password, confirmationCode }) =>
      twoFactorService.disable(password, confirmationCode),

    // Before API call starts
    onMutate: () => {
      console.log("🔄 Disabling 2FA");
      dispatch(setLoading(true));
      dispatch(clearError());
    },

    // API call successful
    onSuccess: () => {
      console.log("✅ 2FA disabled successfully");

      // Update user profile to reflect 2FA disabled
      dispatch(
        updateUserProfile({
          twoFactorEnabled: false,
          twoFactorDisabledAt: new Date().toISOString(),
        })
      );

      toast.success(
        "2FA disabled successfully ⚠️\nYour account security has been reduced."
      );

      // Refresh 2FA status
      refetchStatus();
    },

    // API call failed
    onError: (error) => {
      console.error("❌ 2FA disable failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to disable 2FA. Please check your credentials.";

      dispatch(setError(errorMessage));
      toast.error(errorMessage);
    },

    // After API call settles
    onSettled: () => {
      dispatch(setLoading(false));
    },
  });

  /**
   * Regenerate Backup Codes - Generate new backup codes
   */
  const regenerateBackupCodesMutation = useMutation({
    mutationFn: twoFactorService.regenerateBackupCodes,

    // Before API call starts
    onMutate: () => {
      console.log("🔄 Regenerating backup codes");
      dispatch(setLoading(true));
      dispatch(clearError());
    },

    // API call successful
    onSuccess: (response) => {
      console.log("✅ Backup codes regenerated");

      toast.success(
        "New backup codes generated! 🔑\nPlease save them in a secure location."
      );

      return response; // Contains new backup codes
    },

    // API call failed
    onError: (error) => {
      console.error("❌ Backup codes regeneration failed:", error);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to generate backup codes. Please try again.";

      dispatch(setError(errorMessage));
      toast.error(errorMessage);
    },

    // After API call settles
    onSettled: () => {
      dispatch(setLoading(false));
    },
  });

  // ===== UTILITY FUNCTIONS =====
  /**
   * 🔍 Check if 2FA is enabled
   */
  const is2FAEnabled = () => {
    return twoFactorStatus?.enabled || user?.twoFactorEnabled || false;
  };

  /**
   * 🔍 Check if 2FA setup is in progress
   */
  const is2FASetupInProgress = () => {
    return enable2FAMutation.isSuccess && !verify2FASetupMutation.isSuccess;
  };

  /**
   * 🧹 Clear current error
   */
  const clear2FAError = () => {
    dispatch(clearError());
  };

  /**
   * 🔄 Refresh 2FA status
   */
  const refresh2FAStatus = () => {
    refetchStatus();
  };

  // ===== RETURN HOOK INTERFACE =====
  return {
    // *** 2FA STATUS ***
    twoFactorStatus,
    is2FAEnabled: is2FAEnabled(),
    is2FASetupInProgress: is2FASetupInProgress(),
    isStatusLoading,
    statusError,

    // *** 2FA DATA ***
    // QR code and secret from enable2FA response
    qrCodeData: enable2FAMutation.data,
    backupCodes: regenerateBackupCodesMutation.data?.backupCodes,

    // *** LOADING STATES ***
    isLoading:
      isLoading ||
      enable2FAMutation.isPending ||
      verify2FAMutation.isPending ||
      disable2FAMutation.isPending ||
      regenerateBackupCodesMutation.isPending ||
      isStatusLoading,

    // *** 2FA ACTIONS ***
    enable2FA: enable2FAMutation.mutate,
    verify2FASetup: verify2FAMutation.mutate,
    disable2FA: disable2FAMutation.mutate,
    regenerateBackupCodes: regenerateBackupCodesMutation.mutate,

    // *** UTILITIES ***
    clearError: clear2FAError,
    refreshStatus: refresh2FAStatus,

    // *** DETAILED MUTATION STATES ***
    mutations: {
      enable: {
        isPending: enable2FAMutation.isPending,
        isError: enable2FAMutation.isError,
        isSuccess: enable2FAMutation.isSuccess,
        error: enable2FAMutation.error,
        data: enable2FAMutation.data,
      },
      verifySetup: {
        isPending: verify2FAMutation.isPending,
        isError: verify2FAMutation.isError,
        isSuccess: verify2FAMutation.isSuccess,
        error: verify2FAMutation.error,
      },
      disable: {
        isPending: disable2FAMutation.isPending,
        isError: disable2FAMutation.isError,
        isSuccess: disable2FAMutation.isSuccess,
        error: disable2FAMutation.error,
      },
      regenerateBackupCodes: {
        isPending: regenerateBackupCodesMutation.isPending,
        isError: regenerateBackupCodesMutation.isError,
        isSuccess: regenerateBackupCodesMutation.isSuccess,
        error: regenerateBackupCodesMutation.error,
        data: regenerateBackupCodesMutation.data,
      },
    },

    // *** DEVELOPMENT HELPERS ***
    ...(import.meta.env.VITE_NODE_ENV === "development" && {
      _debug: {
        twoFactorStatus,
        mutations: {
          enable: enable2FAMutation,
          verifySetup: verify2FAMutation,
          disable: disable2FAMutation,
          regenerateBackupCodes: regenerateBackupCodesMutation,
        },
      },
    }),
  };
};

export default use2FA;
