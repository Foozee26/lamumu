import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RotateCcw, Play, Pause } from 'lucide-react';

interface GameObject {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'cow' | 'bottle';
  destroyed: boolean;
  rotation?: number;
}

interface Slingshot {
  x: number;
  y: number;
  pulling: boolean;
  pullX: number;
  pullY: number;
  animating: boolean;
  animationProgress: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const cowImageRef = useRef<HTMLImageElement>();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [gameObjects, setGameObjects] = useState<GameObject[]>([]);
  const [slingshot, setSlingshot] = useState<Slingshot>({
    x: 150,
    y: 400,
    pulling: false,
    pullX: 150,
    pullY: 400,
    animating: false,
    animationProgress: 0
  });
  const [score, setScore] = useState(0);
  const [gameRunning, setGameRunning] = useState(false);
  const [cowsRemaining, setCowsRemaining] = useState(3);
  const [currentCow, setCurrentCow] = useState<GameObject | null>(null);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const GRAVITY = 0.4;
  const FRICTION = 0.99;
  const GROUND_Y = 520;
  const SLINGSHOT_POWER = 0.12;

  // Load cow image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      cowImageRef.current = img;
      setImageLoaded(true);
    };
    img.src = '/src/assets/GyqiDFxW4AQt1Lk.jpg';
  }, []);

  // Initialize game
  const initializeGame = useCallback(() => {
    const bottles: GameObject[] = [
      { x: 600, y: GROUND_Y - 25, vx: 0, vy: 0, radius: 20, type: 'bottle', destroyed: false },
      { x: 650, y: GROUND_Y - 25, vx: 0, vy: 0, radius: 20, type: 'bottle', destroyed: false },
      { x: 700, y: GROUND_Y - 25, vx: 0, vy: 0, radius: 20, type: 'bottle', destroyed: false },
      { x: 625, y: GROUND_Y - 70, vx: 0, vy: 0, radius: 20, type: 'bottle', destroyed: false },
      { x: 675, y: GROUND_Y - 70, vx: 0, vy: 0, radius: 20, type: 'bottle', destroyed: false },
      { x: 650, y: GROUND_Y - 115, vx: 0, vy: 0, radius: 20, type: 'bottle', destroyed: false },
    ];
    
    // Create initial cow on slingshot
    const initialCow: GameObject = {
      x: 150,
      y: 400,
      vx: 0,
      vy: 0,
      radius: 25,
      type: 'cow',
      destroyed: false,
      rotation: 0
    };

    setGameObjects(bottles);
    setCurrentCow(initialCow);
    setScore(0);
    setCowsRemaining(3);
    setGameRunning(false);
    setSlingshot(prev => ({ 
      ...prev, 
      pulling: false, 
      pullX: prev.x, 
      pullY: prev.y,
      animating: false,
      animationProgress: 0
    }));
  }, [GROUND_Y]);

  // Slingshot animation
  const animateSlingshot = useCallback(() => {
    setSlingshot(prev => {
      if (!prev.animating) return prev;
      
      const newProgress = prev.animationProgress + 0.1;
      if (newProgress >= 1) {
        return {
          ...prev,
          animating: false,
          animationProgress: 0,
          pullX: prev.x,
          pullY: prev.y
        };
      }
      
      // Elastic animation back to center
      const elasticProgress = 1 - Math.pow(1 - newProgress, 3);
      const pullX = prev.pullX + (prev.x - prev.pullX) * elasticProgress;
      const pullY = prev.pullY + (prev.y - prev.pullY) * elasticProgress;
      
      return {
        ...prev,
        animationProgress: newProgress,
        pullX,
        pullY
      };
    });
  }, []);

  // Physics update
  const updatePhysics = useCallback(() => {
    setGameObjects(prev => prev.map(obj => {
      if (obj.destroyed) return obj;

      let newX = obj.x + obj.vx;
      let newY = obj.y + obj.vy;
      let newVx = obj.vx * FRICTION;
      let newVy = obj.vy + GRAVITY;
      let newRotation = (obj.rotation || 0) + Math.abs(obj.vx) * 0.1;

      // Ground collision
      if (newY + obj.radius > GROUND_Y) {
        newY = GROUND_Y - obj.radius;
        newVy = -newVy * 0.6;
        newVx *= 0.8;
      }

      // Wall collisions
      if (newX - obj.radius < 0) {
        newX = obj.radius;
        newVx = -newVx * 0.7;
      }
      if (newX + obj.radius > CANVAS_WIDTH) {
        newX = CANVAS_WIDTH - obj.radius;
        newVx = -newVx * 0.7;
      }

      // Stop very slow objects
      if (Math.abs(newVx) < 0.5 && Math.abs(newVy) < 0.5 && newY + obj.radius >= GROUND_Y - 2) {
        newVx = 0;
        newVy = 0;
      }

      return { ...obj, x: newX, y: newY, vx: newVx, vy: newVy, rotation: newRotation };
    }));
  }, [CANVAS_WIDTH, GROUND_Y, GRAVITY, FRICTION]);

  // Collision detection
  const checkCollisions = useCallback(() => {
    setGameObjects(prev => {
      const objects = [...prev];
      let scoreIncrease = 0;

      for (let i = 0; i < objects.length; i++) {
        for (let j = i + 1; j < objects.length; j++) {
          const obj1 = objects[i];
          const obj2 = objects[j];

          if (obj1.destroyed || obj2.destroyed) continue;

          const dx = obj1.x - obj2.x;
          const dy = obj1.y - obj2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < obj1.radius + obj2.radius) {
            // Collision detected
            if ((obj1.type === 'cow' && obj2.type === 'bottle') || 
                (obj1.type === 'bottle' && obj2.type === 'cow')) {
              
              // Destroy bottle and add score
              if (obj1.type === 'bottle' && !obj1.destroyed) {
                objects[i] = { ...obj1, destroyed: true };
                scoreIncrease += 100;
              }
              if (obj2.type === 'bottle' && !obj2.destroyed) {
                objects[j] = { ...obj2, destroyed: true };
                scoreIncrease += 100;
              }
            }

            // Physics collision response
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            // Rotate velocities
            const vx1 = obj1.vx * cos + obj1.vy * sin;
            const vy1 = obj1.vy * cos - obj1.vx * sin;
            const vx2 = obj2.vx * cos + obj2.vy * sin;
            const vy2 = obj2.vy * cos - obj2.vx * sin;

            // Collision response with energy conservation
            const finalVx1 = ((obj1.radius - obj2.radius) * vx1 + 2 * obj2.radius * vx2) / (obj1.radius + obj2.radius);
            const finalVx2 = ((obj2.radius - obj1.radius) * vx2 + 2 * obj1.radius * vx1) / (obj1.radius + obj2.radius);

            // Rotate back
            objects[i].vx = finalVx1 * cos - vy1 * sin;
            objects[i].vy = vy1 * cos + finalVx1 * sin;
            objects[j].vx = finalVx2 * cos - vy2 * sin;
            objects[j].vy = vy2 * cos + finalVx2 * sin;

            // Separate objects
            const overlap = obj1.radius + obj2.radius - distance + 1;
            const separateX = (overlap / 2) * cos;
            const separateY = (overlap / 2) * sin;

            objects[i].x += separateX;
            objects[i].y += separateY;
            objects[j].x -= separateX;
            objects[j].y -= separateY;
          }
        }
      }

      if (scoreIncrease > 0) {
        setScore(prev => prev + scoreIncrease);
      }

      return objects;
    });
  }, []);

  // Game loop
  const gameLoop = useCallback(() => {
    animateSlingshot();
    
    if (!gameRunning) return;

    updatePhysics();
    checkCollisions();

    // Check if all cows have stopped moving
    const movingCows = gameObjects.filter(obj => 
      obj.type === 'cow' && !obj.destroyed && 
      (Math.abs(obj.vx) > 0.1 || Math.abs(obj.vy) > 0.1)
    );

    if (movingCows.length === 0 && gameObjects.some(obj => obj.type === 'cow')) {
      setGameRunning(false);
      // Prepare next cow if available
      if (cowsRemaining > 1) {
        setTimeout(() => {
          const nextCow: GameObject = {
            x: 150,
            y: 400,
            vx: 0,
            vy: 0,
            radius: 25,
            type: 'cow',
            destroyed: false,
            rotation: 0
          };
          setCurrentCow(nextCow);
        }, 1000);
      }
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [gameRunning, updatePhysics, checkCollisions, gameObjects, cowsRemaining, animateSlingshot]);

  // Drawing functions
  const drawCow = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number = 0) => {
    if (cowImageRef.current && imageLoaded) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();
      
      const size = radius * 2;
      ctx.drawImage(cowImageRef.current, -radius, -radius, size, size);
      ctx.restore();
      
      // Add border
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Fallback if image not loaded
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const drawBottle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    // Bottle body
    ctx.fillStyle = '#E8F4FD';
    ctx.beginPath();
    ctx.roundRect(x - radius * 0.7, y - radius, radius * 1.4, radius * 2, 8);
    ctx.fill();
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Bottle cap
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.roundRect(x - radius * 0.4, y - radius - 8, radius * 0.8, 12, 4);
    ctx.fill();

    // Milk label
    ctx.fillStyle = '#4A90E2';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MILK', x, y + 4);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw sky
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(200, 100, 30, 0, Math.PI * 2);
    ctx.arc(230, 100, 40, 0, Math.PI * 2);
    ctx.arc(260, 100, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(500, 80, 25, 0, Math.PI * 2);
    ctx.arc(520, 80, 35, 0, Math.PI * 2);
    ctx.arc(545, 80, 25, 0, Math.PI * 2);
    ctx.fill();

    // Draw ground
    ctx.fillStyle = '#8FBC8F';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Draw grass texture
    ctx.strokeStyle = '#7BA05B';
    ctx.lineWidth = 2;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, GROUND_Y);
      ctx.lineTo(i + 5, GROUND_Y - 10);
      ctx.moveTo(i + 10, GROUND_Y);
      ctx.lineTo(i + 15, GROUND_Y - 8);
      ctx.stroke();
    }

    // Draw slingshot base
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.ellipse(slingshot.x, slingshot.y + 40, 40, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw slingshot arms
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(slingshot.x - 25, slingshot.y + 30);
    ctx.lineTo(slingshot.x - 15, slingshot.y - 40);
    ctx.moveTo(slingshot.x + 25, slingshot.y + 30);
    ctx.lineTo(slingshot.x + 15, slingshot.y - 40);
    ctx.stroke();

    // Draw slingshot band
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (slingshot.pulling || slingshot.animating) {
      ctx.moveTo(slingshot.x - 15, slingshot.y - 40);
      ctx.lineTo(slingshot.pullX, slingshot.pullY);
      ctx.lineTo(slingshot.x + 15, slingshot.y - 40);
    } else {
      ctx.moveTo(slingshot.x - 15, slingshot.y - 40);
      ctx.lineTo(slingshot.x + 15, slingshot.y - 40);
    }
    ctx.stroke();

    // Draw current cow on slingshot
    if (currentCow && !gameRunning) {
      const cowX = slingshot.pulling ? slingshot.pullX : slingshot.x;
      const cowY = slingshot.pulling ? slingshot.pullY : slingshot.y;
      drawCow(ctx, cowX, cowY, currentCow.radius);
    }

    // Draw game objects
    gameObjects.forEach(obj => {
      if (obj.destroyed) return;

      if (obj.type === 'cow') {
        drawCow(ctx, obj.x, obj.y, obj.radius, obj.rotation || 0);
      } else {
        drawBottle(ctx, obj.x, obj.y, obj.radius);
      }
    });

    // Draw trajectory preview
    if (slingshot.pulling && currentCow) {
      const dx = slingshot.x - slingshot.pullX;
      const dy = slingshot.y - slingshot.pullY;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      
      let trajX = slingshot.x;
      let trajY = slingshot.y;
      let trajVx = dx * SLINGSHOT_POWER;
      let trajVy = dy * SLINGSHOT_POWER;
      
      ctx.moveTo(trajX, trajY);
      for (let i = 0; i < 60; i++) {
        trajX += trajVx;
        trajY += trajVy;
        trajVy += GRAVITY;
        ctx.lineTo(trajX, trajY);
        if (trajY > GROUND_Y || trajX < 0 || trajX > CANVAS_WIDTH) break;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw power indicator
    if (slingshot.pulling && currentCow) {
      const dx = slingshot.x - slingshot.pullX;
      const dy = slingshot.y - slingshot.pullY;
      const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 100, 1);
      
      // Power bar background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(50, 50, 200, 20);
      
      // Power bar fill
      const powerColor = power < 0.5 ? '#4CAF50' : power < 0.8 ? '#FF9800' : '#F44336';
      ctx.fillStyle = powerColor;
      ctx.fillRect(50, 50, 200 * power, 20);
      
      // Power bar border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 50, 200, 20);
      
      // Power text
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('POWER', 50, 45);
    }
  }, [gameObjects, slingshot, currentCow, gameRunning, CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, GRAVITY, SLINGSHOT_POWER, imageLoaded]);

  // Mouse/touch handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentCow || gameRunning) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const distance = Math.sqrt((x - slingshot.x) ** 2 + (y - slingshot.y) ** 2);
    if (distance < 100) {
      setSlingshot(prev => ({ ...prev, pulling: true, pullX: x, pullY: y }));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!slingshot.pulling || !currentCow) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Limit pull distance
    const dx = x - slingshot.x;
    const dy = y - slingshot.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 120;

    if (distance > maxDistance) {
      const angle = Math.atan2(dy, dx);
      setSlingshot(prev => ({ 
        ...prev, 
        pullX: prev.x + Math.cos(angle) * maxDistance,
        pullY: prev.y + Math.sin(angle) * maxDistance
      }));
    } else {
      setSlingshot(prev => ({ ...prev, pullX: x, pullY: y }));
    }
  };

  const handleMouseUp = () => {
    if (!slingshot.pulling || !currentCow) return;

    const dx = slingshot.x - slingshot.pullX;
    const dy = slingshot.y - slingshot.pullY;

    const launchedCow: GameObject = {
      ...currentCow,
      x: slingshot.x,
      y: slingshot.y,
      vx: dx * SLINGSHOT_POWER,
      vy: dy * SLINGSHOT_POWER,
    };

    setGameObjects(prev => [...prev, launchedCow]);
    setCurrentCow(null);
    setCowsRemaining(prev => prev - 1);
    setSlingshot(prev => ({ 
      ...prev, 
      pulling: false, 
      animating: true, 
      animationProgress: 0 
    }));
    setGameRunning(true);
  };

  // Effects
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  useEffect(() => {
    const interval = setInterval(() => {
      gameLoop();
    }, 16); // ~60fps
    return () => clearInterval(interval);
  }, [gameLoop]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Check win condition
  const bottlesRemaining = gameObjects.filter(obj => obj.type === 'bottle' && !obj.destroyed).length;
  const isWon = bottlesRemaining === 0 && gameObjects.some(obj => obj.type === 'bottle');
  const isGameOver = cowsRemaining === 0 && !currentCow && bottlesRemaining > 0 && !gameRunning;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-green-400 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-4xl w-full">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🐄 Angry Cows 🥛</h1>
          <div className="flex justify-center items-center gap-6 text-lg">
            <div className="bg-blue-100 px-4 py-2 rounded-lg">
              <span className="font-semibold">Score: {score}</span>
            </div>
            <div className="bg-green-100 px-4 py-2 rounded-lg">
              <span className="font-semibold">Cows: {cowsRemaining}</span>
            </div>
            <div className="bg-yellow-100 px-4 py-2 rounded-lg">
              <span className="font-semibold">Bottles: {bottlesRemaining}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border-2 border-gray-300 rounded-lg cursor-crosshair bg-gradient-to-b from-blue-200 to-green-200"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={initializeGame}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <RotateCcw size={20} />
            New Game
          </button>
        </div>

        {isWon && (
          <div className="mt-4 text-center">
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
              <h2 className="text-2xl font-bold">🎉 Congratulations! 🎉</h2>
              <p>You destroyed all the milk bottles! Final Score: {score}</p>
            </div>
          </div>
        )}

        {isGameOver && (
          <div className="mt-4 text-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
              <h2 className="text-2xl font-bold">Game Over!</h2>
              <p>No more cows left! Final Score: {score}</p>
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-gray-600">
          <p className="text-sm">
            🎯 Drag near the slingshot to aim and release to launch the cow!
          </p>
          <p className="text-xs mt-1">
            Use the cows to hit the milk bottles. Destroy all bottles to win!
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;