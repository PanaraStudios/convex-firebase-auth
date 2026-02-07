import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
  resolve: {
    alias: {
      "@panarastudios/convex-firebase-auth/test": path.resolve(
        import.meta.dirname,
        "src/test.ts",
      ),
      "@panarastudios/convex-firebase-auth/react": path.resolve(
        import.meta.dirname,
        "src/react/index.ts",
      ),
      "@panarastudios/convex-firebase-auth": path.resolve(
        import.meta.dirname,
        "src/client/index.ts",
      ),
    },
  },
});
