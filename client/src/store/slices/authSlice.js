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
