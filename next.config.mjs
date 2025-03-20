/** @type {import('next').NextConfig} */
const nextConfig = {
    // Configuración para permitir la ejecución de procesos secundarios
    experimental: {
      serverComponentsExternalPackages: ["@whiskeysockets/baileys", "qrcode-terminal"],
    },
    // Configuración para Render
    output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  }
  
  module.exports = nextConfig
  
  