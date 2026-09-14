/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 280ms ease-out both',
      },
      colors: {
        dark: {
          iridium: '#3D5064',
          blue: '#1B2A4E',
          black: '#0F172A',
        },
        light: {
          blue: '#1B2A4E',
          gray: '#F3F4F6',
          white: '#FFFFFF',
        }
      }
    },
  },
  plugins: [],
}
