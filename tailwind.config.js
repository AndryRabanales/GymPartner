/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
        colors: {
            gym: {
                primary: '#ffd700', // Gold
                dark: '#121212',
                card: '#1e1e1e',
                text: '#e0e0e0',
                accent: '#ff4d4d' 
            }
        }
    },
  },
  plugins: [],
}
