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

  // ===== USER MANAGEMENT =====

  /**
   * GET /api/admin/users
   * Get all users with filtering
   */
  getUsers: async (params = {}) => {
    const response = await api.get("/admin/users", { params });
    return response.data;
  },

  /**
   * GET /api/admin/users/:id
   * Get specific user details by ID
   */
  getUser: async (userId) => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  /**
   * PUT /api/admin/users/:id/role
   * Update user role (e.g., user, moderator, admin)
   */
  updateUserRole: async (userId, role) => {
    const response = await api.put(`/admin/users/${userId}/role`, { role });
    return response.data;
  },

  /**
   * PUT /api/admin/users/:id/status
   * Update user account status (e.g., active, suspended, banned, pending)
   */
  updateUserStatus: async (userId, status) => {
    const response = await api.put(`/admin/users/${userId}/status`, { status });
    return response.data;
  },

  /**
   * DELETE /api/admin/users/:id
   * Delete user account (admin only)
   */
  deleteUser: async (userId) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },
};
