import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";

// Plugin to copy Chrome extension files
const copyExtensionFiles = () => {
  return {
    name: "copy-extension-files",
    writeBundle() {
      const files = ["manifest.json", "popup.html", "popup.js", "styles.css"];

      // Create icons directory if it doesn't exist
      if (!existsSync("dist/icons")) {
        mkdirSync("dist/icons", { recursive: true });
      }

      // Copy main files
      files.forEach((file) => {
        if (existsSync(file)) {
          copyFileSync(file, `dist/${file}`);
        }
      });

      // Copy utils directory if it exists
      if (existsSync("utils")) {
        if (!existsSync("dist/utils")) {
          mkdirSync("dist/utils", { recursive: true });
        }
        if (existsSync("utils/ai.js")) {
          copyFileSync("utils/ai.js", "dist/utils/ai.js");
        }
      }

      // Copy icons if they exist
      const iconSizes = ["16", "48", "128"];
      iconSizes.forEach((size) => {
        const iconPath = `icons/icon${size}.png`;
        if (existsSync(iconPath)) {
          copyFileSync(iconPath, `dist/icons/icon${size}.png`);
        }
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "background.js"),
        contentScript: resolve(__dirname, "contentScript.js"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split("/").pop()
            : "unknown";
          return `${facadeModuleId}`;
        },
      },
    },
    copyPublicDir: false,
  },
  publicDir: false,
});
