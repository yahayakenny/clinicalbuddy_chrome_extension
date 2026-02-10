/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./*.js"],
  theme: {
    extend: {
      colors: {
        primaryButton: "#FFD327",
        secondaryButton: "#000000",
        tertiaryButton: "#14B8A6",
        primaryBackground: "#FFF6DB",
        primaryGray: "#FAF9F6",
      },
    },
  },
  plugins: [],
};
