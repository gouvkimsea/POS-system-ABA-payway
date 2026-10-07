/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pos: {
          dark: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          primary: '#2563eb',
          accent: '#059669',
          danger: '#dc2626',
          warning: '#d97706',
        },
      },
      screens: {
        pos: '1024px', // Standard POS terminal touchscreen breakpoint
      },
    },
  },
  plugins: [],
};
