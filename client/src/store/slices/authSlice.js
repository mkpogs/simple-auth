import { createSlice } from "@reduxjs/toolkit";

/**
 * Authentication Slice - User Login/Logout State Manager
 *
 * WHAT IT DOES:
 *  - Manages user  authentication state
 *  - Handles login/logout actions
 *  - Stores user profile information
 *  - Manages 2FA flow states
 *  - Persists auth data to localStorage
 *
 * WHY REDUX SLICE:
 *  - Centralized auth state (accessible from any components)
 *  - Predictable state updates (actions -> new state)
 *  - Automatic localStorage sync
 *  - DevTools integration for debugging
 *
 * CREATESLICE FEATURES:
 *  - Automatic action creators
 *  - Immer integration (direct state mutations)
 *  - Type-safe reducers
 *  - less boilerplate code
 */

// 🔐 Helper functions for localStorage persistence
const getStoredAuth = () => {
  try {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return { accessToken, refreshToken, user };
  } catch (error) {
    console.error("Error reading stored auth:", error);
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }
};

const setStoredAuth = ({ accessToken, refreshToken, user }) => {
  try {
    if (accessToken) localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  } catch (error) {
    console.error("Error storing auth:", error);
  }
};

const clearStoredAuth = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

// 🏁 Get initial state from localStorage (survives page refresh)
const initialAuthState = getStoredAuth();

const initialState = {
  // ===== AUTHENTICATION STATUS =====
  isAuthenticated: !!initialAuthState.accessToken,
  user: initialAuthState.user,
  accessToken: initialAuthState.accessToken,
  refreshToken: initialAuthState.refreshToken,

  // ===== AUTHENTICATION FLOW STATES =====
  isLoading: false,
  requiresTwoFactor: false,
  tempUserId: null, // Temporary ID during 2FA verification
  tempEmail: null, // Email for 2FA verification

  // ===== ERROR HANDLING =====
  error: null,
  lastError: null,

  // ===== SESSION INFO =====
  loginTimestamp: initialAuthState.user ? Date.now() : null,
  lastActivity: initialAuthState.user ? Date.now() : null,
};
