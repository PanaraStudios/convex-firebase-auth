import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("getUser returns null for nonexistent firebase uid", async () => {
    const t = initConvexTest();
    const user = await t.query(api.example.getUser, {
      firebaseUid: "nonexistent-uid",
    });
    expect(user).toBeNull();
  });
});
