/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#28211D', surface: '#28211D', raised: '#352D27', line: '#4B433E',
        cream: '#F5F2EF', muted: '#BDB8B3', faint: '#716C67', orange: '#FF5722', ink: '#261B15', danger: '#F3978C',
      },
      fontFamily: { body: ['DMSans'], medium: ['DMSansMedium'], mono: ['DMMono'] },
    },
  },
  plugins: [],
};
