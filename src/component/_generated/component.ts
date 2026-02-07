/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      deleteFirebaseAccount: FunctionReference<
        "action",
        "internal",
        { firebaseApiKey: string; idToken: string },
        null,
        Name
      >;
      deleteUser: FunctionReference<
        "mutation",
        "internal",
        { firebaseUid: string },
        null,
        Name
      >;
      getSession: FunctionReference<
        "query",
        "internal",
        { firebaseUid: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          expiresAt: number;
          firebaseUid: string;
          lastActiveAt: number;
          userId: string;
        },
        Name
      >;
      getUser: FunctionReference<
        "query",
        "internal",
        { userId: string },
        null | {
          _creationTime: number;
          _id: string;
          customClaims?: string;
          disabled?: boolean;
          displayName?: string;
          email?: string;
          emailVerified?: boolean;
          firebaseUid: string;
          isAnonymous?: boolean;
          lastSignInTime?: number;
          phoneNumber?: string;
          photoURL?: string;
          providerId?: string;
        },
        Name
      >;
      getUserByFirebaseUid: FunctionReference<
        "query",
        "internal",
        { firebaseUid: string },
        null | {
          _creationTime: number;
          _id: string;
          customClaims?: string;
          disabled?: boolean;
          displayName?: string;
          email?: string;
          emailVerified?: boolean;
          firebaseUid: string;
          isAnonymous?: boolean;
          lastSignInTime?: number;
          phoneNumber?: string;
          photoURL?: string;
          providerId?: string;
        },
        Name
      >;
      getUserData: FunctionReference<
        "action",
        "internal",
        { firebaseApiKey: string; idToken: string },
        string,
        Name
      >;
      invalidateAllSessions: FunctionReference<
        "mutation",
        "internal",
        { firebaseUid: string },
        null,
        Name
      >;
      invalidateSession: FunctionReference<
        "mutation",
        "internal",
        { sessionId: string },
        null,
        Name
      >;
      refreshToken: FunctionReference<
        "action",
        "internal",
        { firebaseApiKey: string; refreshTokenValue: string },
        string,
        Name
      >;
      sendEmailVerification: FunctionReference<
        "action",
        "internal",
        { firebaseApiKey: string; idToken: string },
        null,
        Name
      >;
      sendPasswordResetEmail: FunctionReference<
        "action",
        "internal",
        { email: string; firebaseApiKey: string },
        null,
        Name
      >;
      updateUserProfile: FunctionReference<
        "mutation",
        "internal",
        { displayName?: string; firebaseUid: string; photoURL?: string },
        null,
        Name
      >;
      verifyToken: FunctionReference<
        "action",
        "internal",
        { firebaseProjectId: string; idToken: string },
        null | {
          _creationTime: number;
          _id: string;
          customClaims?: string;
          disabled?: boolean;
          displayName?: string;
          email?: string;
          emailVerified?: boolean;
          firebaseUid: string;
          isAnonymous?: boolean;
          lastSignInTime?: number;
          phoneNumber?: string;
          photoURL?: string;
          providerId?: string;
        },
        Name
      >;
    };
  };
