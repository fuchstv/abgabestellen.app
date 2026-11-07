const fsScale = (name) => ({
  100: `rgb(var(--fs-${name}-100) / <alpha-value>)`,
  200: `rgb(var(--fs-${name}-200) / <alpha-value>)`,
  300: `rgb(var(--fs-${name}-300) / <alpha-value>)`,
  400: `rgb(var(--fs-${name}-400) / <alpha-value>)`,
  500: `rgb(var(--fs-${name}-500) / <alpha-value>)`,
  DEFAULT: `rgb(var(--fs-${name}-500) / <alpha-value>)`,
  600: `rgb(var(--fs-${name}-600) / <alpha-value>)`,
  700: `rgb(var(--fs-${name}-700) / <alpha-value>)`,
  800: `rgb(var(--fs-${name}-800) / <alpha-value>)`,
  900: `rgb(var(--fs-${name}-900) / <alpha-value>)`,
});

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./src/client/index.html",
    "./src/client/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        headline: ['HeadlineFont', 'Georgia', 'serif'],
        sans: ['BodyFont', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        'fs-primary': fsScale('primary'),
        'fs-secondary': fsScale('secondary'),
        'fs-gray': fsScale('gray'),
        'fs-warning': fsScale('warning'),
        'fs-danger': fsScale('danger'),
        'fs-info': fsScale('info'),
        'fs-bg': 'rgb(var(--fs-bg) / <alpha-value>)',
        'fs-surface': 'rgb(var(--fs-surface) / <alpha-value>)',
        'fs-elevated': 'rgb(var(--fs-elevated) / <alpha-value>)',
        'fs-text': 'rgb(var(--fs-text) / <alpha-value>)',
        'fs-muted': 'rgb(var(--fs-muted) / <alpha-value>)',
        'fs-border': 'rgb(var(--fs-border) / <alpha-value>)',
      },
      borderRadius: {
        fs: '6px',
      },
      boxShadow: {
        fs: 'var(--fs-shadow)',
        'fs-card': 'var(--fs-shadow-card)',
      },
    },
  },
  plugins: [],
};
