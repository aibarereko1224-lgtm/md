import { useRef, useEffect, useCallback } from 'react'

interface ParticleMaskProps {
  children: React.ReactNode
  onClick: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  active: boolean
}

const ParticleMask: React.FC<ParticleMaskProps> = ({ children, onClick }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>()

  const createParticles = useCallback((width: number, height: number) => {
    particlesRef.current = []
    const count = Math.floor((width * height) / 1500)
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        active: true
      })
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width || 140
      canvas.height = rect.height || 210
      createParticles(canvas.width, canvas.height)
    }

    updateSize()

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      particlesRef.current.forEach(p => {
        if (p.active) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    window.addEventListener('resize', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [createParticles])

  const handleClick = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      onClick()
      return
    }

    particlesRef.current.forEach(p => {
      p.vx = (Math.random() - 0.5) * 12
      p.vy = (Math.random() - 0.5) * 12
    })

    const animateDisperse = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'

      let activeCount = 0
      particlesRef.current.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.15

        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          p.active = false
        }

        if (p.active) {
          activeCount++
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      if (activeCount > 0) {
        animationRef.current = requestAnimationFrame(animateDisperse)
      } else {
        onClick()
      }
    }
    animateDisperse()
  }, [onClick])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
      <div onClick={handleClick} style={{ cursor: 'pointer' }}>
        {children}
      </div>
    </div>
  )
}

export default ParticleMask