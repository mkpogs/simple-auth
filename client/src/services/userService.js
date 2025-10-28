import { updateProfile } from "../../../server/controllers/user.controller";
import api from "../utils/api";

/**
 * User Service
 * Maps to: /api/users/* routes
 *
 * RESPONSIBILITIES:
 *  - User profile management
 *  - Avatar upload/detete
 *  - Password changes
 *  - Account deletion
 */
export const userService = {
  // ===== PROFILE MANAGEMENT =====

  /**
   * GET /api/users/profile
   * This is the "getCurrentUser" equivalent!
   */
  getprofile: async () => {
    const response = await api.get("/users/profile");
    return response.data;
  },

  /**
   * PUT /api/users/profile
   */
  updateProfile: async (profileData) => {
    const response = await api.put("/users/profile", profileData);
    return response.data;
  },
};
