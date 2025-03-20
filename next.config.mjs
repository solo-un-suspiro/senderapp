/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para permitir la ejecución de procesos secundarios
  experimental: {
    serverComponentsExternalPackages: ["@whiskeysockets/baileys", "qrcode-terminal"],
  },
  // Configuración para Render
  output: "standalone",
}

module.exports = nextConfig

