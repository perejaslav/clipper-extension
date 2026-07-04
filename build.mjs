import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";

const isWatch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  minify: true,
  target: "chrome120",
  format: "iife",
  treeShaking: true,
  logLevel: "info",
};

const entries = [
  { in: "src/clipper/index.js", out: "dist/content.js" },
  { in: "src/popup/popup.js", out: "dist/popup.js" },
];

async function buildAll() {
  await mkdir("dist", { recursive: true });
  const builds = entries.map(({ in: entry, out }) =>
    esbuild.build({
      ...shared,
      entryPoints: [entry],
      outfile: out,
    })
  );
  await Promise.all(builds);
  console.log("build: ok");
}

if (isWatch) {
  await mkdir("dist", { recursive: true });
  const contexts = await Promise.all(
    entries.map(({ in: entry, out }) =>
      esbuild.context({
        ...shared,
        entryPoints: [entry],
        outfile: out,
      })
    )
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("watching...");
} else {
  await buildAll();
}
