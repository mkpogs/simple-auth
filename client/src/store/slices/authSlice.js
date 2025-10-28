import { createSlice } from "@reduxjs/toolkit";
import { set } from "mongoose";

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
const authSlice = createSlice({
  // Slice name - used as prefix for action types
  name: "auth", // Actions will be: "auth/loginStart", "auth/loginSuccess", etc.

  // Initial state defined above - Starting point for auth state
  initialState,

  // 🔄 REDUCERS - How state changes when actions happen
  reducers: {
    // ===== LOGIN FLOW ACTIONS =====

    /**
     * loginStart - User clicked "Login" button
     *
     * WHEN: User submits login form
     * PURPOSE: Set loading state, clear errors
     * STATE CHANGES: isLoading = true, error = null
     */
    loginStart: (state) => {
      console.log("Login started");

      // Immer magic: This looks like a mutation but creates new  state
      state.isLoading = true;
      state.error = null;
      state.requiresTwoFactor = false;
      state.tempUserId = null;
      state.tempEmail = null;
    },

    /**
     * loginSuccess - Login completed successfully (no 2FA)
     *
     * WHEN: API returns user data and tokens
     * PURPOSE: Save user data, mark as authenticated
     * STATE CHANGES: Save user, tokens, set isAuthenticated = true
     */
    loginSuccess: (state, action) => {
      console.log("✅ Login successful:", action.payload);

      // Extract data from action payload
      const { user, tokens } = action.payload;

      // Update state
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = user;
      state.accessToken = tokens.accessToken;
      state.refreshToken = tokens.refreshToken;
      state.requiresTwoFactor = false;
      state.tempUserId = null;
      state.tempEmail = null;
      state.error = null;
      state.loginTimestamp = Date.now();
      state.lastActivity = Date.now();

      // Persist to localStorage
      setStoredAuth({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user,
      });
    },

    /**
     * loginRequires2FA - Login needs 2FA verification
     *
     * WHEN: API says "login valid, but needs 2FA code"
     * PURPOSE: SHOW 2FA form, store temp data
     * STATE CHANGES: requiresTwoFactor = true, store temp data
     */
    loginRequires2FA: (state, action) => {
      console.log("🔐 2FA required:", action.payload);

      const { tempUserId, email } = action.payload;

      state.isLoading = false;
      state.requiresTwoFactor = true;
      state.tempUserId = tempUserId;
      state.tempEmail = email;
      state.error = null;
    },

    /**
     * twoFactorSuccess - 2FA verification successful
     *
     * WHEN: User enters correct 2FA code
     * PURPOSE: Complete login process
     * STATE CHANGES: Same as loginSuccess
     */
    twoFactorSuccess: (state, action) => {
      console.log("✅ 2FA verification successful:", action.payload);

      const { user, tokens } = action.payload;

      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = user;
      state.accessToken = tokens.accessToken;
      state.refreshToken = tokens.refreshToken;
      state.requiresTwoFactor = false;
      state.tempUserId = null;
      state.tempEmail = null;
      state.error = null;
      state.loginTimestamp = Date.now();
      state.lastActivity = Date.now();

      // 💾 Persist to localStorage
      setStoredAuth({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user,
      });
    },
  },
});
