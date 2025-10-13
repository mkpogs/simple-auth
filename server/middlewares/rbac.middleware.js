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
