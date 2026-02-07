import { defineApp } from "convex/server";
import convexFirebaseAuth from "panarastudios/convex-firebase-auth/convex.config.js";

const app = defineApp();
app.use(convexFirebaseAuth);

export default app;
