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
 * Step 2:
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

    /**
     * loginFailure - Login or 2FA verification failed
     *
     * WHEN: Wrong credentials or 2FA code, etc.
     * PURPOSE: Show error message, reset states
     * STATE CHANGES: Set error, clear loading states
     */
    loginFailure: (state, action) => {
      console.log("❌ Login failed:", action.payload);

      state.isLoading = false;
      state.error = action.payload;
      state.lastError = action.payload;
      state.requiresTwoFactor = false;
      state.tempUserId = null;
      state.tempEmail = null;
    },

    // ===== LOGOUT ACTIONS =====
    /**
     * logout - User clicked "Logout" button or session expired
     *
     * WHEN: User clicks logout, token expires, etc.
     * PURPOSE: Clear all user data, reset to initial state
     * STATE CHANGES: Reset everything to logged-out state
     */
    logout: (state) => {
      console.log("👋 User logged out");

      // 🔄 Reset all authentication data
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.requiresTwoFactor = false;
      state.tempUserId = null;
      state.tempEmail = null;
      state.error = null;
      state.isLoading = false;
      state.loginTimestamp = null;
      state.lastActivity = null;

      // 🗑️ Clear localStorage
      clearStoredAuth();
    },

    // ===== USER PROFILE ACTIONS =====
    /**
     * updateUserProfile - User updated their profile
     *
     * WHEN: User changes name, avatar, settings, etc.
     * PURPOSE: Keep user data current
     * STATE CHANGES: Merge new data with existing user data
     */
    updateUserProfile: (state, action) => {
      console.log("👤 Updating user profile:", action.payload);

      if (state.user) {
        // Merge new data with existing user data
        state.user = { ...state.user, ...action.payload };
        state.lastActivity = Date.now();

        // Update localStorage
        setStoredAuth({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          user: state.user,
        });
      }
    },

    // ===== TOKEN MANAGEMENT =====
    /**
     * updateTokens - Got new access/refresh tokens
     *
     * WHEN: Token refresh, login, etc.
     * PURPOSE: Keep tokens current
     * STATE CHANGES: Update token values
     */
    updateTokens: (state, action) => {
      console.log("🔄 Updating tokens");

      const { accessToken, refreshToken } = action.payload;

      state.accessToken = accessToken;
      if (refreshToken) state.refreshToken = refreshToken;
      state.lastActivity = Date.now();

      // Update localStorage
      setStoredAuth({
        accessToken,
        refreshToken: refreshToken || state.refreshToken,
        user: state.user,
      });
    },

    // ===== ERROR MANAGEMENT =====

    /**
     * clearError - Clear current error messages
     *
     * WHEN: User dismisses error, starts new action
     * PURPOSE: Clean up UI
     * STATE CHANGES: error = null
     */
    clearError: (state) => {
      console.log("🧹 Clearing error");
      state.error = null;
    },

    /**
     * setError - Set Error Message
     *
     * WHEN: Something goes wrong
     * PURPOSE: Show error
     * STATE CHANGES: Set error message
     */
    setError: (state, action) => {
      console.log("❌ Setting error:", action.payload);
      state.error = action.payload;
      state.lastError = action.payload;
      state.isLoading = false;
    },

    // ===== UTILITY ACTIONS =====

    /**
     * updateActivity - update last activity timestamp
     *
     * WHEN: User interacts with app
     * PURPOSE: Track activity for auto logout
     * STATE CHANGES: lastActivity = now
     */
    updateActivity: (state) => {
      state.lastActivity = Date.now();
    },

    /**
     * setLoading - Set loading state
     *
     * WHEN: Starting/Stopping operations
     * PURPOSE: Control loading UI
     * STATE CHANGES: isLoading = true/false
     */
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

/**
 * Step 3:
 * 🎯 EXPORTS ACTIONS - These are automatically created by "createSlice"
 *
 * HOW TO USE:
 *  - import { loginStart, loginSuccess, logout } from './authSlice';
 *  - dispatch(loginStart());
 *  - dispatch(loginSuccess({ user, tokens }));
 */
export const {
  loginStart,
  loginSuccess,
  loginRequires2FA,
  twoFactorSuccess,
  loginFailure,
  logout,
  updateUserProfile,
  updateTokens,
  clearError,
  setError,
  updateActivity,
  setLoading,
} = authSlice.actions;

/**
 * Selector Functions (Optional) - Helper functions to get data from the state
 *
 * WHY SELECTORS:
 *  - Avoid repeating state.auth.user everywhere
 *  - Centralize data access (easier to refactor later)
 *  - Can add computed values/transformations if needed
 *  - Better performance with memoization
 *
 * HOW TO USE:
 *  const user = useSelector(selectUser);
 *  const isAuthenticated = useSelector(selectIsAuthenticated);
 */

// Get entire auth state
export const selectAuth = (state) => state.auth;

// Get specific auth values
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectRequires2FA = (state) => state.auth.requiresTwoFactor;
export const selectAuthError = (state) => state.auth.error;

// Get computed/combined values
export const selectTokens = (state) => ({
  accessToken: state.auth.accessToken,
  refreshToken: state.auth.refreshToken,
});

export const selectTwoFactorData = (state) => ({
  requiresTwoFactor: state.auth.requiresTwoFactor,
  tempUserId: state.auth.tempUserId,
  tempEmail: state.auth.tempEmail,
});

export const selectSessionInfo = (state) => ({
  loginTimestamp: state.auth.loginTimestamp,
  lastActivity: state.auth.lastActivity,
  isAuthenticated: state.auth.isAuthenticated,
});
