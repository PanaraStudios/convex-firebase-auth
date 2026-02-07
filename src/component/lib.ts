import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import {
  parseJwt,
  validateClaims,
  importJwk,
  verifyRS256Signature,
  parseCacheControlMaxAge,
} from "./jwtUtils.js";

const GOOGLE_JWK_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const FIREBASE_API_BASE = "https://identitytoolkit.googleapis.com/v1";
const FIREBASE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";

// ─── User validators ───────────────────────────────────────────────────────

const userFieldsValidator = {
  firebaseUid: v.string(),
  email: v.optional(v.string()),
  emailVerified: v.optional(v.boolean()),
  displayName: v.optional(v.string()),
  photoURL: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  providerId: v.optional(v.string()),
  isAnonymous: v.optional(v.boolean()),
  disabled: v.optional(v.boolean()),
  lastSignInTime: v.optional(v.number()),
  customClaims: v.optional(v.string()),
};

const userObjectValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  ...userFieldsValidator,
});

const userReturnValidator = v.union(v.null(), userObjectValidator);

type UserReturn = {
  _id: string;
  _creationTime: number;
  firebaseUid: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  providerId?: string;
  isAnonymous?: boolean;
  disabled?: boolean;
  lastSignInTime?: number;
  customClaims?: string;
} | null;

const sessionReturnValidator = v.union(
  v.null(),
  v.object({
    _id: v.string(),
    _creationTime: v.number(),
    userId: v.id("users"),
    firebaseUid: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  }),
);

// ─── Token Verification ────────────────────────────────────────────────────

export const verifyToken = action({
  args: {
    idToken: v.string(),
    firebaseProjectId: v.string(),
  },
  returns: userReturnValidator,
  handler: async (ctx, args): Promise<UserReturn> => {
    const { idToken, firebaseProjectId } = args;

    // 1. Parse JWT
    const parsed = parseJwt(idToken);

    // 2. Validate header algorithm
    if (parsed.header.alg !== "RS256") {
      throw new Error(`Unsupported algorithm: ${parsed.header.alg}`);
    }

    // 3. Get public keys (cached or fetched)
    let cachedKeys = (await ctx.runQuery(
      internal.lib._getCachedPublicKeys,
      {},
    )) as { keys: string; fetchedAt: number; expiresAt: number } | null;

    if (!cachedKeys || cachedKeys.expiresAt < Date.now()) {
      // Fetch fresh keys
      const response = await fetch(GOOGLE_JWK_URL);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch Google public keys: ${response.status}`,
        );
      }
      const keysData = await response.text();
      const cacheControl = response.headers.get("Cache-Control");
      const maxAge = parseCacheControlMaxAge(cacheControl) ?? 3600;
      const now = Date.now();

      await ctx.runMutation(internal.lib._setCachedPublicKeys, {
        keys: keysData,
        fetchedAt: now,
        expiresAt: now + maxAge * 1000,
      });

      cachedKeys = {
        keys: keysData,
        fetchedAt: now,
        expiresAt: now + maxAge * 1000,
      };
    }

    // 4. Find matching key by kid
    const jwkSet = JSON.parse(cachedKeys.keys) as {
      keys: (JsonWebKey & { kid: string })[];
    };
    const matchingKey = jwkSet.keys.find((k) => k.kid === parsed.header.kid);
    if (!matchingKey) {
      throw new Error(
        `No matching public key found for kid: ${parsed.header.kid}`,
      );
    }

    // 5. Import JWK and verify signature
    const cryptoKey = await importJwk(matchingKey);
    const isValid = await verifyRS256Signature(
      parsed.signedContent,
      parsed.signature,
      cryptoKey,
    );
    if (!isValid) {
      throw new Error("Invalid token signature");
    }

    // 6. Validate claims
    validateClaims(parsed.payload, firebaseProjectId);

    // 7. Upsert user
    const firebasePayload = parsed.payload;
    const userId = (await ctx.runMutation(internal.lib._upsertUser, {
      firebaseUid: firebasePayload.sub,
      email: firebasePayload.email,
      emailVerified: firebasePayload.email_verified,
      displayName: firebasePayload.name,
      photoURL: firebasePayload.picture,
      phoneNumber: firebasePayload.phone_number,
      providerId: firebasePayload.firebase?.sign_in_provider,
      isAnonymous:
        firebasePayload.firebase?.sign_in_provider === "anonymous" ||
        undefined,
      lastSignInTime: firebasePayload.auth_time
        ? firebasePayload.auth_time * 1000
        : undefined,
    })) as string;

    // 8. Create session
    const now = Date.now();
    await ctx.runMutation(internal.lib._createSession, {
      userId,
      firebaseUid: firebasePayload.sub,
      expiresAt: firebasePayload.exp * 1000,
      createdAt: now,
      lastActiveAt: now,
    });

    // 9. Return user
    const user = (await ctx.runQuery(internal.lib._getUserById, {
      userId,
    })) as UserReturn;
    return user;
  },
});

// ─── User Management ───────────────────────────────────────────────────────

export const getUser = query({
  args: { userId: v.string() },
  returns: userReturnValidator,
  handler: async (ctx, args): Promise<UserReturn> => {
    const doc = await ctx.db.get(args.userId as Id<"users">);
    if (!doc) return null;
    return { ...doc, _id: doc._id as unknown as string };
  },
});

export const getUserByFirebaseUid = query({
  args: { firebaseUid: v.string() },
  returns: userReturnValidator,
  handler: async (ctx, args): Promise<UserReturn> => {
    const doc = await ctx.db
      .query("users")
      .withIndex("by_firebaseUid", (q) =>
        q.eq("firebaseUid", args.firebaseUid),
      )
      .unique();
    if (!doc) return null;
    return { ...doc, _id: doc._id as unknown as string };
  },
});

export const updateUserProfile = mutation({
  args: {
    firebaseUid: v.string(),
    displayName: v.optional(v.string()),
    photoURL: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebaseUid", (q) =>
        q.eq("firebaseUid", args.firebaseUid),
      )
      .unique();
    if (!user) {
      throw new Error("User not found");
    }
    const updates: Record<string, string | undefined> = {};
    if (args.displayName !== undefined) updates.displayName = args.displayName;
    if (args.photoURL !== undefined) updates.photoURL = args.photoURL;
    await ctx.db.patch(user._id, updates);
    return null;
  },
});

export const deleteUser = mutation({
  args: { firebaseUid: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_firebaseUid", (q) =>
        q.eq("firebaseUid", args.firebaseUid),
      )
      .unique();
    if (!user) return null;

    // Delete all sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete user
    await ctx.db.delete(user._id);
    return null;
  },
});

// ─── Session Management ────────────────────────────────────────────────────

export const getSession = query({
  args: { firebaseUid: v.string() },
  returns: sessionReturnValidator,
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_firebaseUid", (q) =>
        q.eq("firebaseUid", args.firebaseUid),
      )
      .order("desc")
      .first();
    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;
    return { ...session, _id: session._id as unknown as string };
  },
});

export const invalidateSession = mutation({
  args: { sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId as Id<"sessions">);
    if (session) {
      await ctx.db.delete(session._id);
    }
    return null;
  },
});

export const invalidateAllSessions = mutation({
  args: { firebaseUid: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_firebaseUid", (q) =>
        q.eq("firebaseUid", args.firebaseUid),
      )
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    return null;
  },
});

// ─── Firebase REST API Operations ──────────────────────────────────────────

export const getUserData = action({
  args: {
    idToken: v.string(),
    firebaseApiKey: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const response = await fetch(
      `${FIREBASE_API_BASE}/accounts:lookup?key=${args.firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: args.idToken }),
      },
    );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firebase getUserData failed: ${error}`);
    }
    return await response.text();
  },
});

export const sendPasswordResetEmail = action({
  args: {
    email: v.string(),
    firebaseApiKey: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const response = await fetch(
      `${FIREBASE_API_BASE}/accounts:sendOobCode?key=${args.firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: args.email,
        }),
      },
    );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firebase sendPasswordResetEmail failed: ${error}`);
    }
    return null;
  },
});

export const sendEmailVerification = action({
  args: {
    idToken: v.string(),
    firebaseApiKey: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const response = await fetch(
      `${FIREBASE_API_BASE}/accounts:sendOobCode?key=${args.firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "VERIFY_EMAIL",
          idToken: args.idToken,
        }),
      },
    );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firebase sendEmailVerification failed: ${error}`);
    }
    return null;
  },
});

export const deleteFirebaseAccount = action({
  args: {
    idToken: v.string(),
    firebaseApiKey: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const response = await fetch(
      `${FIREBASE_API_BASE}/accounts:delete?key=${args.firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: args.idToken }),
      },
    );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firebase deleteAccount failed: ${error}`);
    }
    return null;
  },
});

export const refreshToken = action({
  args: {
    refreshTokenValue: v.string(),
    firebaseApiKey: v.string(),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const response = await fetch(
      `${FIREBASE_TOKEN_URL}?key=${args.firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(args.refreshTokenValue)}`,
      },
    );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firebase refreshToken failed: ${error}`);
    }
    return await response.text();
  },
});

// ─── Internal Functions ────────────────────────────────────────────────────

export const _upsertUser = internalMutation({
  args: {
    firebaseUid: v.string(),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    photoURL: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    providerId: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    lastSignInTime: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_firebaseUid", (q) =>
        q.eq("firebaseUid", args.firebaseUid),
      )
      .unique();

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (args.email !== undefined) updates.email = args.email;
      if (args.emailVerified !== undefined)
        updates.emailVerified = args.emailVerified;
      if (args.displayName !== undefined)
        updates.displayName = args.displayName;
      if (args.photoURL !== undefined) updates.photoURL = args.photoURL;
      if (args.phoneNumber !== undefined)
        updates.phoneNumber = args.phoneNumber;
      if (args.providerId !== undefined) updates.providerId = args.providerId;
      if (args.isAnonymous !== undefined)
        updates.isAnonymous = args.isAnonymous;
      if (args.lastSignInTime !== undefined)
        updates.lastSignInTime = args.lastSignInTime;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id as unknown as string;
    }

    const userId = await ctx.db.insert("users", {
      firebaseUid: args.firebaseUid,
      email: args.email,
      emailVerified: args.emailVerified,
      displayName: args.displayName,
      photoURL: args.photoURL,
      phoneNumber: args.phoneNumber,
      providerId: args.providerId,
      isAnonymous: args.isAnonymous,
      lastSignInTime: args.lastSignInTime,
    });
    return userId as unknown as string;
  },
});

export const _createSession = internalMutation({
  args: {
    userId: v.string(),
    firebaseUid: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Clean up any existing expired sessions for this user
    const existingSessions = await ctx.db
      .query("sessions")
      .withIndex("by_firebaseUid", (q) =>
        q.eq("firebaseUid", args.firebaseUid),
      )
      .collect();

    const now = Date.now();
    for (const session of existingSessions) {
      if (session.expiresAt < now) {
        await ctx.db.delete(session._id);
      }
    }

    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId as Id<"users">,
      firebaseUid: args.firebaseUid,
      expiresAt: args.expiresAt,
      createdAt: args.createdAt,
      lastActiveAt: args.lastActiveAt,
    });
    return sessionId as unknown as string;
  },
});

export const _getCachedPublicKeys = internalQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      keys: v.string(),
      fetchedAt: v.number(),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const cached = await ctx.db.query("publicKeyCache").order("desc").first();
    if (!cached) return null;
    return {
      keys: cached.keys,
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
    };
  },
});

export const _setCachedPublicKeys = internalMutation({
  args: {
    keys: v.string(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Delete old entries
    const existing = await ctx.db.query("publicKeyCache").collect();
    for (const entry of existing) {
      await ctx.db.delete(entry._id);
    }
    await ctx.db.insert("publicKeyCache", {
      keys: args.keys,
      fetchedAt: args.fetchedAt,
      expiresAt: args.expiresAt,
    });
    return null;
  },
});

export const _getUserById = internalQuery({
  args: { userId: v.string() },
  returns: userReturnValidator,
  handler: async (ctx, args): Promise<UserReturn> => {
    const doc = await ctx.db.get(args.userId as Id<"users">);
    if (!doc) return null;
    return { ...doc, _id: doc._id as unknown as string };
  },
});

export const _cleanupExpiredSessions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const session of expired) {
      await ctx.db.delete(session._id);
    }
    return expired.length;
  },
});
