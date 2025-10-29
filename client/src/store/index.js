import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authSlice from "./slices/authSlice";
import { get } from "mongoose";

/**
 * Step 1:
 * ROOT REDUCER - Combines all slice reducers
 *
 * WHY SEPARATE rootReducer:
 *  - Cleaner organization (all reducers in one place)
 *  - Easier to add/remove slices
 *  - Better for middleware that needs access to all reducers
 *  - Matches traditional Redux patterns
 *  - Easier to test individual reducers
 *
 * STRUCTURE:
 * Your app state will look like this:
 * {
 *   auth: { isAuthenticated: true, user: {...}, ... },
 *   ui: { theme: "dark", loading: false, ... },     // Future
 *   admin: { users: [], stats: {...}, ... },        // Future
 * }
 */
const rootReducer = combineReducers({
  // ===== CURRENT SLICES ======
  auth: authSlice,

  // ===== FUTURE SLICES ======
  // ui: uiSlice,        // Theme, modals, loading states, notifications
  // user: userSlice,    // User preferences, settings, bookmarks
  // admin: adminSlice,  // Admin dashboard data, user management
  // cache: cacheSlice,  // API response caching, offline support
});

/**
 * Step 2:
 * Redux Store - Your App Central Brain
 *
 * WHAT IT DOES:
 *  - Uses rootReducer to manage all state slices
 *  - Configures middleware for async actions and debugging
 *  - Provides global state to entire app
 *  - Handles development tools and debugging
 *
 * WHY configureStore (Redux Toolkit):
 *  - Auto-configures best practices
 *  - Includes Redux devTools automatically
 *  - Adds helpful middleware by default
 *  - Better development experience
 *  - Less boilerplate code than legacy Redux
 */
export const store = configureStore({
  reducer: rootReducer, // Connects rootReducer to the store, Handles all state slices

  /**
   * MIDDLEWARE CONFIGURE CONFIGURATION
   *  - Functions that run between dispatching an "action" and the moment it reaches the "reducer"
   *
   * Default Middleware Includes:
   *  - redux-thunk: Handle async actions (API calls)
   *  - Serializable Check: Warn about non-serializable data in state/actions
   *  - Immutable Check: Warn about state mutations
   *  - Action Type Check: Warn about invalid actions
   */
  middleware: (getDefaultMiddleware) => {
    getDefaultMiddleware(
      {
        // *** SERIALIZABLE CHECK ***
        serializableCheck: {
          // Ignore these action types (they might contain non-serializable data)
          ignoredActions: [
            "persist/PERSIST", // Redux Persist action
            "persist/REHYDRATE", // Redux Persist action
            "auth/updateActivity", // Contains Timestamp (Date objects)
          ],
        },

        // Ignore these state paths (they might contain non-serializable data)
        ignoredPaths: [
          "auth.loginTimestamp", // Date objects
          "auth.lastActivity", // Date objects
        ],

        // Ignore these action payload paths
        ignoredActionsPaths: [
          "payload.timestamp", // Date objects in payloads
          "meta.timestamp", // Date objects in meta
        ],
      }

      // *** IMMUTABLE CHECK ***
    );
  },
});
