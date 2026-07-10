import { useEffect, useRef } from 'react'
import { CapturedFrame } from '../types'
import styles from './OnionSkin.module.css'

interface Props {
  frame: CapturedFrame | null
  visible: boolean
  /** F3 — độ mờ 0..1, mặc định 0.4 (Bright Studio, ghi đè 0.30/0.35 cũ). */
  opacity?: number
}

export default function OnionSkin({ frame, visible, opacity = 0.4 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!frame || !visible || !canvasRef.current) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = opacity
      ctx.drawImage(img, 0, 0)
      ctx.globalAlpha = 1
    }
    img.src = frame.dataUrl
  }, [frame, visible, opacity])

  if (!visible || !frame) return null

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
      data-testid="onion-skin"
      data-opacity={opacity}
    />
  )
}
