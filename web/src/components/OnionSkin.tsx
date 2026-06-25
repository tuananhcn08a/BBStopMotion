import { useEffect, useRef } from 'react'
import { CapturedFrame } from '../types'
import styles from './OnionSkin.module.css'

interface Props {
  frame: CapturedFrame | null
  visible: boolean
}

export default function OnionSkin({ frame, visible }: Props) {
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
      ctx.globalAlpha = 0.35
      ctx.drawImage(img, 0, 0)
      ctx.globalAlpha = 1
    }
    img.src = frame.dataUrl
  }, [frame, visible])

  if (!visible || !frame) return null

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
      data-testid="onion-skin"
    />
  )
}
