import { NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import fs from "fs"

// Función para escribir en el archivo de log
function writeToLog(message) {
  try {
    // En Render, usamos /tmp para archivos temporales
    const logDir = process.env.NODE_ENV === "production" ? "/tmp" : process.cwd()
    const logPath = path.join(logDir, "whatsapp-log.txt")
    const timestamp = new Date().toISOString()
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`)
  } catch (error) {
    console.error("Error writing to log:", error)
  }
}

export async function POST(request) {
  try {
    // Obtener datos de la solicitud
    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    writeToLog(`Recibida solicitud para enviar mensaje a: ${phoneNumber}`)

    // En Render, usamos /tmp para archivos temporales
    const tmpDir = process.env.NODE_ENV === "production" ? "/tmp" : process.cwd()
    const scriptPath = path.join(tmpDir, "whatsapp-script.js")

    // Definir el directorio de sesiones (en /tmp para producción)
    const sessionDir = path.join(tmpDir, "whatsapp-sessions")

    // Asegurarnos de que el directorio de sesiones existe
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    // Contenido del script
    const scriptContent = `
    const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
    const { Boom } = require('@hapi/boom');
    const fs = require('fs');
    const path = require('path');
    const qrcode = require('qrcode-terminal');

    // Obtener número de teléfono de los argumentos
    const phoneNumber = process.argv[2];
    if (!phoneNumber) {
      console.error('Phone number is required');
      process.exit(1);
    }

    // Usar el directorio de sesiones pasado como argumento
    const SESSION_DIR = process.argv[3] || path.join(process.cwd(), 'whatsapp-sessions');
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    // Función para escribir en el log
    function log(message) {
      try {
        const logDir = path.dirname(SESSION_DIR);
        const logPath = path.join(logDir, 'whatsapp-script-log.txt');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, \`[\${timestamp}] \${message}\\n\`);
        console.log(message);
      } catch (error) {
        console.error('Error writing to log:', error);
      }
    }

    async function connectToWhatsApp() {
      try {
        log('Iniciando conexión a WhatsApp...');
        log(\`Usando directorio de sesiones: \${SESSION_DIR}\`);
        
        // Obtener estado de autenticación
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        
        // Crear socket de WhatsApp
        const sock = makeWASocket({
          printQRInTerminal: true,
          auth: state,
          browser: ['Chrome (Linux)', 'Chrome', '103.0.5060.114'],
        });
        
        // Manejar actualizaciones de conexión
        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;
          
          if (qr) {
            // Si hay código QR, mostrarlo en la terminal
            log('Código QR generado, mostrando en terminal...');
            qrcode.generate(qr, { small: true });
            
            // También guardar el QR como texto para acceso remoto
            fs.writeFileSync(path.join(SESSION_DIR, 'latest-qr.txt'), qr);
            log('QR CODE GENERATED - PLEASE SCAN WITH WHATSAPP');
            
            // En entorno de producción, también imprimir el QR como URL
            log(\`QR Code URL: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=\${encodeURIComponent(qr)}\`);
          }
          
          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) && 
              lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
              log('Conexión cerrada debido a un error, reconectando...');
              connectToWhatsApp();
            } else {
              log('Conexión cerrada. Has cerrado sesión.');
              process.exit(1);
            }
          } else if (connection === 'open') {
            log('Conexión abierta exitosamente!');
            
            try {
              // Formatear el número de teléfono (eliminar caracteres no numéricos)
              const formattedNumber = phoneNumber.replace(/\\D/g, '');
              log(\`Enviando mensaje a: \${formattedNumber}@s.whatsapp.net\`);
              
              // Enviar el mensaje
              await sock.sendMessage(\`\${formattedNumber}@s.whatsapp.net\`, { 
                text: 'hola' 
              });
              
              log('Mensaje enviado exitosamente!');
              process.exit(0);
            } catch (error) {
              log(\`Error al enviar mensaje: \${error.message}\`);
              process.exit(1);
            }
          }
        });
        
        // Guardar credenciales al cambiar
        sock.ev.on('creds.update', saveCreds);
        
        // Establecer un timeout para evitar que el script se quede colgado
        setTimeout(() => {
          log('Timeout: No se pudo establecer conexión en el tiempo esperado');
          process.exit(1);
        }, 60000); // 60 segundos
        
      } catch (error) {
        log(\`Error en la conexión de WhatsApp: \${error.message}\`);
        process.exit(1);
      }
    }

    // Iniciar la conexión
    connectToWhatsApp();
    `

    // Escribir el script al archivo
    fs.writeFileSync(scriptPath, scriptContent)
    writeToLog(`Script creado en: ${scriptPath}`)

    // Ejecutar el script como un proceso separado
    return new Promise((resolve) => {
      writeToLog("Ejecutando script de WhatsApp...")

      // Crear un buffer para recopilar stdout y stderr
      let stdoutData = ""
      let stderrData = ""

      // Iniciar el proceso con los argumentos como elementos separados
      const childProcess = spawn("node", [scriptPath, phoneNumber, sessionDir], {
        timeout: 60000, // 60 segundos de timeout
      })

      // Recopilar datos de stdout
      childProcess.stdout.on("data", (data) => {
        const chunk = data.toString()
        stdoutData += chunk
        writeToLog(`Salida del script: ${chunk.trim()}`)
      })

      // Recopilar datos de stderr
      childProcess.stderr.on("data", (data) => {
        const chunk = data.toString()
        stderrData += chunk
        writeToLog(`Error del script: ${chunk.trim()}`)
      })

      // Manejar finalización del proceso
      childProcess.on("close", (code) => {
        writeToLog(`Script finalizado con código: ${code}`)

        if (code !== 0) {
          writeToLog(`Error en el script: ${stderrData}`)
          resolve(NextResponse.json({ error: "Error executing WhatsApp script", details: stderrData }, { status: 500 }))
          return
        }

        // Verificar si el mensaje se envió correctamente
        if (stdoutData.includes("Mensaje enviado exitosamente")) {
          resolve(NextResponse.json({ success: true }))
        } else if (stdoutData.includes("QR CODE GENERATED")) {
          // Intentar leer el QR guardado
          let qrCode = null
          try {
            const qrPath = path.join(sessionDir, "latest-qr.txt")
            if (fs.existsSync(qrPath)) {
              qrCode = fs.readFileSync(qrPath, "utf8")
            }
          } catch (error) {
            writeToLog(`Error al leer el código QR: ${error.message}`)
          }

          resolve(
            NextResponse.json({
              needsQrScan: true,
              message: "Please scan the QR code to authenticate WhatsApp",
              qrCode: qrCode,
              qrUrl: qrCode
                ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`
                : null,
            }),
          )
        } else {
          resolve(NextResponse.json({ error: "Failed to send WhatsApp message", output: stdoutData }, { status: 500 }))
        }
      })

      // Manejar errores del proceso
      childProcess.on("error", (error) => {
        writeToLog(`Error al iniciar el proceso: ${error.message}`)
        resolve(
          NextResponse.json({ error: "Failed to execute WhatsApp script", details: error.message }, { status: 500 }),
        )
      })
    })
  } catch (error) {
    writeToLog(`Error en el controlador de API: ${error.message}`)
    return NextResponse.json({ error: error.message || "Failed to send WhatsApp message" }, { status: 500 })
  }
}

