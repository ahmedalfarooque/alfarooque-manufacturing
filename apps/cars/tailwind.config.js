/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefcfb', 100: '#d3f6f2', 200: '#a6ede5', 300: '#6fded3',
          400: '#3cc7b9', 500: '#14a89b', 600: '#0f877e', 700: '#0d6c66',
          800: '#0c5652', 900: '#0a4643', 950: '#04282a',
        },
      },
    },
  },
  plugins: [],
};
