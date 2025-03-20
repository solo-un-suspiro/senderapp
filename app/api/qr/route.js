import { NextResponse } from "next/server"
import path from "path"
import fs from "fs"

export async function GET() {
  try {
    // En Render, usamos /tmp para archivos temporales
    const tmpDir = process.env.NODE_ENV === "production" ? "/tmp" : process.cwd()
    const sessionDir = path.join(tmpDir, "whatsapp-sessions")
    const qrPath = path.join(sessionDir, "latest-qr.txt")

    // Verificar si existe el archivo QR
    if (fs.existsSync(qrPath)) {
      const qrCode = fs.readFileSync(qrPath, "utf8")

      // Devolver el código QR
      return NextResponse.json({
        qrCode: qrCode,
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`,
      })
    } else {
      return NextResponse.json({ error: "QR code not found" }, { status: 404 })
    }
  } catch (error) {
    console.error("Error retrieving QR code:", error)
    return NextResponse.json({ error: "Failed to retrieve QR code" }, { status: 500 })
  }
}

