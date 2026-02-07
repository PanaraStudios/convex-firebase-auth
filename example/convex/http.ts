import { httpRouter } from "convex/server";
import { registerRoutes } from "@panarastudios/convex-firebase-auth";
import { components } from "./_generated/api";

const http = httpRouter();

// Register Firebase Auth HTTP routes
// POST /auth/verify - Verify a Firebase ID token
// GET /auth/user?firebaseUid=... - Get user data by Firebase UID
registerRoutes(http, components.convexFirebaseAuth, {
  pathPrefix: "/auth",
});

export default http;
