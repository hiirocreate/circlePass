import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 店舗ごとに変更可能なアクセントカラーはCSS変数で管理する
        base: {
          white: "#FFFFFF",
          black: "#111111",
        },
        accent: "var(--shop-accent-color, #EA580C)", // デフォルトはビビッドなオレンジ
      },
      fontFamily: {
        sans: ["'Noto Sans JP'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
