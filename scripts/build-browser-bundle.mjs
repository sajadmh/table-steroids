import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const versionTag = `v${packageJson.version}`;

const browserBundle = buildBundle(path.join(distDir, "browser-runtime.js"));
const bookmarkletLoader = `${browserBundle};${buildBookmarkletLoaderRuntime(versionTag)}\n`;

writeFileSync(path.join(distDir, "browser.js"), `${browserBundle}\n`, "utf8");
writeFileSync(path.join(distDir, "bookmarklet-loader.js"), bookmarkletLoader, "utf8");

const bookmarklet = buildBookmarklet(
  `https://cdn.jsdelivr.net/npm/${packageJson.name}/dist/bookmarklet-loader.js`,
  bookmarkletLoader,
);
const inlineBookmarklet = buildInlineBookmarklet(bookmarkletLoader);

writeFileSync(path.join(distDir, "bookmarklet.txt"), `${bookmarklet}\n`, "utf8");
writeFileSync(path.join(distDir, "bookmarklet.inline.txt"), `${inlineBookmarklet}\n`, "utf8");
rmSync(path.join(distDir, "bookmarklet.github.txt"), { force: true });
updateReadmeBookmarkletSection({ bookmarklet });

function buildBundle(entryPath) {
  const modules = new Map();
  addModule(entryPath, modules);

  const factories = Array.from(modules.entries())
    .map(([moduleId, source]) => `${JSON.stringify(moduleId)}:function(exports,__require){${source}}`)
    .join(",");

  return `(()=>{const __factories={${factories}};const __cache={};const __require=(id)=>{if(__cache[id])return __cache[id];const factory=__factories[id];if(!factory)throw new Error("Unknown module: "+id);const exports={};__cache[id]=exports;factory(exports,__require);return exports;};__require(${JSON.stringify(
    toModuleId(entryPath),
  )});})();`;
}

function addModule(modulePath, modules) {
  const moduleId = toModuleId(modulePath);

  if (modules.has(moduleId)) {
    return;
  }

  let source = readFileSync(modulePath, "utf8")
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
    .trim();
  const dependencyPaths = [];

  source = source.replace(/^import\s+\{([\s\S]*?)\}\s+from\s+"(.+?)";$/gm, (_match, specifiers, specifier) => {
    const dependencyPath = path.resolve(path.dirname(modulePath), specifier);
    dependencyPaths.push(dependencyPath);

    return `const { ${transformSpecifiers(specifiers)} } = __require(${JSON.stringify(toModuleId(dependencyPath))});`;
  });

  dependencyPaths.forEach((dependencyPath) => addModule(dependencyPath, modules));

  const exportedEntries = [];

  source = source.replace(/^export\s+async function\s+([A-Za-z_$][\w$]*)\s*\(/gm, (_match, name) => {
    exportedEntries.push(name);
    return `async function ${name}(`;
  });
  source = source.replace(/^export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/gm, (_match, name) => {
    exportedEntries.push(name);
    return `function ${name}(`;
  });
  source = source.replace(/^export\s+class\s+([A-Za-z_$][\w$]*)/gm, (_match, name) => {
    exportedEntries.push(name);
    return `class ${name}`;
  });
  source = source.replace(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm, (_match, kind, name) => {
    exportedEntries.push(name);
    return `${kind} ${name} =`;
  });

  if (exportedEntries.length > 0) {
    source = `${source}\nObject.assign(exports,{${exportedEntries.join(",")}});`;
  }

  modules.set(moduleId, source);
}

function toModuleId(modulePath) {
  return normalizePath(path.relative(distDir, modulePath));
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function transformSpecifiers(specifiers) {
  return specifiers
    .split(",")
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .map((specifier) => {
      const [imported, local] = specifier.split(/\s+as\s+/).map((part) => part.trim());
      return local ? `${imported}:${local}` : imported;
    })
    .join(",");
}

function buildBookmarkletLoaderRuntime(versionTag) {
  return `(()=>{const g=globalThis;const d=g.document;if(!d)return;const versionTag=${JSON.stringify(versionTag)};const sourceKey="__tableSteroidsBookmarkletSource__";const sourceType=g[sourceKey]==="external"?"external":g[sourceKey]==="inline"?"inline":"fallback";const sourceValue=sourceType==="external"?"online latest version":sourceType==="inline"?"inline bundled version":"offline";const statusColor=sourceType==="external"?"rgb(34,197,94)":sourceType==="inline"?"rgb(148,163,184)":"rgb(250,204,21)";try{g.console?.info?.("[Table Steroids] Activated", { version: versionTag, source: sourceValue });}catch{}g.TableSteroids?.togglePage();const enabled=!!g.__tableSteroidsPageHandle__;const toastId="table-steroids-bookmarklet-toast";const existing=d.getElementById(toastId);if(existing){const timeoutId=Number(existing.getAttribute("data-timeout-id")||"0");if(timeoutId){g.clearTimeout(timeoutId);}existing.remove();}const toast=d.createElement("div");toast.id=toastId;toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");const label=d.createElement("div");label.textContent=enabled?"Table steroids enabled":"Table steroids disabled";label.style.font="600 14px/1.25 system-ui,sans-serif";const version=d.createElement("div");version.style.marginTop="3px";version.style.font="500 11px/1.2 system-ui,sans-serif";version.style.color="rgba(255,255,255,0.65)";version.style.display="inline-flex";version.style.alignItems="center";version.style.gap="6px";const statusDot=d.createElement("span");statusDot.style.width="8px";statusDot.style.height="8px";statusDot.style.borderRadius="9999px";statusDot.style.backgroundColor=statusColor;statusDot.style.flexShrink="0";const versionText=d.createElement("span");versionText.textContent=\`\${versionTag} \${sourceValue}\`;version.append(statusDot,versionText);toast.append(label,version);toast.style.position="fixed";toast.style.top="16px";toast.style.left="50%";toast.style.transform="translateX(-50%)";toast.style.padding="10px 14px";toast.style.borderRadius="10px";toast.style.background="rgba(17,24,39,0.92)";toast.style.color="#fff";toast.style.boxShadow="0 10px 30px rgba(0,0,0,0.2)";toast.style.zIndex="2147483647";toast.style.pointerEvents="none";toast.style.maxWidth="calc(100vw - 32px)";toast.style.textAlign="center";toast.style.overflow="hidden";(d.body||d.documentElement).appendChild(toast);const timeoutId=g.setTimeout(()=>{toast.remove();},5000);toast.setAttribute("data-timeout-id",String(timeoutId));delete g[sourceKey];})();`;
}

function buildBookmarklet(scriptUrl, fallbackSource) {
  const flattenedFallbackSource = flattenJavaScript(fallbackSource);

  return `javascript:(()=>{const g=globalThis;const d=g.document;if(!d)return;const sourceKey="__tableSteroidsBookmarkletSource__";const root=d.body||d.documentElement;if(!root)return;const log=(level,message,detail)=>{try{const logger=g.console?.[level];if(typeof logger==="function"){detail===undefined?logger.call(g.console,\`[Table Steroids] \${message}\`):logger.call(g.console,\`[Table Steroids] \${message}\`,detail);}}catch{}};const toastId="table-steroids-bookmarklet-toast";const existing=d.getElementById(toastId);if(existing){const timeoutId=Number(existing.getAttribute("data-timeout-id")||"0");if(timeoutId){g.clearTimeout(timeoutId);}existing.remove();}const toast=d.createElement("div");toast.id=toastId;toast.textContent="Enabling table steroids...";toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");toast.style.position="fixed";toast.style.top="16px";toast.style.left="50%";toast.style.transform="translateX(-50%)";toast.style.padding="10px 14px";toast.style.borderRadius="10px";toast.style.background="rgba(17,24,39,0.92)";toast.style.color="#fff";toast.style.font="500 14px/1.4 system-ui,sans-serif";toast.style.boxShadow="0 10px 30px rgba(0,0,0,0.2)";toast.style.zIndex="2147483647";toast.style.pointerEvents="none";toast.style.maxWidth="calc(100vw - 32px)";toast.style.whiteSpace="nowrap";toast.style.textOverflow="ellipsis";toast.style.overflow="hidden";root.appendChild(toast);const timeoutId=g.setTimeout(()=>{toast.remove();},5000);toast.setAttribute("data-timeout-id",String(timeoutId));const fail=()=>{log("error","Script not allowed.");toast.textContent="Script not allowed.";};const runFallback=(reason)=>{log("warn","Script not allowed, using offline version.", reason);toast.textContent="Script not allowed, using offline version.";g[sourceKey]="fallback";try{${flattenedFallbackSource}}catch(error){log("error","Fallback failed.", error);fail();}};const target=d.head||d.documentElement;if(!target){runFallback("No script injection target found.");return;}try{const s=d.createElement("script");let didFinish=false;const finish=()=>{didFinish=true;s.onerror=null;s.onload=null;};s.onload=()=>{if(didFinish){return;}finish();log("info","Using online latest version.", ${JSON.stringify(scriptUrl)});};s.onerror=(event)=>{if(didFinish){return;}finish();runFallback(event);};g[sourceKey]="external";log("info","Trying latest published build.", ${JSON.stringify(scriptUrl)});const tt=g.trustedTypes;const scriptSrc=tt?tt.createPolicy(\`table-steroids-bookmarklet-\${Date.now()}\`,{createScriptURL:(value)=>value}).createScriptURL(${JSON.stringify(
    scriptUrl,
  )}):${JSON.stringify(scriptUrl)};s.src=scriptSrc;s.async=true;target.appendChild(s);}catch(error){runFallback(error);}})();`;
}

function buildInlineBookmarklet(source) {
  return `javascript:(()=>{globalThis.__tableSteroidsBookmarkletSource__="inline";${flattenJavaScript(source)}})();`;
}

function flattenJavaScript(source) {
  return source
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("");
}

function updateReadmeBookmarkletSection({ bookmarklet }) {
  const readmePath = path.join(rootDir, "README.md");
  const startMarker = "<!-- bookmarklet-buttons:start -->";
  const endMarker = "<!-- bookmarklet-buttons:end -->";
  const readme = readFileSync(readmePath, "utf8");
  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("README.md is missing bookmarklet button markers.");
  }

  const section = [
    "",
    "1. Create a new bookmark in your browser.",
    "2. Name it `Table Steroids`.",
    "3. Paste this into the bookmark URL or location field:",
    "",
    "```text",
    bookmarklet,
    "```",
    "",
    "That bookmarklet tries the latest published build first, then falls back to the embedded build if the page blocks external scripts.",
    "It should report `online latest version` when the CDN loader runs and `offline` only when it falls back to the embedded build.",
    "If you do not want script injection at all, copy the inline-only version from [`dist/bookmarklet.inline.txt`](./dist/bookmarklet.inline.txt) into the bookmark URL instead; that variant reports `inline bundled version`.",
    "If both the external loader and the embedded fallback are blocked, the bookmarklet will show `Script not allowed.`.",
  ].join("\n");

  const nextReadme = `${readme.slice(0, startIndex + startMarker.length)}\n${section}\n${readme.slice(endIndex)}`;

  if (nextReadme !== readme) {
    writeFileSync(readmePath, nextReadme, "utf8");
  }
}
