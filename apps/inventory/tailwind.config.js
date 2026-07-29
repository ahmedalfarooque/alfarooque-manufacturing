/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* Premium cyan accent scale (shared across QuotePro / Projects /
           TrackFleet). Swapped from the old olive family — every existing
           `brand-*` utility re-tints automatically. */
        brand: {
          50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9',
          400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490',
          800: '#155E75', 900: '#164E63', 950: '#083344',
        },
      },
    },
  },
  plugins: [],
};
