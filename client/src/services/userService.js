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

  // ===== AVATAR MANAGEMENT =====

  /**
   * POST /api/users/avatar
   */
  uploadAvatar: async (file, onProgress) => {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await api.post("/users/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (ProgressEvent) => {
        const progress = Math.round(
          (ProgressEvent.loaded * 100) / ProgressEvent.total
        );
        onProgress?.(progress);
      },
    });
    return response.data;
  },

  /**
   * DELETE /api/users/avatar
   */
  deleteAvatar: async () => {
    const response = await api.delete("/users/avatar");
    return response.data;
  },
};
