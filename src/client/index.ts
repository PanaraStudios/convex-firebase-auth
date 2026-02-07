import {
  actionGeneric,
  httpActionGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import type {
  GenericActionCtx,
  GenericDataModel,
  GenericQueryCtx,
  HttpRouter,
} from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";

// ─── Helper Functions ──────────────────────────────────────────────────────

export function verifyToken(
  ctx: ActionCtx,
  component: ComponentApi,
  idToken: string,
) {
  const firebaseProjectId = getEnvVar("FIREBASE_PROJECT_ID");
  return ctx.runAction(component.lib.verifyToken, {
    idToken,
    firebaseProjectId,
  });
}

export function getUser(
  ctx: QueryCtx,
  component: ComponentApi,
  firebaseUid: string,
) {
  return ctx.runQuery(component.lib.getUserByFirebaseUid, { firebaseUid });
}

export function getUserData(
  ctx: ActionCtx,
  component: ComponentApi,
  idToken: string,
) {
  const firebaseApiKey = getEnvVar("FIREBASE_API_KEY");
  return ctx.runAction(component.lib.getUserData, {
    idToken,
    firebaseApiKey,
  });
}

// ─── exposeApi Factory ─────────────────────────────────────────────────────

export function exposeApi(
  component: ComponentApi,
  options?: {
    firebaseProjectId?: string;
    firebaseApiKey?: string;
  },
) {
  const getProjectId = () =>
    options?.firebaseProjectId ?? getEnvVar("FIREBASE_PROJECT_ID");
  const getApiKey = () =>
    options?.firebaseApiKey ?? getEnvVar("FIREBASE_API_KEY");

  return {
    verifyToken: actionGeneric({
      args: { idToken: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runAction(component.lib.verifyToken, {
          idToken: args.idToken,
          firebaseProjectId: getProjectId(),
        });
      },
    }),

    getUser: queryGeneric({
      args: { firebaseUid: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.lib.getUserByFirebaseUid, {
          firebaseUid: args.firebaseUid,
        });
      },
    }),

    getUserById: queryGeneric({
      args: { userId: v.string() },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.lib.getUser, {
          userId: args.userId,
        });
      },
    }),

    signOut: mutationGeneric({
      args: { firebaseUid: v.string() },
      handler: async (ctx, args) => {
        await ctx.runMutation(component.lib.invalidateAllSessions, {
          firebaseUid: args.firebaseUid,
        });
      },
    }),

    deleteUser: mutationGeneric({
      args: { firebaseUid: v.string() },
      handler: async (ctx, args) => {
        await ctx.runMutation(component.lib.deleteUser, {
          firebaseUid: args.firebaseUid,
        });
      },
    }),

    sendPasswordResetEmail: actionGeneric({
      args: { email: v.string() },
      handler: async (ctx, args) => {
        await ctx.runAction(component.lib.sendPasswordResetEmail, {
          email: args.email,
          firebaseApiKey: getApiKey(),
        });
      },
    }),

    sendEmailVerification: actionGeneric({
      args: { idToken: v.string() },
      handler: async (ctx, args) => {
        await ctx.runAction(component.lib.sendEmailVerification, {
          idToken: args.idToken,
          firebaseApiKey: getApiKey(),
        });
      },
    }),
  };
}

// ─── HTTP Routes ───────────────────────────────────────────────────────────

export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  {
    pathPrefix = "/auth",
    firebaseProjectId,
  }: { pathPrefix?: string; firebaseProjectId?: string } = {},
) {
  const getProjectId = () =>
    firebaseProjectId ?? getEnvVar("FIREBASE_PROJECT_ID");

  http.route({
    path: `${pathPrefix}/verify`,
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      try {
        const body = (await request.json()) as { idToken?: string };
        if (!body.idToken) {
          return new Response(
            JSON.stringify({ error: "idToken is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        const user = await ctx.runAction(component.lib.verifyToken, {
          idToken: body.idToken,
          firebaseProjectId: getProjectId(),
        });
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }),
  });

  http.route({
    path: `${pathPrefix}/user`,
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const firebaseUid = url.searchParams.get("firebaseUid");
      if (!firebaseUid) {
        return new Response(
          JSON.stringify({ error: "firebaseUid parameter is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      const user = await ctx.runQuery(component.lib.getUserByFirebaseUid, {
        firebaseUid,
      });
      return new Response(JSON.stringify(user), {
        status: user ? 200 : 404,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Set it in your Convex dashboard.`,
    );
  }
  return value;
}

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;
