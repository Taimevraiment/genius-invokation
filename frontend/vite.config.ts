import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

function addScriptTagPlugin() {
  return {
    name: 'add-script-tag',
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === 'production') {
        return html.replace(
          '</head>',
          `<script src="https://sdk.51.la/perf/js-sdk-perf.min.js" crossorigin="anonymous"></script></head>`
        );
      }
      return html;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), addScriptTagPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@@': fileURLToPath(new URL('./public', import.meta.url)),
      '@@@': fileURLToPath(new URL('../common', import.meta.url)),
    }
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          cards: ['../common/data/cards'],
          heros: ['../common/data/heros'],
          summons: ['../common/data/summons'],
        },
        entryFileNames: `assets/dynamic/[name]-[hash].js`,
        chunkFileNames: `assets/dynamic/[name]-[hash].js`,
        assetFileNames: ({ name }) => {
          if (name.endsWith('.css')) return `assets/dynamic/[name]-[hash].css`
          return `assets/[name]-[hash][extname]`;
        }
      }
    }
  },
  server: {
    port: 5500,
  }
})
