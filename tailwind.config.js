/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,ts,tsx}', // Astro components and templates
    './public/**/*.html'                     // Optional: if you have static HTML
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
