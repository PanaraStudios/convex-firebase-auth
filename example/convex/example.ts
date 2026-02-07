import { components } from "./_generated/api.js";
import { exposeApi } from "@panarastudios/convex-firebase-auth";

// Re-export the Firebase Auth API using exposeApi.
// Environment variables FIREBASE_PROJECT_ID and FIREBASE_API_KEY
// must be set in the Convex dashboard.
export const {
  verifyToken,
  getUser,
  getUserById,
  signOut,
  deleteUser,
  sendPasswordResetEmail,
  sendEmailVerification,
} = exposeApi(components.convexFirebaseAuth);
