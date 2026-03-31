import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const rootDir = fileURLToPath(new URL("..", import.meta.url));

test("the root package entry loads without react installed", async () => {
  const module = await import("../dist/index.js");

  assert.equal(typeof module.enhanceTable, "function");
  assert.equal(typeof module.copySelectionToText, "function");
});

test("the browser assets are generated during build", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  const browserBundle = await readFile(new URL("../dist/browser.js", import.meta.url), "utf8");
  const bookmarklet = await readFile(new URL("../dist/bookmarklet.txt", import.meta.url), "utf8");
  const bookmarkletLoader = await readFile(new URL("../dist/bookmarklet-loader.js", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(browserBundle, /TableSteroids/);
  assert.match(bookmarklet, /^javascript:/);
  assert.match(bookmarklet, /Enabling table steroids/);
  assert.match(bookmarklet, /Script not allowed\./);
  assert.match(bookmarklet, /table-steroids-bookmarklet-toast/);
  assert.match(bookmarklet, /runFallback/);
  assert.match(bookmarklet, /Trying latest published build/);
  assert.match(bookmarklet, /Script not allowed, using offline version\./);
  assert.match(bookmarklet, /Using online latest version\./);
  assert.match(bookmarklet, /trustedTypes/);
  assert.match(bookmarklet, /createScriptURL/);
  assert.match(bookmarklet, /cdn\.jsdelivr\.net\/npm\/table-steroids\/dist\/bookmarklet-loader\.js/);
  assert.match(bookmarklet, /Table steroids enabled/);
  await assert.rejects(readFile(new URL("../dist/bookmarklet.inline.txt", import.meta.url), "utf8"), { code: "ENOENT" });
  await assert.rejects(readFile(new URL("../dist/bookmarklet.github.txt", import.meta.url), "utf8"), { code: "ENOENT" });
  assert.match(readme, /For app developers/);
  assert.match(readme, /For non-developers/);
  assert.match(readme, /Enhance any table across the web without installing anything by using a bookmarklet/);
  assert.match(readme, /Open \[`dist\/bookmarklet\.txt`\]\(https:\/\/github\.com\/sajadmh\/table-steroids\/blob\/main\/dist\/bookmarklet\.txt\)/);
  assert.match(readme, /tries the latest published build first, then falls back to the embedded build/);
  assert.match(readme, /latest version/);
  assert.match(readme, /offline version/);
  assert.doesNotMatch(readme, /dist\/bookmarklet\.inline\.txt/);
  assert.doesNotMatch(readme, /inline bundled version/);
  assert.match(readme, /Script not allowed\./);
  assert.doesNotMatch(readme, /```text\s+javascript:/);
  assert.match(bookmarkletLoader, /Table steroids enabled/);
  assert.match(bookmarkletLoader, /Table steroids disabled/);
  assert.match(bookmarkletLoader, new RegExp(`v${packageJson.version}`));
  assert.match(bookmarkletLoader, /latest version/);
  assert.match(bookmarkletLoader, /offline version/);
  assert.doesNotMatch(bookmarkletLoader, /inline bundled version/);
  assert.match(bookmarkletLoader, /https:\/\/github\.com\/sajadmh\/table-steroids/);
  assert.match(bookmarkletLoader, /offlineLink\.href=repoUrl/);
  assert.match(bookmarkletLoader, /const subtitleColor="rgba\(255,255,255,0\.65\)"/);
  assert.match(bookmarkletLoader, /const subtitleFont="500 11px\/1\.2 system-ui,sans-serif"/);
  assert.match(bookmarkletLoader, /offlineLink\.style\.color=subtitleColor/);
  assert.match(bookmarkletLoader, /offlineLink\.style\.font=subtitleFont/);
  assert.match(bookmarkletLoader, /offlineLink\.style\.textDecorationColor=subtitleColor/);
  assert.match(bookmarkletLoader, /toast\.style\.pointerEvents=sourceType==="fallback"\?"auto":"none"/);
  assert.match(bookmarkletLoader, /statusDot\.style\.backgroundColor=statusColor/);
  assert.match(bookmarkletLoader, /Activated/);
  assert.match(bookmarkletLoader, /source: sourceValue/);
  assert.match(browserBundle, /clipboardCell\.append\(\.\.\.Array\.from\(sourceCell\.element\.childNodes, \(node\) => node\.cloneNode\(true\)\)\)/);
  assert.doesNotMatch(browserBundle, /clipboardCell\.innerHTML = sourceCell\.element\.innerHTML/);
  assert.match(bookmarkletLoader, /versionText\.textContent/);
  assert.match(bookmarkletLoader, /version\.style\.color=subtitleColor/);
  assert.match(bookmarkletLoader, /version\.style\.font=subtitleFont/);
  assert.match(bookmarkletLoader, /toast\.append\(label,version\)/);
  assert.match(bookmarkletLoader, /table-steroids-bookmarklet-toast/);
  assert.match(bookmarkletLoader, /5000/);
});

test("npm pack excludes bookmarklet text assets while keeping the loader", async () => {
  const npmCacheDir = await mkdtemp(`${tmpdir()}/table-steroids-npm-cache-`);
  const { stdout } = await execFileAsync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: rootDir,
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
  const [packResult] = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
  const packedFiles = new Set(packResult.files.map((file) => file.path));

  assert(packedFiles.has("dist/bookmarklet-loader.js"));
  assert(packedFiles.has("dist/browser.js"));
  assert(!packedFiles.has("dist/bookmarklet.txt"));
  assert(!packedFiles.has("dist/bookmarklet.inline.txt"));
});
