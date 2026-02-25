/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        nowify: {
          primary: "#427E59",
          "primary-dark": "#35634a",
          "primary-light": "#5a9d76",
          success: "#427E59",
          warning: "#c9a227",
          danger: "#b53d3d",
          neutral: "#5a6c5d",
          bg: "#f4f7f5",
          card: "#ffffff",
          border: "#e2e8e4",
          text: "#1a2e22",
          muted: "#6b7c72",
          "avatar-bg": "#e8ece9",
          "upcoming-bg": "#f5eef8",
          "message-bg": "#d4e5da",
          "form-panel": "#f8faf8",
          "card-header": "#8b9d94",
          "accent": "#60a5fa",
          "accent-light": "#dbeafe",
        },
      },
    },
  },
  plugins: [],
};
