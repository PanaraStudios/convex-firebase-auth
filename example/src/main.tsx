import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { FirebaseAuthProvider } from "@panarastudios/convex-firebase-auth/react";
import { api } from "../convex/_generated/api";
import App from "./App.jsx";
import "./index.css";

// Initialize Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// Initialize Convex
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <FirebaseAuthProvider
        auth={auth}
        verifyToken={api.example.verifyToken}
        getUser={api.example.getUser}
      >
        <App />
      </FirebaseAuthProvider>
    </ConvexProvider>
  </StrictMode>,
);
