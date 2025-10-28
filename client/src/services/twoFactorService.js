import api from "../utils/api";

/**
 * Two-Factor Authentication Service
 * Maps to: /api/2fa/* routes
 *
 * RESPONSIBILITIES:
 *  - 2FA setup and verification
 *  - Backup codes management
 *  - 2FA login verification
 *  - 2FA status checking
 *  - 2FA Disabling
 */
export const twoFactorService = {
  // ===== 2FA STATUS =====

  /**
   * GET /api/2fa/status
   */
  getStatus: async () => {
    const response = await api.get("/2fa/status");
    return response.data;
  },
};
