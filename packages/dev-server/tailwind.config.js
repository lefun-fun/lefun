/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      spacing: {
        full: "100%",
        "1/2": "50%",
        "1/3": "33.333333%",
        "2/3": "66.666667%",
        "1/4": "25%",
        "3/4": "75%",
        "1/8": "12.5%",
        "3/8": "37.5%",
        "5/8": "62.5%",
        "7/8": "87.5%",
        "1/12": "8.333333%",
        "5/12": "41.666667%",
        "7/12": "58.333333%",
        "11/12": "91.666667%",
      },
    },
  },
  plugins: [],
};
