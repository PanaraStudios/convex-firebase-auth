import "./App.css";
import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  useFirebaseAuth,
  useCurrentUser,
  useIsAuthenticated,
} from "@panarastudios/convex-firebase-auth/react";
import { api } from "../convex/_generated/api";

function AuthForms() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const auth = getAuth();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

  const handleAnonymousSignIn = async () => {
    setError(null);
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Anonymous sign-in failed",
      );
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto" }}>
      <h2>{mode === "signin" ? "Sign In" : "Sign Up"}</h2>

      <form onSubmit={handleEmailAuth} style={{ marginBottom: "1rem" }}>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        <button type="submit" style={{ width: "100%", padding: "0.5rem" }}>
          {mode === "signin" ? "Sign In" : "Sign Up"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        style={{
          background: "none",
          border: "none",
          color: "#007bff",
          cursor: "pointer",
          marginBottom: "1rem",
        }}
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <button
          onClick={handleGoogleSignIn}
          style={{
            padding: "0.5rem",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
        <button
          onClick={handleAnonymousSignIn}
          style={{
            padding: "0.5rem",
            backgroundColor: "#666",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Sign in Anonymously
        </button>
      </div>

      {error && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>
      )}
    </div>
  );
}

function UserProfile() {
  const user = useCurrentUser();
  const { refreshAuth } = useFirebaseAuth();
  const convexSignOut = useMutation(api.example.signOut);
  const sendPasswordReset = useAction(api.example.sendPasswordResetEmail);
  const [resetSent, setResetSent] = useState(false);

  if (user === undefined) {
    return <p>Loading user profile...</p>;
  }

  if (!user) {
    return <p>No user data found.</p>;
  }

  const handleSignOut = async () => {
    const auth = getAuth();
    await convexSignOut({ firebaseUid: user.firebaseUid });
    await firebaseSignOut(auth);
  };

  const handlePasswordReset = async () => {
    if (user.email) {
      await sendPasswordReset({ email: user.email });
      setResetSent(true);
    }
  };

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "0 auto",
        textAlign: "left",
        padding: "1rem",
        border: "1px solid rgba(128, 128, 128, 0.3)",
        borderRadius: "8px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Profile</h2>

      {user.photoURL && (
        <img
          src={user.photoURL}
          alt="Profile"
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            marginBottom: "1rem",
          }}
        />
      )}

      <div style={{ marginBottom: "0.5rem" }}>
        <strong>Display Name:</strong>{" "}
        {user.displayName ?? "Not set"}
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>Email:</strong> {user.email ?? "Not set"}
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>Email Verified:</strong>{" "}
        {user.emailVerified ? "Yes" : "No"}
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>Provider:</strong>{" "}
        {user.providerId ?? "Unknown"}
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>Anonymous:</strong>{" "}
        {user.isAnonymous ? "Yes" : "No"}
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <strong>Firebase UID:</strong>{" "}
        <code style={{ fontSize: "0.8rem" }}>{user.firebaseUid}</code>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <button onClick={() => void refreshAuth()}>Refresh Auth</button>
        {user.email && !user.isAnonymous && (
          <button onClick={handlePasswordReset} disabled={resetSent}>
            {resetSent ? "Password Reset Email Sent" : "Send Password Reset"}
          </button>
        )}
        <button
          onClick={handleSignOut}
          style={{
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            padding: "0.5rem",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function App() {
  const isAuthenticated = useIsAuthenticated();
  const { isLoading, error } = useFirebaseAuth();

  return (
    <>
      <h1>Firebase Auth + Convex Demo</h1>
      <div className="card">
        {isLoading ? (
          <p>Loading...</p>
        ) : error ? (
          <div>
            <p style={{ color: "red" }}>Error: {error.message}</p>
            <AuthForms />
          </div>
        ) : isAuthenticated ? (
          <UserProfile />
        ) : (
          <AuthForms />
        )}
      </div>
    </>
  );
}

export default App;
