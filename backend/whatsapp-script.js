const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const { Boom } = require("@hapi/boom")
const fs = require("fs")
const path = require("path")
const qrcode = require("qrcode-terminal")

// Get phone number from command line args
const phoneNumber = process.argv[2]
if (!phoneNumber) {
  console.error("Phone number is required")
  process.exit(1)
}

// Ensure the sessions directory exists
const SESSION_DIR = path.join(process.cwd(), "whatsapp-sessions")
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
}

async function connectToWhatsApp() {
  try {
    // Get authentication state
    const authState = await useMultiFileAuthState(SESSION_DIR)
    const { state, saveCreds } = authState

    // Create WhatsApp socket
    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      browser: ["Chrome (Linux)", "Chrome", "103.0.5060.114"],
    })

    // Handle connection updates
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        // If QR code is available, display it in terminal
        qrcode.generate(qr, { small: true })
        console.log("QR CODE GENERATED - PLEASE SCAN WITH WHATSAPP")
      }

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error instanceof Boom &&
          lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut

        if (shouldReconnect) {
          console.log("Connection closed due to error, reconnecting...")
          connectToWhatsApp()
        } else {
          console.log("Connection closed. You are logged out.")
          process.exit(1)
        }
      } else if (connection === "open") {
        console.log("Connection opened successfully!")

        try {
          // Format the phone number (remove any non-numeric characters)
          const formattedNumber = phoneNumber.replace(/\D/g, "")

          // Send the message
          await sock.sendMessage(`${formattedNumber}@s.whatsapp.net`, {
            text: "hola",
          })

          console.log("Message sent successfully!")
          process.exit(0)
        } catch (error) {
          console.error("Error sending message:", error)
          process.exit(1)
        }
      }
    })

    // Save credentials on change
    sock.ev.on("creds.update", saveCreds)
  } catch (error) {
    console.error("Error in WhatsApp connection:", error)
    process.exit(1)
  }
}

// Start the connection
connectToWhatsApp()

