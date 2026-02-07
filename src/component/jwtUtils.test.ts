/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import {
  base64urlDecode,
  parseJwt,
  validateClaims,
  parseCacheControlMaxAge,
} from "./jwtUtils.js";
import type { FirebaseTokenPayload } from "./jwtUtils.js";

// Helper to create a base64url-encoded string
function base64urlEncode(str: string): string {
  const encoded = btoa(str);
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Helper to create a fake JWT with given header/payload
function createFakeJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): string {
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signatureB64 = base64urlEncode("fake-signature");
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

describe("base64urlDecode", () => {
  test("decodes a simple base64url string", () => {
    const input = base64urlEncode("Hello, World!");
    const result = new TextDecoder().decode(base64urlDecode(input));
    expect(result).toBe("Hello, World!");
  });

  test("handles strings with special base64url characters", () => {
    // A string that produces + and / in base64
    const original = "subjects?_d";
    const encoded = base64urlEncode(original);
    const result = new TextDecoder().decode(base64urlDecode(encoded));
    expect(result).toBe(original);
  });

  test("handles strings without padding", () => {
    const encoded = base64urlEncode("ab");
    // Remove padding if present
    const noPadding = encoded.replace(/=+$/, "");
    const result = new TextDecoder().decode(base64urlDecode(noPadding));
    expect(result).toBe("ab");
  });
});

describe("parseJwt", () => {
  test("parses a valid JWT", () => {
    const header = { alg: "RS256", kid: "test-key-id", typ: "JWT" };
    const payload = {
      iss: "https://securetoken.google.com/my-project",
      aud: "my-project",
      sub: "user-123",
      iat: 1000000,
      exp: 2000000,
      auth_time: 1000000,
    };
    const token = createFakeJwt(header, payload);

    const parsed = parseJwt(token);
    expect(parsed.header.alg).toBe("RS256");
    expect(parsed.header.kid).toBe("test-key-id");
    expect(parsed.payload.sub).toBe("user-123");
    expect(parsed.payload.aud).toBe("my-project");
    expect(parsed.signedContent).toContain(".");
    expect(parsed.signature).toBeInstanceOf(Uint8Array);
  });

  test("throws on invalid JWT format (not 3 parts)", () => {
    expect(() => parseJwt("only-one-part")).toThrow("expected 3 parts");
    expect(() => parseJwt("two.parts")).toThrow("expected 3 parts");
    expect(() => parseJwt("a.b.c.d")).toThrow("expected 3 parts");
  });

  test("throws on invalid header", () => {
    const payloadB64 = base64urlEncode(JSON.stringify({ sub: "test" }));
    const token = `invalid-not-base64.${payloadB64}.sig`;
    expect(() => parseJwt(token)).toThrow("failed to decode header");
  });

  test("throws on missing alg or kid in header", () => {
    const header = { alg: "RS256" }; // missing kid
    const payload = { sub: "test" };
    const token = createFakeJwt(header, payload);
    expect(() => parseJwt(token)).toThrow("missing alg or kid");
  });
});

describe("validateClaims", () => {
  const projectId = "my-project";

  function createValidPayload(
    overrides?: Partial<FirebaseTokenPayload>,
  ): FirebaseTokenPayload {
    const now = Math.floor(Date.now() / 1000);
    return {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: "user-123",
      iat: now - 60,
      exp: now + 3600,
      auth_time: now - 60,
      ...overrides,
    };
  }

  test("does not throw for valid claims", () => {
    const payload = createValidPayload();
    expect(() => validateClaims(payload, projectId)).not.toThrow();
  });

  test("throws for expired token", () => {
    const payload = createValidPayload({
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect(() => validateClaims(payload, projectId)).toThrow("expired");
  });

  test("throws for future iat", () => {
    const payload = createValidPayload({
      iat: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(() => validateClaims(payload, projectId)).toThrow(
      "issued in the future",
    );
  });

  test("throws for wrong audience", () => {
    const payload = createValidPayload({ aud: "wrong-project" });
    expect(() => validateClaims(payload, projectId)).toThrow(
      "Invalid audience",
    );
  });

  test("throws for wrong issuer", () => {
    const payload = createValidPayload({
      iss: "https://securetoken.google.com/wrong-project",
    });
    expect(() => validateClaims(payload, projectId)).toThrow("Invalid issuer");
  });

  test("throws for empty sub", () => {
    const payload = createValidPayload({ sub: "" });
    expect(() => validateClaims(payload, projectId)).toThrow("Invalid subject");
  });

  test("throws for future auth_time", () => {
    const payload = createValidPayload({
      auth_time: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(() => validateClaims(payload, projectId)).toThrow(
      "Invalid auth_time",
    );
  });
});

describe("parseCacheControlMaxAge", () => {
  test("parses max-age from Cache-Control header", () => {
    expect(parseCacheControlMaxAge("public, max-age=3600")).toBe(3600);
  });

  test("parses max-age when alone", () => {
    expect(parseCacheControlMaxAge("max-age=1800")).toBe(1800);
  });

  test("returns null for missing header", () => {
    expect(parseCacheControlMaxAge(null)).toBeNull();
  });

  test("returns null for header without max-age", () => {
    expect(parseCacheControlMaxAge("no-cache, no-store")).toBeNull();
  });

  test("parses max-age with multiple directives", () => {
    expect(
      parseCacheControlMaxAge("public, max-age=7200, must-revalidate"),
    ).toBe(7200);
  });
});
