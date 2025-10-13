import { admin } from "googleapis/build/src/apis/admin";
import AppError from "../utils/AppError.js";

/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * WHAT IT DOES:
 *  - Checks user roles and permissions
 *  - Restricts access based on user role
 *  - Provides flexible permission checking
 *
 * SECURITY:
 *  - Must be used "AFTER" protect middleware
 *  - Validates user role from the database
 *  - Prevents privilege escalation
 */

// ===== CHECK USER ROLES =====
/**
 * Role Authorization Middleware
 *
 * USAGE: router.get('/admin-only', protect, authorized(['admin']), controller)
 * USAGE: router.get('/admin-mod', protect, authorize(['admin', 'moderator']), controller)
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      console.log("🔐 Role authorization check:", {
        userRole: req.user?.role,
        allowedRoles,
        userId: req.user?._id,
      });

      // Step 1: Check if user exists (should be set by protect middleware)
      if (!req.user) {
        return next(new AppError("Access denied. Please login first.", 401));
      }

      //   Step 2: Check if user has required role
      if (!allowedRoles.includes(req.user.role)) {
        console.log("❌ Access denied - insufficient permissions");
        return next(
          new AppError("Access denied. Insufficient permissions.", 403)
        );
      }

      console.log("✅ Role authorization passed");
      next();
    } catch (error) {
      console.error("❌ Authorization Error:", error);
      next(new AppError("Authorization failed", 500));
    }
  };
};

// ===== ADMIN ONLY ACCESS =====
/**
 *  Admin Only Authorization
 *
 * USAGE: router.delete('/users/:id', protect, adminOnly, controller)
 */
export const adminOnly = (req, res, next) => {
  return authorize("admin")(req, res, next);
};

// ===== ADMIN OR MODERATOR ACCESS =====
/**
 * Admin or Moderator Authorization
 *
 * USAGE: router.put('/users/:id/status', protect, adminOrModerator, controller)
 */
export const adminOrModerator = (req, res, next) => {
  return authorize("admin", "moderator")(req, res, next);
};

// ===== SELF OR ADMIN ACCESS =====
/**
 * Allow access to own resources or admin access
 *
 * USAGE: router.put('/users/:id', protect, selfOrAdmin, controller)
 * USER: Can only modify their own data or profile
 * ADMIN: Can modify any profile
 */
export const selfOrAdmin = (req, res, next) => {
  try {
    const userId = req.user._id.toString(); // Logged-in user ID
    const targetUserId = req.params.id; // Target user ID from route
    const userRole = req.user.role; // Logged-in user role

    console.log("🔍 Self or Admin check:", {
      userId,
      targetUserId,
      userRole,
      isSelf: userId === targetUserId,
      isAdmin: userRole === "admin",
    });

    // Allow if user is accessing their own resource OR if user is admin
    if (userId === targetUserId || userRole === "admin") {
      console.log("✅ Self or Admin authorization passed");
      return next();
    }

    console.log("❌ Access denied - not self or admin");
    return next(
      new AppError(
        "Access denied. You can only access your own resources.",
        403
      )
    );
  } catch (error) {
    console.error("❌ Self or Admin Authorization Error:", error);
    next(new AppError("Authorization failed", 500));
  }
};

// ===== CHECK ACCOUNT STATUS =====
/**
 * Check if user account is active
 *
 * USAGE: router.use(protect, checkAccountStatus)
 * Ensures user account is not suspended, deactivated or banned
 */
export const checkAccountStatus = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new AppError("User not found", 401));
    }

    const { accountStatus, isActive } = req.user;

    console.log("🔍 Account status check:", {
      userId: req.user._id,
      accountStatus,
      isActive,
    });

    // Check if account is active
    if (!isActive) {
      return next(
        new AppError(
          "Account has been deactivated. Please contact support.",
          403
        )
      );
    }

    // Check account status
    switch (accountStatus) {
      case "suspended":
        return next(
          new AppError(
            "Account is temporarily suspended. Please contact support.",
            403
          )
        );
      case "banned":
        return next(new AppError("Account has been permanently banned.", 403));
      case "pending":
        return next(new AppError("Account is pending verification.", 403));
      case "active":
        console.log("✅ Account status check passed");
        return next();
      default:
        return next(new AppError("Invalid account status.", 403));
    }
  } catch (error) {
    console.error("❌ Account Status Check Error:", error);
    next(new AppError("Account status check failed", 500));
  }
};

// ===== PERMISSION UTILITIES =====
/**
 * Check if user has specific permission
 */
export const hasPermission = (user, permission) => {
  const rolePermissions = {
    user: ["read:own", "update:own", "delete:own"],
    moderator: [
      "read:own",
      "update:own",
      "delete:own",
      "read:users",
      "update:users",
    ],
    admin: ["*"], // Admin has all permissions
  };

  const userPermissions = rolePermissions[user.role] || [];
  return userPermissions.includes("*") || userPermissions.includes(permission);
};

/**
 * Get user's role hierarchy level (higher number = more permissions)
 */
export const getRoleLevel = (role) => {
  const roleLevels = {
    user: 1,
    moderator: 2,
    admin: 3,
  };
  return roleLevels[role] || 0;
};

/**
 * Check if user can perform action on target user
 */
export const canModifyUser = (currentUser, targetUser) => {
  const currentUserLevel = getRoleLevel(currentUser.role);
  const targetUserLevel = getRoleLevel(targetUser.role);

  // Users can modify their own data, admins can modify anyone,
  // Moderators can modify users but not other moderators or admins
  if (currentUser._id.toString() === targetUser._id.toString()) {
    return true; // Can modify own data
  }
  if (currentUser.role === "admin") {
    return true; // Admin can modify anyone
  }
  if (currentUser.role === "moderator" && targetUser.role === "user") {
    return true; // Moderator can modify users
  }

  return false; // Otherwise, no permission
};
