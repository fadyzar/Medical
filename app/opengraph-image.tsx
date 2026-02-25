import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'טלמדיסן — ייעוץ רפואי אונליין'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #0d9488 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.2)',
            marginBottom: 24,
          }}
        >
          <span style={{ color: 'white', fontSize: 40, fontWeight: 900 }}>T</span>
        </div>
        <h1
          style={{
            color: 'white',
            fontSize: 72,
            fontWeight: 900,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          טלמדיסן
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 28,
            marginTop: 16,
            fontWeight: 500,
          }}
        >
          ייעוץ רפואי אונליין עם רופאים מומחים
        </p>
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 40,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
          }}
        >
          <span>וידאו HD</span>
          <span>•</span>
          <span>סוכני AI</span>
          <span>•</span>
          <span>HIPAA מאובטח</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
