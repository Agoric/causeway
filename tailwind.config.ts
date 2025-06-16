import { Config } from 'tailwindcss';

const config: Config = {
  content: ['src/**/!(*.spec).ts', 'src/**/!(*.spec).tsx'],
  darkMode: 'class',
  plugins: [],
  theme: {
    extend: {
      colors: {
        blue: {
          100: '#EFF6FF',
          500: '#2563EB',
          700: '#2563EB',
          800: '#172963',
        },
        gray: {
          D500: '#8F9199',
          D600: '#7F818B',
          D1200: '#303239',
          L50: '#F9FAFB',
          L100: '#F3F4F6',
          L200: '#E5E7EB',
          L300: '#D1D5DB',
        },
        green: {
          50: '#F3FCF6',
          500: '#33B25F',
        },
        orange: {
          500: '#F97316',
        },
        red: {
          25: '#FEF6F6',
          500: '#EF4444',
        },
        white: '#FFFFFF',
        yellow: {
          50: '#FFF7ED',
          100: '#FEF9C3',
          200: '#FEF08A',
        },
      },
    },
  },
};

export default config;
