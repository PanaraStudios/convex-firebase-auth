"use client";

import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useAction, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ConvexFirebaseUser {
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
}

interface FirebaseAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: ConvexFirebaseUser | null;
  firebaseUid: string | null;
  error: Error | null;
}

interface FirebaseAuthContextValue extends FirebaseAuthState {
  refreshAuth: () => Promise<void>;
}

// Firebase Auth types (minimal subset to avoid requiring firebase dependency)
interface FirebaseUser {
  uid: string;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

interface FirebaseAuth {
  onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void,
  ): () => void;
  currentUser: FirebaseUser | null;
}

// ─── Context ───────────────────────────────────────────────────────────────

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────

interface FirebaseAuthProviderProps {
  children: ReactNode;
  auth: FirebaseAuth;
  verifyToken: FunctionReference<"action", "public", { idToken: string }>;
  getUser: FunctionReference<
    "query",
    "public",
    { firebaseUid: string },
    ConvexFirebaseUser | null
  >;
}

export function FirebaseAuthProvider({
  children,
  auth,
  verifyToken,
  getUser,
}: FirebaseAuthProviderProps) {
  const [state, setState] = useState<FirebaseAuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    firebaseUid: null,
    error: null,
  });

  const verifyTokenAction = useAction(verifyToken);
  const firebaseUid = state.firebaseUid;
  const convexUser = useQuery(
    getUser,
    firebaseUid ? { firebaseUid } : "skip",
  );

  // Keep track of last verified UID to avoid double-verification
  const lastVerifiedUid = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doVerify = useCallback(
    async (user: FirebaseUser) => {
      try {
        const idToken = await user.getIdToken();
        await verifyTokenAction({ idToken });
        lastVerifiedUid.current = user.uid;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: true,
          firebaseUid: user.uid,
          error: null,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          user: null,
          firebaseUid: null,
          error: err instanceof Error ? err : new Error("Verification failed"),
        }));
      }
    },
    [verifyTokenAction],
  );

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // Only verify if this is a new user or first load
        if (lastVerifiedUid.current !== firebaseUser.uid) {
          setState((prev) => ({ ...prev, isLoading: true }));
          void doVerify(firebaseUser);
        }

        // Set up token refresh (Firebase tokens expire in 1 hour)
        // Refresh 5 minutes before expiry
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
        refreshTimerRef.current = setInterval(
          () => {
            void doVerify(firebaseUser);
          },
          55 * 60 * 1000,
        ); // Refresh every 55 minutes
      } else {
        // User signed out
        lastVerifiedUid.current = null;
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
        setState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          firebaseUid: null,
          error: null,
        });
      }
    });

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [auth, doVerify]);

  // Update user from Convex query
  useEffect(() => {
    if (convexUser !== undefined && state.isAuthenticated) {
      setState((prev) => ({
        ...prev,
        user: convexUser ?? null,
      }));
    }
  }, [convexUser, state.isAuthenticated]);

  const refreshAuth = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await doVerify(currentUser);
    }
  }, [auth, doVerify]);

  const contextValue: FirebaseAuthContextValue = {
    ...state,
    refreshAuth,
  };

  return createElement(
    FirebaseAuthContext.Provider,
    { value: contextValue },
    children,
  );
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error(
      "useFirebaseAuth must be used within a FirebaseAuthProvider",
    );
  }
  return context;
}

export function useCurrentUser(): ConvexFirebaseUser | null | undefined {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error(
      "useCurrentUser must be used within a FirebaseAuthProvider",
    );
  }
  if (context.isLoading) return undefined;
  return context.user;
}

export function useIsAuthenticated(): boolean {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    throw new Error(
      "useIsAuthenticated must be used within a FirebaseAuthProvider",
    );
  }
  return context.isAuthenticated;
}

// Re-export types
export type { ConvexFirebaseUser, FirebaseAuthState, FirebaseAuthProviderProps };
