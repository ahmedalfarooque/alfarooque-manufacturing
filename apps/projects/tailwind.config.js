/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E6F6FA', 100: '#C0EAF3', 200: '#93DCEC', 300: '#6FE0F2',
          400: '#34C3E0', 500: '#0EA5C4', 600: '#0C93AE', 700: '#076B80',
          800: '#054F5F', 900: '#0A2A33', 950: '#06181E',
        },
      },
    },
  },
  plugins: [],
};
