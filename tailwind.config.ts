import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#fffaf4",
        cream: "#f7efe4",
        ink: "#2c211d",
        clay: "#a45745",
        bordeaux: "#7e2f3f",
        moss: "#627668",
        honey: "#c89645",
        rose: "#f0d5ce",
        blush: "#f8e8e3"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(88, 52, 39, 0.12)",
        card: "0 12px 34px rgba(88, 52, 39, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
