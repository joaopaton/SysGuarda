/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oliva: "#3a4220",
        olivaEsc: "#2a3017",
        olivaClaro: "#4d5829",
        caqui: "#c9bd9e",
        caquiClaro: "#e8e1cd",
        areia: "#a89968",
        verdeMil: "#5a6b35",
        verdeBrilho: "#8a9a4d",
        amareloMil: "#d4b942",
        vermelho: "#8b3a2f",
        preto: "#1a1d12",
        linha: "#5a6035",
      },
      fontFamily: {
        estencil: ["'Stardos Stencil'", "'Arial Black'", "sans-serif"],
        cond: ["'Oswald'", "'Arial Narrow'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
