// Bundles the Canvas UI engine. Uses esbuild's JS API rather than its CLI shim,
// which fails on this box (npm scripts spawn through cmd, which can't find node).
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
await build({
  absWorkingDir: root,
  entryPoints: ["js/vendor/glass-object.entry.js"],
  outfile: "js/vendor/glass-object.js",
  bundle: true,
  format: "esm",
  minify: true,
});
console.log("bundled js/vendor/glass-object.js");
