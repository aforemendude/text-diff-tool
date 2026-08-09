import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const diffRuntimeModuleId = 'virtual:diff-match-patch-runtime';
const resolvedDiffRuntimeModuleId = `\0${diffRuntimeModuleId}`;
const diffEnginePath = new URL('./public/diff_match_patch_uncompressed.js', import.meta.url);
const vendorPatchPath = new URL('./public/vendor_patch.js', import.meta.url);

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
  plugins: [react(), diffRuntimePlugin()],
  worker: {
    plugins: () => [diffRuntimePlugin()],
  },
  build: {
    outDir: 'docs',
  },
});
