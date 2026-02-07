/**
 * Pure JWT utility functions for Firebase token verification.
 * Uses Web Crypto API - no external dependencies.
 */

export interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}

export interface FirebaseTokenPayload {
  iss: string;
  aud: string;
  auth_time: number;
  sub: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  phone_number?: string;
  firebase?: {
    sign_in_provider?: string;
    identities?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface ParsedJwt {
  header: JwtHeader;
  payload: FirebaseTokenPayload;
  signedContent: string;
  signature: Uint8Array;
}

export function base64urlDecode(str: string): Uint8Array {
  // Replace base64url chars with base64 chars
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '='
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function parseJwt(token: string): ParsedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected 3 parts");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: JwtHeader;
  let payload: FirebaseTokenPayload;

  try {
    const headerJson = new TextDecoder().decode(base64urlDecode(headerB64));
    header = JSON.parse(headerJson) as JwtHeader;
  } catch {
    throw new Error("Invalid JWT: failed to decode header");
  }

  try {
    const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
    payload = JSON.parse(payloadJson) as FirebaseTokenPayload;
  } catch {
    throw new Error("Invalid JWT: failed to decode payload");
  }

  if (!header.alg || !header.kid) {
    throw new Error("Invalid JWT header: missing alg or kid");
  }

  const signature = base64urlDecode(signatureB64);
  const signedContent = `${headerB64}.${payloadB64}`;

  return { header, payload, signedContent, signature };
}

export function validateClaims(
  payload: FirebaseTokenPayload,
  projectId: string,
): void {
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp <= now) {
    throw new Error("Token has expired");
  }

  if (!payload.iat || payload.iat > now) {
    throw new Error("Token issued in the future");
  }

  if (payload.aud !== projectId) {
    throw new Error(
      `Invalid audience: expected ${projectId}, got ${payload.aud}`,
    );
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(
      `Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`,
    );
  }

  if (!payload.sub || typeof payload.sub !== "string" || payload.sub === "") {
    throw new Error("Invalid subject: sub must be a non-empty string");
  }

  if (
    payload.auth_time === undefined ||
    payload.auth_time === null ||
    payload.auth_time > now
  ) {
    throw new Error("Invalid auth_time");
  }
}

export async function importJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export async function verifyRS256Signature(
  signedContent: string,
  signature: Uint8Array,
  publicKey: CryptoKey,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(signedContent);
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature.buffer as ArrayBuffer,
    data.buffer as ArrayBuffer,
  );
}

export function parseCacheControlMaxAge(
  headerValue: string | null,
): number | null {
  if (!headerValue) return null;
  const match = headerValue.match(/max-age=(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data.buffer as ArrayBuffer,
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
