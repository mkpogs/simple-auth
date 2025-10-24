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
};
