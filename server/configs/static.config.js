import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

// Get current directory (needed for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configure static file serving for uploaded files
 *
 * WHAT IT DOES:
 *  - Create upload directories if they don't exist
 *  - Serves static files from uploads folder
 *  - Sets up file paths for avatar access
 *
 * SECURITY:
 *  - Only serves files from uploads directory
 *  - Prevents directory traversal attacks
 */
export const configureStaticFiles = async (app) => {
  try {
    console.log("📁 Setting up static file serving...");

    // Step 1: Ensure upload directories exist
    await ensureUploadDirectories();

    // Step 2: Serve static files from the uploads directory
    const uploadsPath = path.join(process.cwd(), "uploads");
    app.use("/uploads", express.static(uploadsPath));

    console.log("✅ Static file serving configured");
    console.log("📂 Upload directories ready");
    console.log("🌐 Static files served at: /uploads/*");
  } catch (error) {
    console.error("❌ Failed to configure static files:", error);
    throw error;
  }
};

/**
 * Create upload directories if they don't exist
 *
 * DIRECTORIES CREATED:
 *  - uploads/                  (main upload folder)
 *  - uploads/avatars/          (user profile pictures)
 *  - uploads/temps/             (temporary file processing)
 */
const ensureUploadDirectories = async () => {
  const directories = ["uploads", "uploads/avatars", "uploads/temps"];

  for (const dir of directories) {
    const fullPath = path.join(process.cwd(), dir);

    try {
      // Check if directory exists
      await fs.access(fullPath);
      console.log(`📁 Directory exists: ${dir}`);
    } catch (error) {
      // Directory does not exist, create it
      console.log(`📁 Creating directory: ${dir}`);
      await fs.mkdir(fullPath, { recursive: true });

      // Create a .gitkeep file to track empty directory
      const gitkeepPath = path.join(fullPath, ".gitkeep");
      await fs.writeFile(gitkeepPath, "");
      console.log(`📄 Created .gitkeep in: ${dir}/.gitkeep`);
    }
  }
};

/**
 * Get upload directory path
 * Utility function for controllers
 */
export const getUploadPath = (subDir = "") => {
  return path.join(process.cwd(), "uploads", subDir);
};

/**
 * Get avatar directory path
 * Utility function for avatar uploads
 */
export const getAvatarPath = () => {
  return path.join(process.cwd(), "uploads", "avatars");
};

/**
 * Clean up old files (utility function)
 * Can be used for maintenance tasks
 */
export const cleanupOldFiles = async (directory, maxAge = 30) => {
  try {
    const dirPath = path.join(process.cwd(), "uploads", directory);
    const files = await fs.readdir(dirPath);
    const now = Date.now();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    for (const file of files) {
      if (file === ".gitkeep") continue; // Skip .gitkeep file

      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      const fileAge = now - stats.mtime.getTime();

      if (fileAge > maxAgeMs) {
        await fs.unlink(filePath);
        console.log(`🗑️ Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
};
