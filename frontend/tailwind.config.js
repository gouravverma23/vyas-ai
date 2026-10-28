/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkbg: '#0A0A0A',
        surface: {
          50: '#121212',
          100: '#161616',
          200: '#1F1F1F',
          300: '#292929',
          400: '#383838',
        },
        accent: {
          primary: '#6366F1', // Indigo
          cyan: '#06B6D4',
          emerald: '#10B981',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [],
}
