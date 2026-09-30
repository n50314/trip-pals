import { readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const buildDirectory = path.resolve(".open-next");
const generatedWorker = path.join(buildDirectory, "worker.js");
const originalWorker = path.join(buildDirectory, "open-next-worker.js");
const wrapperTemplate = await readFile(path.resolve("worker-entry.js"), "utf8");
const wrapper = wrapperTemplate.replace(
  '"./.open-next/worker.js"',
  '"./open-next-worker.js"',
);

if (wrapper === wrapperTemplate) {
  throw new Error("Could not find the OpenNext import in worker-entry.js.");
}

await rm(originalWorker, { force: true });
await rename(generatedWorker, originalWorker);
await writeFile(generatedWorker, wrapper);
for (const moduleName of ["sheet-xlsx.js", "ai-provider.js", "ai-chat.js", "maps-grounding.js"]) {
  await build({
    entryPoints: [path.resolve(moduleName)],
    outfile: path.join(buildDirectory, moduleName),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
  });
}

const localEnvPath = path.resolve(".env.local");
let localEnv = "";
try {
  localEnv = await readFile(localEnvPath, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const secrets = localEnv
  .split(/\r?\n/)
  .map((line) => line.match(/^([A-Z0-9_]*(?:KEY|SECRET|TOKEN))=(.+)$/)?.[2]?.trim())
  .filter((value) => value && value.length >= 16);

async function scrubSecrets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scrubSecrets(target);
      continue;
    }
    let content = await readFile(target);
    for (const secret of secrets) {
      const needle = Buffer.from(secret);
      if (!content.includes(needle)) continue;
      content = Buffer.from(content.toString("utf8").replaceAll(secret, ""));
      await writeFile(target, content);
    }
  }
}

await scrubSecrets(buildDirectory);
console.log("Wrapped the OpenNext worker with the Trip Pals API routes.");
