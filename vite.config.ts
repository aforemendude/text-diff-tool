import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { APPLICATION_BASE_URL } from './src/config.ts';

const productionContentSecurityPolicy =
  "default-src 'none'; font-src 'self'; img-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; base-uri 'none'; form-action 'none';";
const loopbackHostnames = ['localhost', '127.0.0.1', '[::1]'];

function developmentWebSocketSources(serverUrls: string[]): string[] {
  const sources = new Set<string>();

  for (const serverUrl of serverUrls) {
    const webSocketUrl = new URL(serverUrl);
    webSocketUrl.protocol = webSocketUrl.protocol === 'https:' ? 'wss:' : 'ws:';

    const hostnames = loopbackHostnames.includes(webSocketUrl.hostname) ? loopbackHostnames : [webSocketUrl.hostname];
    for (const hostname of hostnames) {
      const source = new URL(webSocketUrl);
      source.hostname = hostname;
      sources.add(source.href);
    }
  }

  return [...sources];
}

function developmentContentSecurityPolicyPlugin(): Plugin {
  return {
    name: 'development-content-security-policy',
    apply: 'serve',
    transformIndexHtml(html, { server }) {
      const resolvedUrls = server?.resolvedUrls;
      if (!resolvedUrls) {
        throw new Error('The development server URLs must be resolved before transforming the CSP.');
      }

      const webSocketSources = developmentWebSocketSources([...resolvedUrls.local, ...resolvedUrls.network]);

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
  base: APPLICATION_BASE_URL,
  plugins: [react(), developmentContentSecurityPolicyPlugin()],
  build: {
    outDir: 'docs',
  },
});
