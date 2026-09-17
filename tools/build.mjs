// Publish only the site, never local tools, tests, dependencies, or credentials.
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
await build({
  entryPoints: [join(root, "js/vendor/glass-object.entry.js")],
  bundle: true, format: "esm", minify: true,
  outfile: join(root, "js/vendor/glass-object.js"),
});
await rm(output, { recursive: true, force: true });
await mkdir(join(output, "js/vendor"), { recursive: true });
for (const name of ["index.html", "404.html", "style.css", "_headers", "_routes.json", "assets"]) {
  await cp(join(root, name), join(output, name), { recursive: true });
}
for (const file of await readdir(join(root, "js"))) {
  if (file.endsWith(".js")) await cp(join(root, "js", file), join(output, "js", file));
}
await cp(join(root, "js/vendor/glass-object.js"), join(output, "js/vendor/glass-object.js"));
console.log("Built dist/ (Pages Functions remain in functions/ for Wrangler).");
