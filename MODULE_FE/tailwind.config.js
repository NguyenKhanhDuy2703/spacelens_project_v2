/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0F1112",
        secondary: "#6F7478",
        tertiary: "#00A36C", // Terminal green
        neutral: "#FAFAF8",  // Research paper white
        surface: "#FFFFFF",
        "border-hairline": "#E5E7EB",
        alert: {
          error: "#D9383A",
          warning: "#E68A00",
          success: "#00A36C",
        }
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        md: "5px",
        lg: "8px",
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(15, 17, 18, 0.04), 0 1px 2px 0 rgba(15, 17, 18, 0.02)",
        elevated: "0 4px 6px -1px rgba(15, 17, 18, 0.06), 0 2px 4px -1px rgba(15, 17, 18, 0.03)",
      }
    },
  },
  plugins: [],
}
