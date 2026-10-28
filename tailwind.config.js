/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/client/index.html",
    "./src/client/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        foodsharing: {
          light: '#f59e0b',
          DEFAULT: '#d97706',
          dark: '#b45309'
        }
      }
    },
  },
  plugins: [],
}
