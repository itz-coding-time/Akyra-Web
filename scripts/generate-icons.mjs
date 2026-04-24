import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

function drawAkyraIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")
  const pad = size * 0.15

  // Black background
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, size, size)

  const cx = size / 2
  const top = pad
  const bottom = size - pad
  const left = pad
  const right = size - pad

  // Outer triangle (white)
  ctx.beginPath()
  ctx.moveTo(cx, top)
  ctx.lineTo(right, bottom)
  ctx.lineTo(left, bottom)
  ctx.closePath()
  ctx.strokeStyle = "#FFFFFF"
  ctx.lineWidth = size * 0.04
  ctx.lineJoin = "round"
  ctx.stroke()

  // Dashed center line (white)
  ctx.beginPath()
  ctx.setLineDash([size * 0.04, size * 0.04])
  ctx.moveTo(cx, top)
  ctx.lineTo(cx, bottom)
  ctx.strokeStyle = "#FFFFFF"
  ctx.lineWidth = size * 0.02
  ctx.stroke()
  ctx.setLineDash([])

  // Inner chevron (red)
  const midY = top + (bottom - top) * 0.6
  ctx.beginPath()
  ctx.moveTo(left + (cx - left) * 0.4, midY)
  ctx.lineTo(cx, bottom)
  ctx.lineTo(right - (right - cx) * 0.4, midY)
  ctx.strokeStyle = "#E63946"
  ctx.lineWidth = size * 0.025
  ctx.lineJoin = "round"
  ctx.stroke()

  return canvas.toBuffer("image/png")
}

writeFileSync("public/pwa-192x192.png", drawAkyraIcon(192))
writeFileSync("public/pwa-512x512.png", drawAkyraIcon(512))
writeFileSync("public/apple-touch-icon.png", drawAkyraIcon(180))
console.log("✅ PWA icons generated")
