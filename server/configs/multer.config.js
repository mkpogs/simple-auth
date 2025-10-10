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

// ===== STORAGE CONFIGURATION =====
/**
 * Memory Storage Configuration
 *
 * WHY MEMORY STORAGE:
 *  - Files stored in RAM temporarily
 *  - Allows image processing (e.g., resizing) before saving
 *  - More secure than direct disk storage
 *  - Better control over file handling
 */
const memoryStorage = multer.memoryStorage();

// ===== FILE FILTER FUNCTIONS =====
/**
 * Image File Filter
 *
 * WHAT IT VALIDATES:
 *  - File must be an image (jpg, png, gif, webp, etc.)
 *  - Checks MIME type starts with 'image/'
 *  - Logs upload attempts for debugging
 */
const imageFilter = (req, file, cb) => {
  console.log("📁 Image upload attempt:", {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
  });

  //   Check if file is an image
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(
      new AppError("Please upload only image files (jpg, png, gif, webp)", 400),
      false
    );
  }
};

/**
 * Document File Filter (for future use)
 *
 * WHAT IT VALIDATES:
 *  - PDF Files
 *  - Word Documents
 *  - Text Files
 */
const documentFilter = (req, file, cb) => {
  console.log("📄 Document upload attempt:", {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
  });

  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError("Please upload only PDF, Word, or text files", 400), false);
  }
};

// ===== MULTER CONFIGURATIONS =====
/**
 * Avatar Upload Configuration
 *
 * SETTINGS:
 *  - Memory Storage for image processing
 *  - 5MB file size limit
 *  - Image file only
 *  - Single file upload
 */
export const avatarUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Single file only
  },
  fileFilter: imageFilter,
});

/**
 * Multiple Images Upload Configuration
 *
 * SETTINGS:
 *  - Memory Storage for batch processing
 *  - 5MB per file limit
 *  - Maximum 10 files
 *  - Image files only
 */
export const multipleImagesUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10, // Max 10 files
  },
  fileFilter: imageFilter,
});

/**
 * Document Upload Configuration
 *
 * SETTINGS:
 *  - Memory Storage for processing
 *  - 10MB per file limit
 *  - Document files only
 *  - Single file upload
 */
export const documentUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Single file only
  },
  fileFilter: documentFilter,
});
