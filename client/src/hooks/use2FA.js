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
};

export default use2FA;
