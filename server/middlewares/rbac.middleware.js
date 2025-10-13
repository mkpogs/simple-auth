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
