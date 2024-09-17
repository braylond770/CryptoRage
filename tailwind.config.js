/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'spin-reverse': 'spin-reverse 12s linear infinite',
        'swipe': 'swipe 3s ease-in-out infinite',
        'capture-click': 'capture-click 0.3s ease-in-out',
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        },
        'swipe': {
          '0%, 100%': { transform: 'translateX(-100%) rotate(-45deg)' },
          '50%': { transform: 'translateX(100%) rotate(-45deg)' },
        },
        'capture-click': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.9)' },
        },
      }
    },
  },
  variants: {
    extend: {
      animation: ['group-hover'],
    }
  },
  plugins: [],
}