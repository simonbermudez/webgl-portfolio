import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// The scene code references assets with hardcoded runtime paths like
// './app/public/img/texture-ball.png' and './app/public/3D/face-hp.glb', so the
// site must be served from the repo root with `app/public/` beneath it. We keep
// that layout: Vite's root is the repo root, the entry is the root index.html,
// and `app/public/` is copied verbatim into the build output (NOT flattened
// through Vite's default publicDir, which would break those paths).
export default defineConfig({
  publicDir: false,
  css: {
    preprocessorOptions: {
      // The `transition` LESS mixin uses inline JavaScript, which LESS 4
      // disables by default.
      less: { javascriptEnabled: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Multi-page build: the landing experience (index.html) and the
      // scroll-driven 3D storytelling resume (story.html).
      input: {
        main: 'index.html',
        story: 'story/index.html',
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        // Copy the whole public dir verbatim -> dist/app/public (preserves the
        // hardcoded ./app/public/... runtime asset paths).
        { src: 'app/public', dest: '.' },
        { src: ['favicon.ico', 'robots.txt', 'sitemap.xml', '404.html'], dest: '.' },
      ],
    }),
  ],
  server: {
    port: 8000,
    host: true,
    // Allow access through Cloudflare quick tunnels (*.trycloudflare.com) so the
    // dev server can be shared via a public link for live preview.
    allowedHosts: ['.trycloudflare.com'],
  },
});
