"use client"

import { useState } from "react"

export default function WhatsAppSender() {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [status, setStatus] = useState({ type: "", message: "" })
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState(null)

  const sendMessage = async () => {
    if (!phoneNumber) {
      setStatus({ type: "error", message: "Por favor ingresa un número de teléfono" })
      return
    }

    try {
      setLoading(true)
      setStatus({ type: "loading", message: "Enviando mensaje..." })
      setQrCode(null)

      const response = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.needsQrScan) {
          setStatus({
            type: "info",
            message: "Por favor escanea el código QR para autenticar WhatsApp",
          })

          // Si tenemos un QR code o URL, mostrarlo
          if (data.qrUrl) {
            setQrCode(data.qrUrl)
          } else if (data.qrCode) {
            setQrCode(
              `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.qrCode)}`,
            )
          }
        } else {
          setStatus({ type: "success", message: "Mensaje enviado con éxito" })
          setQrCode(null)

          // Limpiar el mensaje de éxito después de 3 segundos
          setTimeout(() => {
            setStatus({ type: "", message: "" })
          }, 3000)
        }
      } else {
        setStatus({
          type: "error",
          message: data.error || "Error al enviar el mensaje",
        })
      }
    } catch (error) {
      console.error("Error:", error)
      setStatus({ type: "error", message: "Error de conexión" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Enviar mensaje de WhatsApp</h1>

        <div className="mb-4">
          <label htmlFor="phone-number" className="block text-sm font-medium mb-1">
            Número de teléfono
          </label>
          <input
            type="text"
            id="phone-number"
            placeholder="Ejemplo: 5219991234567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">Incluye el código de país (ej: 521 para México)</p>
        </div>

        {status.message && (
          <div
            className={`p-3 rounded-md mb-4 ${
              status.type === "success"
                ? "bg-green-100 text-green-700"
                : status.type === "error"
                  ? "bg-red-100 text-red-700"
                  : status.type === "info"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
            }`}
          >
            {status.message}
          </div>
        )}

        {qrCode && (
          <div className="mb-4 flex justify-center">
            <div className="p-2 border border-gray-300 rounded-md bg-white">
              <img
                src={qrCode || "/placeholder.svg"}
                alt="Código QR para WhatsApp"
                width={200}
                height={200}
                className="mx-auto"
              />
              <p className="text-xs text-center mt-2 text-gray-500">Escanea este código con WhatsApp</p>
            </div>
          </div>
        )}

        <button
          onClick={sendMessage}
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {loading ? "Enviando..." : 'Enviar "hola"'}
        </button>
      </div>
    </div>
  )
}

