import api from "../utils/api.js";

/**
 * Admin Service
 * Maps to: /api/admin/* routes
 *
 * RESPONSIBILITIES:
 *  - User Management (admin/moderator only)
 *  - System Statistics
 *  - Role and Status Management
 *
 * ACCESS: "ONLY" admin and moderator roles
 */
export const adminService = {
  // ===== DASHBOARD =====

  /**
   * GET /api/admin/stats
   * Get admin dashboard statistics
   */
  getStats: async () => {
    const response = await api.get("/admin/stats");
    return response.data;
  },
};
