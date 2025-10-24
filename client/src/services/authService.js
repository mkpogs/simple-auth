import api from "../utils/api";

/**
 * Authentication Service
 * Maps to: /api/auth/* routes
 *
 * RESPONSIBILITIES:
 *  - Login
 *  - Logout
 *  - Register
 *  - Password Reset
 *  - Email Verification
 *  - Token Refresh
 */
export const authService = {
  // ===== AUTHENTICATION =====
  /**
   * POST /api/auth/register
   */
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  /**
   * POST /api/auth/login
   */
  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    return response.data;
  },

  /**
   * POST /api/auth/logout
   */
  logout: async (refreshToken) => {
    const response = await api.post("/auth/logout", { refreshToken });
    return response.data;
  },

  // ===== EMAIL VERIFICATION =====
  /**
   * POST /api/auth/verify-otp
   */
  verifyOTP: async (verificationData) => {
    const response = await api.post("/auth/verify-otp", verificationData);
    return response.data;
  },

  /**
   * POST /api/auth/resend-otp
   */
  resendOTP: async (email) => {
    const response = await api.post("/auth/resend-otp", { email });
    return response.data;
  },

  // ===== PASSWORD RESET =====
  /**
   * POST /api/auth/forgot-password
   */
  forgotPassword: async (email) => {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
  },

  /**
   * POST /api/auth/reset-password
   */
  resetPassword: async (resetData) => {
    const response = await api.post("/auth/reset-password", resetData);
    return response.data;
  },
};
