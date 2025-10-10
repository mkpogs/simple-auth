import multer from "multer";
import path from "path";
import AppError from "../utils/AppError.js";

/**
 * Multer Configuration for File Uploads
 *
 * WHAT IT DOES:
 *  - Configures file upload handling
 *  - Validates file types and sizes
 *  - Uses memory storage for processing
 *  - Provides reusable upload middleware
 *
 * SECURITY:
 *  - File type validation
 *  - File size limits
 *  - Memory storage prevents direct file system access
 */
