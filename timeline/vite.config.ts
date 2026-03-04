import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function githubOAuthDev(): Plugin {
  const env: Record<string, string> = {};

  return {
    name: 'github-oauth-dev',
    apply: 'serve',
    config() {
      try {
        const raw = readFileSync(resolve(__dirname, '..', '.env'), 'utf-8');
        for (const line of raw.split('\n')) {
          const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
          if (m) env[m[1]] = m[2].trim();
        }
      } catch { /* no .env file */ }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);

        if (url.pathname === '/api/auth/login') {
          const clientId = env.GITHUB_CLIENT_ID;
          if (!clientId) { res.writeHead(500); res.end('GITHUB_CLIENT_ID not set'); return; }
          const redirect = `http://${req.headers.host}/api/auth/callback`;
          const state = crypto.randomUUID();
          res.writeHead(302, {
            Location: `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=repo&state=${state}`,
            'Set-Cookie': `gh_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
          });
          res.end();
          return;
        }

        if (url.pathname === '/api/auth/callback') {
          const code = url.searchParams.get('code');
          if (!code) { res.writeHead(400); res.end('Missing code'); return; }

          fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              client_id: env.GITHUB_CLIENT_ID,
              client_secret: env.GITHUB_CLIENT_SECRET,
              code,
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.error) {
                res.writeHead(400);
                res.end(`OAuth error: ${data.error_description}`);
                return;
              }
              res.writeHead(302, {
                Location: `/timeline/#token=${data.access_token}`,
                'Set-Cookie': 'gh_oauth_state=; Path=/; HttpOnly; Max-Age=0',
              });
              res.end();
            })
            .catch((err) => { res.writeHead(500); res.end(String(err)); });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    githubOAuthDev(),
    tailwindcss(),
    svelte(),
  ],
  base: '/timeline/',
  build: {
    outDir: '../dist/timeline',
    emptyOutDir: true,
  },
});
