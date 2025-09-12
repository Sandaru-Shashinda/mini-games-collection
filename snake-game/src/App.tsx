import  { useState, useEffect, useRef, useCallback } from 'react';

// Type Definitions
type SnakePart = {
    x: number;
    y: number;
};

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

// Game constants
const GRID_SIZE = 20;
const CANVAS_SIZE = 500;
const INITIAL_SNAKE: SnakePart[] = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
];
const INITIAL_DIRECTION: Direction = 'RIGHT';
const INITIAL_SPEED = 150; // ms delay

// Custom hook for game interval
const useInterval = (callback: () => void, delay: number | null) => {
    const savedCallback = useRef<() => void>(undefined);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        function tick() {
            if (savedCallback.current) {
                savedCallback.current();
            }
        }
        if (delay !== null) {
            const id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);
};

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [snake, setSnake] = useState<SnakePart[]>(INITIAL_SNAKE);
    const [food, setFood] = useState<SnakePart>({ x: 0, y: 0 });
    const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
    const [speed, setSpeed] = useState<number>(INITIAL_SPEED);
    const [gameOver, setGameOver] = useState<boolean>(false);
    const [score, setScore] = useState<number>(0);
    const [highScore, setHighScore] = useState<number>(0);

    // Load high score from local storage on mount
    useEffect(() => {
        const storedHighScore = localStorage.getItem('snakeHighScoreReact') || 0;
        setHighScore(Number(storedHighScore));
    }, []);
    
    // Function to generate food
    const generateFood = useCallback((currentSnake: SnakePart[]) => {
        let newFood: SnakePart;
        const maxPos = (CANVAS_SIZE / GRID_SIZE) - 1;
        do {
            newFood = {
                x: Math.floor(Math.random() * maxPos + 1),
                y: Math.floor(Math.random() * maxPos + 1),
            };
        } while (currentSnake.some(part => part.x === newFood.x && part.y === newFood.y));
        setFood(newFood);
    }, []);

    const startGame = useCallback(() => {
        setSnake(INITIAL_SNAKE);
        setDirection(INITIAL_DIRECTION);
        setSpeed(INITIAL_SPEED);
        setScore(0);
        setGameOver(false);
        generateFood(INITIAL_SNAKE);
    }, [generateFood]);

    // Initialize game on first render
    useEffect(() => {
        startGame();
    }, [startGame]);


    // Game Controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key;
            setDirection((prevDirection: Direction) => {
                if ((key === 'ArrowUp' || key === 'w') && prevDirection !== 'DOWN') return 'UP';
                if ((key === 'ArrowDown' || key === 's') && prevDirection !== 'UP') return 'DOWN';
                if ((key === 'ArrowLeft' || key === 'a') && prevDirection !== 'RIGHT') return 'LEFT';
                if ((key === 'ArrowRight' || key === 'd') && prevDirection !== 'LEFT') return 'RIGHT';
                return prevDirection;
            });
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);


    // Drawing logic
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = '#161b22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw food
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = 'rgba(244, 63, 94, 0.7)';
        ctx.shadowBlur = 15;
        ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);

        // Draw snake
        ctx.fillStyle = '#a3e635';
        ctx.shadowColor = 'rgba(163, 230, 53, 0.7)';
        snake.forEach((part: SnakePart, index: number) => {
            ctx.shadowBlur = index === 0 ? 15 : 10;
            ctx.fillRect(part.x * GRID_SIZE, part.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        });
        
        ctx.shadowBlur = 0; // Reset shadow

    }, [snake, food, gameOver]);
    
    const gameTick = () => {
        if (gameOver) return;

        setSnake(prevSnake => {
            const newSnake = [...prevSnake];
            const head = { ...newSnake[0] };

            switch (direction) {
                case 'UP': head.y -= 1; break;
                case 'DOWN': head.y += 1; break;
                case 'LEFT': head.x -= 1; break;
                case 'RIGHT': head.x += 1; break;
                default: break;
            }

            // Wall collision
            const maxPos = CANVAS_SIZE / GRID_SIZE;
            if (head.x < 0 || head.x >= maxPos || head.y < 0 || head.y >= maxPos) {
                setGameOver(true);
                return prevSnake;
            }

            // Self collision
            for (let i = 1; i < newSnake.length; i++) {
                if (head.x === newSnake[i].x && head.y === newSnake[i].y) {
                    setGameOver(true);
                    return prevSnake;
                }
            }
            
            newSnake.unshift(head);

            // Food collision
            if (head.x === food.x && head.y === food.y) {
                const newScore = score + 10;
                setScore(newScore);
                if (newScore > highScore) {
                    setHighScore(newScore);
                    localStorage.setItem('snakeHighScoreReact', newScore.toString());
                }
                setSpeed(prev => Math.max(50, prev - 2));
                generateFood(newSnake);
            } else {
                newSnake.pop();
            }

            return newSnake;
        });
    };

    useInterval(gameTick, gameOver ? null : speed);

    return (
        <div className="bg-slate-900 min-h-screen w-full justify-center items-center font-sans p-4">
            <div className="text-center w-full max-w-lg">
                <h1 className="text-5xl font-bold text-white mb-2" style={{ textShadow: '0 0 10px #a3e635, 0 0 20px #a3e635' }}>
                 Snake Game
                </h1>

                {/* Score Panel */}
                <div className="flex justify-between text-xl font-semibold bg-slate-800 p-3 rounded-t-lg border border-b-0 border-slate-700 text-slate-300">
                    <div>Score: <span className="text-white">{score}</span></div>
                    <div>High Score: <span className="text-white">{highScore}</span></div>
                </div>

                {/* Canvas Container */}
                <div className="relative">
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_SIZE}
                        height={CANVAS_SIZE}
                        className="bg-slate-800 border border-slate-700 rounded-b-lg shadow-2xl w-full h-auto"
                    />

                    {/* Game Over Modal */}
                    {gameOver && (
                        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col justify-center items-center rounded-b-lg">
                            <h2 className="text-4xl font-bold text-white mb-2">Game Over</h2>
                            <p className="text-xl text-slate-300 mb-6">Your Score: {score}</p>
                            <button
                                onClick={startGame}
                                className="px-6 py-3 bg-lime-400 text-slate-900 font-bold text-lg rounded-md hover:bg-lime-300 transition-transform transform hover:-translate-y-1 hover:shadow-lg hover:shadow-lime-400/50"
                            >
                                Play Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
