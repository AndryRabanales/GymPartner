/**
 * Tailwind config scoped to the design system only, so the DS bundle's CSS
 * contains just the utilities its primitives use — not the whole app's.
 * Mirrors the `gym.*` palette from the app's tailwind.config.js.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./src/design-system/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gym: {
          primary: '#ffd700',
          dark: '#121212',
          card: '#1e1e1e',
          text: '#e0e0e0',
          accent: '#ff4d4d',
        },
      },
    },
  },
  plugins: [],
};
