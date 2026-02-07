import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
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
  })
    .index("by_firebaseUid", ["firebaseUid"])
    .index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    firebaseUid: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_firebaseUid", ["firebaseUid"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  publicKeyCache: defineTable({
    keys: v.string(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  }),
});
