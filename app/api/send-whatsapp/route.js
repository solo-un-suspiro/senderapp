import { NextResponse } from "next/server"
import path from "path"
import { spawn } from "child_process"

// Enable CORS
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// Handle OPTIONS request (for CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400, headers: corsHeaders })
    }

    // Use the whatsapp-script.js file that's already in the repository
    const scriptPath = path.join(process.cwd(), "whatsapp-script.js")

    // Use spawn instead of exec to handle paths with spaces better
    return new Promise((resolve, reject) => {
      // Create a buffer to collect stdout and stderr
      let stdoutData = ""
      let stderrData = ""

      // Spawn the process with the arguments as separate items
      const childProcess = spawn("node", [scriptPath, phoneNumber], {
        timeout: 60000, // 60 second timeout
      })

      // Collect stdout data
      childProcess.stdout.on("data", (data) => {
        const chunk = data.toString()
        stdoutData += chunk
        console.log("Script output:", chunk)
      })

      // Collect stderr data
      childProcess.stderr.on("data", (data) => {
        const chunk = data.toString()
        stderrData += chunk
        console.error("Script error:", chunk)
      })

      // Handle process completion
      childProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`Script exited with code ${code}`)
          resolve(
            NextResponse.json(
              { error: "Error executing WhatsApp script", details: stderrData },
              { status: 500, headers: corsHeaders },
            ),
          )
          return
        }

        // Check if the message was sent successfully
        if (stdoutData.includes("Message sent successfully")) {
          resolve(NextResponse.json({ success: true }, { headers: corsHeaders }))
        } else if (stdoutData.includes("QR CODE GENERATED")) {
          resolve(
            NextResponse.json(
              {
                needsQrScan: true,
                message: "Please scan the QR code in the terminal to authenticate WhatsApp",
              },
              { headers: corsHeaders },
            ),
          )
        } else {
          resolve(
            NextResponse.json(
              { error: "Failed to send WhatsApp message", output: stdoutData },
              { status: 500, headers: corsHeaders },
            ),
          )
        }
      })

      // Handle process errors
      childProcess.on("error", (error) => {
        console.error("Error spawning process:", error)
        resolve(
          NextResponse.json(
            { error: "Failed to execute WhatsApp script", details: error.message },
            { status: 500, headers: corsHeaders },
          ),
        )
      })
    })
  } catch (error) {
    console.error("Error in sendWhatsAppMessage:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send WhatsApp message" },
      { status: 500, headers: corsHeaders },
    )
  }
}

