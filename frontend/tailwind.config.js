/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        }
      },
      fontFamily: {
        // "sans" est la police par défaut de Tailwind. On la remplace par Open Sans.
        sans: ['"Open Sans"', 'sans-serif'],
        // On crée une classe utilitaire "font-heading" pour tes titres
        heading: ['"Montserrat"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
