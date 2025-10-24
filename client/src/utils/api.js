import axios from "axios";
import toast from "react-hot-toast";

/**
 * API Client Configuration
 *
 * WHAT IT DOES:
 *  - Creates a configured axios instance
 *  - Automatically adds auth tokens to requests
 *  - Handles common errors (401, 403, 500)
 *  - Shows user-friendly error messages
 *
 * WHY WE NEED IT:
 *  - Centralized HTTP configuration
 *  - Automatic token management
 *  - Consistent error handling
 *  - Easy to modify API behavior
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const NODE_ENV = import.meta.env.VITE_NODE_ENV || "development";

// *** Create axios instance with base configuration ***
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// *** Request Interceptor - Runs BEFORE every API call ***
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem("accessToken");

    if (token) {
      // Add token to Authorization header
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log API calls in development
    if (NODE_ENV === "development") {
      console.log(`🔄 API Call: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error("❌ Request error:", error);
    return Promise.reject(error);
  }
);

// *** Response Interceptor - Runs AFTER every API response ***
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (NODE_ENV === "development") {
      console.log(
        `✅ API Success: ${response.config.method?.toUpperCase()} ${
          response.config.url
        }`
      );
    }
    return response;
  },
  (error) => {
    // Handle different types of errors
    const status = error.response?.status;
    const message = error.response?.data?.message || "Something went wrong.";

    switch (status) {
      case 401:
        // Unauthorized - Token expired or invalid
        console.log("🔐 Unauthorized - clearing tokens");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        // Don't show toast on login page (expected behavior)
        if (!window.location.pathname.includes("/login")) {
          toast.error("Session expired. Please log in again.");
          window.location.href = "/login";
        }
        break;

      case 403:
        // Forbidden - user does not have permission
        toast.error(
          `Access denied. You don't have permission to perform this action.`
        );
        break;

      case 404:
        // Not Found
        toast.error("Resource not found.");
        break;

      case 422:
        // Validation error - don't show toast (handled by forms)
        console.log("⚠️ Validation error:", error.response?.data);
        break;

      case 429:
        // Rate Limiting
        toast.error("Too many requests. Please try again later.");
        break;

      case 500:
      case 502:
      case 503:
        // Server errors
        toast.error("Server error. Please try again later.");
        break;

      default:
        // Other errors
        if (status >= 400) {
          toast.error(message);
        }
    }
    console.error("❌ API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
