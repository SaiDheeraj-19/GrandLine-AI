/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "on-tertiary": "#68000a",
        "inverse-on-surface": "#2c303c",
        "on-secondary-container": "#00344e",
        "on-primary-container": "#765900",
        "on-secondary-fixed": "#001e2f",
        "on-primary": "#3f2e00",
        "on-tertiary-fixed": "#410004",
        "tertiary-fixed": "#ffdad7",
        "surface-container-lowest": "#0a0e19",
        "primary-fixed-dim": "#edc157",
        "surface-container-highest": "#313441",
        "on-primary-fixed": "#251a00",
        "primary-container": "#ffd166",
        "outline-variant": "#4e4636",
        "surface-container": "#1b1f2b",
        "inverse-primary": "#785a00",
        "on-secondary": "#00344d",
        "primary-fixed": "#ffdf9b",
        "tertiary-fixed-dim": "#ffb3ad",
        "surface": "#0f131e",
        "secondary-fixed-dim": "#89ceff",
        "error-container": "#93000a",
        "secondary-fixed": "#c9e6ff",
        "background": "#0f131e",
        "secondary": "#89ceff",
        "secondary-container": "#00a2e6",
        "primary": "#fff2dc",
        "on-tertiary-fixed-variant": "#930013",
        "on-surface": "#dfe2f2",
        "surface-container-low": "#171b27",
        "inverse-surface": "#dfe2f2",
        "on-tertiary-container": "#b81923",
        "on-error": "#690005",
        "tertiary": "#fff0ef",
        "surface-dim": "#0f131e",
        "on-surface-variant": "#d1c5b1",
        "tertiary-container": "#ffcbc7",
        "surface-tint": "#edc157",
        "on-error-container": "#ffdad6",
        "error": "#ffb4ab",
        "on-background": "#dfe2f2",
        "outline": "#9a8f7d",
        "surface-variant": "#313441",
        "on-secondary-fixed-variant": "#004c6e",
        "surface-container-high": "#262a36",
        "surface-bright": "#353945",
        "on-primary-fixed-variant": "#5b4300"
      },
      borderRadius: {
        "DEFAULT": "0rem",
        "lg": "0rem",
        "xl": "0rem",
        "full": "9999px"
      },
      fontFamily: {
        "headline": ["Space Grotesk", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Manrope", "sans-serif"]
      },
      keyframes: {
        'scan-up': {
          '0%': { top: '100%' },
          '100%': { top: '0%' }
        }
      },
      animation: {
        'scan-up': 'scan-up 10s linear infinite'
      }
    },
  },
  plugins: [],
};
