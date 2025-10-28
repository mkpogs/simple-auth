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

/**
 * 🔐 Helper functions - Why We Need Them
 *
 * PURPOSE: Hanlde localStorage operations safely
 * WHY: Browser localStorage can trow errors, we need error handling
 * WHEN: On app startup, login success, logout, profile updates
 */

// 📖 Read auth data from localStorage
const getStoredAuth = () => {
  try {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return { accessToken, refreshToken, user };
  } catch (error) {
    console.error("Error reading stored auth:", error);
    // Return safe defaults if localStorage fails
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }
};

// 💾 Save auth data to localStorage
const setStoredAuth = ({ accessToken, refreshToken, user }) => {
  try {
    if (accessToken) localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  } catch (error) {
    console.error("Error storing auth:", error);
    // Could be storage quota exceeded, private browsing, etc.
  }
};

// 🗑️ Clear all auth data from localStorage
const clearStoredAuth = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

/**
 * Step 1: 🏁 Initial State - The Starting Point
 *
 * PURPOSE: Define what the state looks like when app first loads
 * WHY: Redux needs to know  the shape and default values
 * WHEN: App startup, store creation
 *
 * DESIGN PRINCIPLES:
 *  - Group related data together
 *  - Use descriptive names
 *  - Provide safe defaults
 *  - Consider all possible states
 */
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

/**
 * 🎯 createSlice - definition of the Slice (The Main Event)
 *
 * WHAT IT CREATES:
 *  - Action Creators (loginStart, loginSuccess, etc.)
 *  - Action Types (auth/loginStart, auth/loginSuccess, etc.)
 *  - Reducer function (handle state changes based on actions)
 *
 * HOW IT WORKS:
 *  1. You define reducer functions (what happens when action occurs)
 *  2. Redux Toolkit automatically creates action creators
 *  3. Immer lets you "mutate" state safely (actually creates new state)
 */
const authSlice = createSlice({});
