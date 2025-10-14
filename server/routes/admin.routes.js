import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getDashboardStats,
} from "../controllers/admin.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  adminOnly,
  adminOrModerator,
  checkAccountStatus,
} from "../middlewares/rbac.middleware.js";

const router = express.Router();

export default router;
