import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const diffRuntimeModuleId = 'virtual:diff-match-patch-runtime';
const resolvedDiffRuntimeModuleId = `\0${diffRuntimeModuleId}`;
const diffEnginePath = new URL('./public/diff_match_patch_uncompressed.js', import.meta.url);
const vendorPatchPath = new URL('./public/vendor_patch.js', import.meta.url);
const productionContentSecurityPolicy =
  "default-src 'none'; img-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; base-uri 'none'; form-action 'none';";

function developmentContentSecurityPolicyPlugin(): Plugin {
  return {
    name: 'development-content-security-policy',
    apply: 'serve',
    transformIndexHtml(html, { server }) {
      const resolvedUrls = server?.resolvedUrls;
      if (!resolvedUrls) {
        throw new Error('The development server URLs must be resolved before transforming the CSP.');
      }

      const webSocketSources = [...resolvedUrls.local, ...resolvedUrls.network].map((serverUrl) => {
        const webSocketUrl = new URL(serverUrl);
        webSocketUrl.protocol = webSocketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        return webSocketUrl.href;
      });

      const productionCspAttribute = `content="${productionContentSecurityPolicy}"`;
      if (!html.includes(productionCspAttribute)) {
        throw new Error('The production CSP in index.html does not match the Vite configuration.');
      }

      const developmentContentSecurityPolicy = `${productionContentSecurityPolicy} connect-src ${webSocketSources.join(' ')};`;
      return html.replace(productionCspAttribute, `content="${developmentContentSecurityPolicy}"`);
    },
  };
}

function diffRuntimePlugin(): Plugin {
  return {
    name: 'diff-match-patch-runtime',
    resolveId(id) {
      return id === diffRuntimeModuleId ? resolvedDiffRuntimeModuleId : undefined;
    },
    load(id) {
      if (id !== resolvedDiffRuntimeModuleId) {
        return undefined;
      }

      // The vendored browser script exports through top-level `this`. A module has no top-level `this`, so point those
      // four existing global assignments at globalThis when packaging the unchanged source for the worker realm.
      const diffEngine = readFileSync(diffEnginePath, 'utf8').replace(/^this\[/gm, 'globalThis[');
      const vendorPatch = readFileSync(vendorPatchPath, 'utf8');
      return `${diffEngine}\n${vendorPatch}`;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/text-diff-tool/',
  plugins: [react(), developmentContentSecurityPolicyPlugin(), diffRuntimePlugin()],
  worker: {
    plugins: () => [diffRuntimePlugin()],
  },
  build: {
    outDir: 'docs',
  },
});
