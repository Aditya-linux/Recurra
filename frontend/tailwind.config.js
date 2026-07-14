/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'tt-norms': ['"TT Norms Pro"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'hero-display': ['"Bodoni Moda"', 'serif'],
        'hero-serif': ['"Bodoni Moda"', 'serif'],
        'sans': ['"Onest"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}


