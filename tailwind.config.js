/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-background-rgb) / <alpha-value>)", 
        surface: "rgb(var(--color-surface-rgb) / <alpha-value>)",   
        primary: "rgb(var(--color-primary-rgb) / <alpha-value>)",   
        secondary: "#58D5F7",
        info: "rgb(var(--color-info-rgb) / <alpha-value>)",
        success: "#10B981",    // Emerald
        warning: "#F59E0B",    // Amber
        error: "#EF4444",      // Red
        text: {
          DEFAULT: "rgb(var(--color-text-rgb) / <alpha-value>)",
          muted: "var(--color-text-muted)"
        }
      },
      fontFamily: {
        sans: ['SF Pro Text', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
