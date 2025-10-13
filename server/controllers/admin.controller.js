import User from "../models/User.model.js";
import AppError from "../utils/AppError.js";
import { canModifyUser, getRoleLevel } from "../middlewares/rbac.middleware.js";

// ===== GET ALL USERS (ADMIN DASHBOARD) =====
/**
 * GET /api/admin/users
 *
 * PURPOSE: List all users with pagination and filtering
 * REAL-WORLD USE: Admin dashboard user management
 *
 * QUERY PARAMETERS:
 *  - page: Page number (default: 1)
 *  - limit: Items per page (default: 10, max: 50)
 *  - role: Filter by role (user, moderator, admin)
 *  - status: Filter by account status
 *  - search: Search by name or email
 *  - isVerified: Filter by email verification status
 *
 * SECURITY:
 *  - Admin only access
 *  - Excludes sensitive fields (passwords, tokens)
 */
export const getAllUsers = async (req, res, next) => {
  try {
    console.log("📊 Admin fetching all users:", req.user.email);

    // Step 1: Extract query parameters
    const {
      page = 1,
      limit = 10,
      role,
      status,
      search,
      isVerified,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Step 2: Validate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 per page
    const skip = (pageNum - 1) * limitNum;

    // Step 3: Build filter query
    const filter = {};

    if (role && ["user", "moderator", "admin"].includes(role)) {
      filter.role = role;
    }

    if (
      status &&
      ["active", "suspended", "banned", "pending"].includes(status)
    ) {
      filter.accountStatus = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    console.log("🔍 Filter applied:", filter);

    // Step 4: Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Step 5: Execute queries
    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select(
          "-password -refreshTokens -twoFactorAuth.secret -otpCode -otpExpiresAt"
        )
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean for better performance
      User.countDocuments(filter),
    ]);

    // Step 6: Calculate pagination info
    const totalPages = Math.ceil(totalUsers / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    console.log("✅ Users fetched successfully:", {
      count: users.length,
      total: totalUsers,
      page: pageNum,
    });

    // Step 7: Return response
    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalUsers,
          hasNextPage,
          hasPrevPage,
          limit: limitNum,
        },
        filters: {
          role,
          status,
          search,
          isVerified,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("❌ Get All Users Error:", error);
    next(new AppError("Failed to fetch users", 500));
  }
};
