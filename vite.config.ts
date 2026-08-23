import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

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

// https://vitejs.dev/config/
export default defineConfig({
  base: '/text-diff-tool/',
  plugins: [react(), developmentContentSecurityPolicyPlugin()],
  build: {
    outDir: 'docs',
  },
});
