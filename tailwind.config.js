/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        primary: {
          50: '#f5fbe9',
          100: '#e8f6cf',
          200: '#d0edad',
          300: '#b0e081',
          400: '#94d058',
          500: '#7bb73a', // Dalux-like base green
          600: '#5f912a',
          700: '#487023',
          800: '#3a591f',
          900: '#324a1e',
        }
      }
    },
  },
  plugins: [],
}
