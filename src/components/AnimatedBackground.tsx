import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Noise texture for fabric effect
    const createNoiseTexture = () => {
      const noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = canvas.width;
      noiseCanvas.height = canvas.height;
      const noiseCtx = noiseCanvas.getContext('2d');
      if (!noiseCtx) return noiseCanvas;

      const imageData = noiseCtx.createImageData(noiseCanvas.width, noiseCanvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 30 + 10;
        data[i] = noise;     // R
        data[i + 1] = noise; // G
        data[i + 2] = noise; // B
        data[i + 3] = 255;   // A
      }

      noiseCtx.putImageData(imageData, 0, 0);
      return noiseCanvas;
    };

    const noiseTexture = createNoiseTexture();

    const animate = () => {
      time += 0.005;

      // Base dark background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw noise texture
      ctx.globalAlpha = 0.15;
      ctx.drawImage(noiseTexture, 0, 0);
      ctx.globalAlpha = 1;

      // Create flowing light waves (fabric folds)
      const numWaves = 3;

      for (let i = 0; i < numWaves; i++) {
        const offsetY = (i * canvas.height) / numWaves + Math.sin(time + i * 2) * 100;
        const waveHeight = canvas.height * 0.4;

        // Create gradient for wave (light on fabric)
        const gradient = ctx.createRadialGradient(
          canvas.width * 0.3 + Math.cos(time * 0.5 + i) * 200,
          offsetY,
          0,
          canvas.width * 0.3 + Math.cos(time * 0.5 + i) * 200,
          offsetY,
          waveHeight
        );

        gradient.addColorStop(0, 'rgba(80, 80, 90, 0.3)');
        gradient.addColorStop(0.3, 'rgba(50, 50, 60, 0.2)');
        gradient.addColorStop(0.6, 'rgba(30, 30, 40, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Add flowing curves (fabric contours)
      ctx.save();
      
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        
        const yOffset = (i * canvas.height) / 4 - canvas.height / 4;
        const phase = time + i * 0.8;

        for (let x = 0; x <= canvas.width; x += 10) {
          const y = 
            yOffset +
            Math.sin((x * 0.003) + phase) * 150 +
            Math.cos((x * 0.002) + phase * 1.3) * 100 +
            canvas.height / 2;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        // Create gradient along the curve
        const curveGradient = ctx.createLinearGradient(
          0, 
          yOffset + canvas.height / 2 - 200, 
          0, 
          yOffset + canvas.height / 2 + 200
        );
        
        curveGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        curveGradient.addColorStop(0.3, 'rgba(60, 60, 70, 0.15)');
        curveGradient.addColorStop(0.5, 'rgba(80, 80, 90, 0.2)');
        curveGradient.addColorStop(0.7, 'rgba(60, 60, 70, 0.15)');
        curveGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();

        ctx.fillStyle = curveGradient;
        ctx.fill();
      }

      ctx.restore();

      // Add highlight streaks (light reflecting on fabric)
      for (let i = 0; i < 3; i++) {
        const streakGradient = ctx.createLinearGradient(
          canvas.width * 0.2 + Math.cos(time * 0.3 + i) * 300,
          0,
          canvas.width * 0.8 + Math.cos(time * 0.3 + i) * 300,
          canvas.height
        );

        streakGradient.addColorStop(0, 'rgba(120, 120, 130, 0)');
        streakGradient.addColorStop(0.4, 'rgba(100, 100, 110, 0.08)');
        streakGradient.addColorStop(0.6, 'rgba(100, 100, 110, 0.08)');
        streakGradient.addColorStop(1, 'rgba(120, 120, 130, 0)');

        ctx.fillStyle = streakGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Add vignette
      const vignette = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.1,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.8
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle cyan tint
      ctx.fillStyle = 'rgba(6, 182, 212, 0.02)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ background: '#000000' }}
    />
  );
}
