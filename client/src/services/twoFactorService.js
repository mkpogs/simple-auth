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

  // ===== 2FA SETUP =====

  /**
   * POST /api/2fa/enable
   * Returns QR code and secret for setup
   */
  enable: async () => {
    const response = await api.post("/2fa/enable");
    return response.data;
  },

  /**
   * POST /api/2fa/verify
   * Verify 2FA setup with TOTP token
   */
  verifySetup: async (token) => {
    const response = await api.post("/2fa/verify", { token });
    return response.data;
  },

  /**
   * DELETE /api/2fa/disable
   * Disable 2FA for user
   */
  disable: async (password, confirmationCode) => {
    const response = await api.delete("/2fa/disable", {
      data: { password, confirmationCode },
    });
    return response.data;
  },

  // ===== LOGIN VERIFICATION =====

  /**
   * POST /api/2fa/verify-login
   * Verify 2FA token during login
   */
  verifyLogin: async (verificationData) => {
    const response = await api.post("/2fa/verify-login", verificationData);
    return response.data;
  },

  // ===== BACKUP CODES =====

  /**
   * POST /api/2fa/backup-codes/regenerate
   * Generate new backup codes
   */
  regenerateBackupCodes: async (password) => {
    const response = await api.post("/2fa/backup-codes/regenerate", {
      password,
    });
    return response.data;
  },
};
