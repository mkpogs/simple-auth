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
