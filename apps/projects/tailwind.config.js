/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF1E7', 100: '#D3DBC4', 200: '#BBC8A4', 300: '#A6B78A',
          400: '#93A374', 500: '#7D8F5C', 600: '#6B7A4F', 700: '#566440',
          800: '#46512F', 900: '#2E3620', 950: '#1D2314',
        },
      },
    },
  },
  plugins: [],
};
