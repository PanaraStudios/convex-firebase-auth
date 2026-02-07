/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("component lib", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("upsert user - create new user", async () => {
    const t = initConvexTest();
    const userId = await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-1",
      email: "test@example.com",
      emailVerified: true,
      displayName: "Test User",
    });
    expect(userId).toBeDefined();

    const user = await t.query(api.lib.getUserByFirebaseUid, {
      firebaseUid: "firebase-uid-1",
    });
    expect(user).not.toBeNull();
    expect(user!.email).toBe("test@example.com");
    expect(user!.displayName).toBe("Test User");
    expect(user!.firebaseUid).toBe("firebase-uid-1");
  });

  test("upsert user - update existing user", async () => {
    const t = initConvexTest();
    const userId1 = await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-2",
      email: "original@example.com",
      displayName: "Original Name",
    });

    const userId2 = await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-2",
      email: "updated@example.com",
      displayName: "Updated Name",
    });

    // Should return same user ID
    expect(userId1).toBe(userId2);

    const user = await t.query(api.lib.getUserByFirebaseUid, {
      firebaseUid: "firebase-uid-2",
    });
    expect(user!.email).toBe("updated@example.com");
    expect(user!.displayName).toBe("Updated Name");
  });

  test("get user by ID", async () => {
    const t = initConvexTest();
    const userId = await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-3",
      email: "byid@example.com",
    });

    const user = await t.query(api.lib.getUser, { userId });
    expect(user).not.toBeNull();
    expect(user!.email).toBe("byid@example.com");
  });

  test("get user returns null for nonexistent", async () => {
    const t = initConvexTest();
    const user = await t.query(api.lib.getUserByFirebaseUid, {
      firebaseUid: "nonexistent",
    });
    expect(user).toBeNull();
  });

  test("update user profile", async () => {
    const t = initConvexTest();
    await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-4",
      displayName: "Old Name",
    });

    await t.mutation(api.lib.updateUserProfile, {
      firebaseUid: "firebase-uid-4",
      displayName: "New Name",
      photoURL: "https://example.com/photo.jpg",
    });

    const user = await t.query(api.lib.getUserByFirebaseUid, {
      firebaseUid: "firebase-uid-4",
    });
    expect(user!.displayName).toBe("New Name");
    expect(user!.photoURL).toBe("https://example.com/photo.jpg");
  });

  test("delete user and sessions", async () => {
    const t = initConvexTest();
    const userId = await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-5",
      email: "delete@example.com",
    });

    // Create a session
    await t.mutation(internal.lib._createSession, {
      userId,
      firebaseUid: "firebase-uid-5",
      expiresAt: Date.now() + 3600000,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // Verify session exists
    const session = await t.query(api.lib.getSession, {
      firebaseUid: "firebase-uid-5",
    });
    expect(session).not.toBeNull();

    // Delete user
    await t.mutation(api.lib.deleteUser, {
      firebaseUid: "firebase-uid-5",
    });

    // User should be gone
    const user = await t.query(api.lib.getUserByFirebaseUid, {
      firebaseUid: "firebase-uid-5",
    });
    expect(user).toBeNull();

    // Session should be gone too
    const sessionAfter = await t.query(api.lib.getSession, {
      firebaseUid: "firebase-uid-5",
    });
    expect(sessionAfter).toBeNull();
  });

  test("session creation and retrieval", async () => {
    const t = initConvexTest();
    const userId = await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-6",
    });

    const now = Date.now();
    const sessionId = await t.mutation(internal.lib._createSession, {
      userId,
      firebaseUid: "firebase-uid-6",
      expiresAt: now + 3600000,
      createdAt: now,
      lastActiveAt: now,
    });
    expect(sessionId).toBeDefined();

    const session = await t.query(api.lib.getSession, {
      firebaseUid: "firebase-uid-6",
    });
    expect(session).not.toBeNull();
    expect(session!.firebaseUid).toBe("firebase-uid-6");
  });

  test("invalidate all sessions", async () => {
    const t = initConvexTest();
    const userId = await t.mutation(internal.lib._upsertUser, {
      firebaseUid: "firebase-uid-7",
    });

    const now = Date.now();
    // Create multiple sessions
    await t.mutation(internal.lib._createSession, {
      userId,
      firebaseUid: "firebase-uid-7",
      expiresAt: now + 3600000,
      createdAt: now,
      lastActiveAt: now,
    });
    await t.mutation(internal.lib._createSession, {
      userId,
      firebaseUid: "firebase-uid-7",
      expiresAt: now + 7200000,
      createdAt: now + 1000,
      lastActiveAt: now + 1000,
    });

    // Invalidate all
    await t.mutation(api.lib.invalidateAllSessions, {
      firebaseUid: "firebase-uid-7",
    });

    const session = await t.query(api.lib.getSession, {
      firebaseUid: "firebase-uid-7",
    });
    expect(session).toBeNull();
  });

  test("public key cache", async () => {
    const t = initConvexTest();

    // Initially no cached keys
    const cached = await t.query(internal.lib._getCachedPublicKeys, {});
    expect(cached).toBeNull();

    // Set cached keys
    const now = Date.now();
    await t.mutation(internal.lib._setCachedPublicKeys, {
      keys: '{"keys": []}',
      fetchedAt: now,
      expiresAt: now + 3600000,
    });

    const cached2 = await t.query(internal.lib._getCachedPublicKeys, {});
    expect(cached2).not.toBeNull();
    expect(cached2!.keys).toBe('{"keys": []}');

    // Set again should replace
    await t.mutation(internal.lib._setCachedPublicKeys, {
      keys: '{"keys": [{"kid": "1"}]}',
      fetchedAt: now + 1000,
      expiresAt: now + 7200000,
    });

    const cached3 = await t.query(internal.lib._getCachedPublicKeys, {});
    expect(cached3!.keys).toBe('{"keys": [{"kid": "1"}]}');
  });
});
