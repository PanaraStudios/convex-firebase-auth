import { describe, expect, test } from "vitest";
import { exposeApi } from "./index.js";
import { anyApi, type ApiFromModules } from "convex/server";
import { components, initConvexTest } from "./setup.test.js";

export const { getUser, getUserById } = exposeApi(
  components.convexFirebaseAuth,
);

const testApi = (
  anyApi as unknown as ApiFromModules<{
    "index.test": {
      getUser: typeof getUser;
      getUserById: typeof getUserById;
    };
  }>
)["index.test"];

describe("client tests", () => {
  test("getUser returns null for nonexistent uid", async () => {
    const t = initConvexTest();
    const user = await t.query(testApi.getUser, {
      firebaseUid: "nonexistent",
    });
    expect(user).toBeNull();
  });
});
