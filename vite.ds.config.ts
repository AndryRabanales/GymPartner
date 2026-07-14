import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/**
 * Library build for the GINX Design System.
 * Emits a UMD bundle exposing the global `GinxDS` plus a compiled stylesheet,
 * into dist-designsystem/. React / ReactDOM stay external.
 *
 * Run: npx vite build --config vite.ds.config.ts
 */
export default defineConfig({
  plugins: [react()],
  // The DS bundle must not carry the app's public/ assets.
  publicDir: false,
  css: {
    // Scope Tailwind to the design system so the CSS only carries DS utilities.
    postcss: {
      plugins: [tailwindcss({ config: './tailwind.ds.config.js' }), autoprefixer()],
    },
  },
  build: {
    outDir: 'dist-designsystem',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/design-system/index.ts'),
      name: 'GinxDS',
      formats: ['umd', 'es'],
      fileName: (format) => `ginx-ds.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        assetFileNames: 'ginx-ds.[ext]',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
  },
});
