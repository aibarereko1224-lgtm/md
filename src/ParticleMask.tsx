import { useRef, useEffect } from 'react'

interface ParticleMaskProps {
  children: React.ReactNode
  onClick: () => void
}

const ParticleMask: React.FC<ParticleMaskProps> = ({ children, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<any[]>([])
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 300
    canvas.height = 450

    // Create particles
    particlesRef.current = []
    for (let i = 0; i < 100; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0,
        vy: 0,
        active: true
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      particlesRef.current.forEach(p => {
        if (p.active) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const handleClick = () => {
    // Bug 5 修复：先取消原有的 animate 循环，再启动散开动画
    if (animationRef.current) cancelAnimationFrame(animationRef.current)

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    particlesRef.current.forEach(p => {
      p.vx = (Math.random() - 0.5) * 10
      p.vy = (Math.random() - 0.5) * 10
    })

    const animateDisperse = () => {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'

      particlesRef.current.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1 // gravity
        if (p.x < 0 || p.x > 300 || p.y < 0 || p.y > 450) p.active = false

        if (p.active) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      if (particlesRef.current.some(p => p.active)) {
        animationRef.current = requestAnimationFrame(animateDisperse)
      } else {
        onClick()
      }
    }
    animateDisperse()
  }

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
      <div onClick={handleClick} style={{ cursor: 'pointer' }}>
        {children}
      </div>
    </div>
  )
}

export default ParticleMask
