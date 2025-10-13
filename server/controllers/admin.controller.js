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

// ===== GET USER BY ID (ADMIN) =====
/**
 * GET /api/admin/users/:id
 *
 * PURPOSE: Get detailed information about specific user
 * REAL-WORLD USE: Admin  viewing  user profile details
 */
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("🔍 Admin fetching user details:", id);

    // Step 1: Find user by ID
    const user = await User.findById(id)
      .select("-password -refreshTokens -twoFactorAuth.secret")
      .lean();

    if (!user) return next(new AppError("User not found", 404));

    console.log("✅ User details fetched:", user.email);

    // Step 2: Return response
    return res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      data: { user },
    });
  } catch (error) {
    console.error("❌ Get User By ID Error:", error);
    next(new AppError("Failed to fetch user details", 500));
  }
};

// ===== UPDATE USER ROLE =====
/**
 * PUT /api/admin/users/:id/role
 *
 * PURPOSE: Change user's role (user, moderator, admin)
 * REAL-WORLD USE: Promoting user to moderator or admin
 *
 * SECURITY:
 *  - Admin only access
 *  - Cannot demote other admins (unless super admin)
 *  - logs role changes for audit
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    console.log("👑 Admin updating user role:", { userId: id, newRole: role });

    // Step 1: Validate new role
    if (!["user", "moderator", "admin"].includes(role)) {
      return next(
        new AppError("Invalid role. Must be user, moderator, or admin", 400)
      );
    }

    // Step 2: Find target user
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return next(new AppError("User not found", 404));
    }

    // Step 3: Security checks
    if (req.user._id.toString() === id) {
      return next(new AppError("You cannot change your own role", 400));
    }

    // Prevent changing other admin roles (unless implemented super admin)
    if (targetUser.role === "admin" && req.user.role === "admin") {
      return next(new AppError("Admins cannot change other admin roles", 403));
    }

    const oldRole = targetUser.role;

    // Step 4: Update user role
    targetUser.role = role;
    targetUser.updatedAt = new Date();
    await targetUser.save();

    console.log("✅ User role updated:", {
      user: targetUser.email,
      oldRole,
      newRole: role,
    });

    // Step 5: Return success response
    return res.status(200).json({
      success: true,
      message: `User role updated from ${oldRole} to ${role} successfully`,
      data: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          updatedAt: targetUser.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ Update User Role Error:", error);
    next(new AppError("Failed to update user role", 500));
  }
};

// ===== UPDATE USER STATUS =====
/**
 * PUT /api/admin/users/:id/status
 *
 * PURPOSE: Change user's account status (active, suspended, banned)
 * REAL-WORLD USE: Suspending problematic users, activating accounts
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountStatus, reason } = req.body;

    console.log("🚫 Admin updating user status:", {
      userId: id,
      status: accountStatus,
    });

    // Step 1: Validate status
    if (!["active", "suspended", "banned", "pending"].includes(accountStatus)) {
      return next(
        new AppError(
          "Invalid status. Must be active, suspended, banned, or pending",
          400
        )
      );
    }

    // Step 2: Find target user
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return next(new AppError("User not found", 404));
    }

    // Step 3: Security Checks
    if (req.user._id.toString() === id) {
      return next(
        new AppError("You cannot change your own account status", 400)
      );
    }

    if (!canModifyUser(req.user, targetUser)) {
      return next(
        new AppError("Insufficient permissions to modify this user", 403)
      );
    }

    const oldStatus = targetUser.accountStatus;

    // STEP 4: Update user status
    targetUser.accountStatus = accountStatus;
    targetUser.updatedAt = new Date();

    // Clear refresh tokens if suspending/banning (logout user)
    if (["suspended", "banned"].includes(accountStatus)) {
      targetUser.refreshTokens = [];
    }

    await targetUser.save();

    console.log("✅ User status updated:", {
      user: targetUser.email,
      oldStatus,
      newStatus: accountStatus,
      reason,
    });

    // STEP 5: Return success response
    return res.status(200).json({
      success: true,
      message: `User account ${
        accountStatus === "active" ? "activated" : accountStatus
      }`,
      data: {
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          accountStatus: targetUser.accountStatus,
          updatedAt: targetUser.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("❌ Update User Status Error:", error);
    next(new AppError("Failed to update user status", 500));
  }
};
