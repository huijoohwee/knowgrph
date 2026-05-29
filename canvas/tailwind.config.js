/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../gympgrph/src/**/*.{js,ts,jsx,tsx}",
  ],
  blocklist: [
    "[-:_./\\\\]",
    "[a-z0-9:_-]",
    "[A-Za-z0-9:_-]",
    "[A-Za-z0-9^:._-]",
    "[A-Za-z0-9_.-]",
    "[A-Za-z0-9_:-]",
  ],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [],
};
