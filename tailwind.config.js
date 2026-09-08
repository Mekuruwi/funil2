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
