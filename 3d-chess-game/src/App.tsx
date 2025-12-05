import { useState, useEffect, useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, useCursor, Environment, Stars, RoundedBox } from "@react-three/drei"
import { Chess } from "chess.js"
import * as THREE from "three"

// --- GAME LOGIC (Unchanged) ---
const PIECE_VALUES = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 }
const evaluateBoard = (game) => {
  const board = game.board()
  let totalEvaluation = 0
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j]
      if (piece) {
        const value = PIECE_VALUES[piece.type]
        totalEvaluation += piece.color === "w" ? value : -value
      }
    }
  }
  return totalEvaluation
}
const minimax = (game, depth, alpha, beta, isMaximizingPlayer) => {
  if (depth === 0 || game.isGameOver()) return evaluateBoard(game)
  const newGameMoves = game.moves()
  if (isMaximizingPlayer) {
    let maxEval = -Infinity
    for (const move of newGameMoves) {
      game.move(move)
      const ev = minimax(game, depth - 1, alpha, beta, false)
      game.undo()
      maxEval = Math.max(maxEval, ev)
      alpha = Math.max(alpha, ev)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of newGameMoves) {
      game.move(move)
      const ev = minimax(game, depth - 1, alpha, beta, true)
      game.undo()
      minEval = Math.min(minEval, ev)
      beta = Math.min(beta, ev)
      if (beta <= alpha) break
    }
    return minEval
  }
}
const getBestMove = (game, difficulty) => {
  const possibleMoves = game.moves()
  if (possibleMoves.length === 0) return null
  if (difficulty === "easy") return possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
  let bestMove = null
  let bestValue = game.turn() === "w" ? -Infinity : Infinity
  const depth = difficulty === "medium" ? 2 : 3
  for (const move of possibleMoves) {
    game.move(move)
    const boardValue = minimax(game, depth - 1, -Infinity, Infinity, game.turn() === "w")
    game.undo()
    if (game.turn() === "w") {
      if (boardValue > bestValue) {
        bestValue = boardValue
        bestMove = move
      }
    } else {
      if (boardValue < bestValue) {
        bestValue = boardValue
        bestMove = move
      }
    }
  }
  return bestMove || possibleMoves[0]
}

// --- NEW STYLISH MATERIALS ---

const usePieceMaterial = (color) => {
  // Memoize materials so they aren't recreated every frame
  const whiteMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.15,
        metalness: 0.1,
        transmission: 0.1, // Slight subsurface scattering look (like porcelain/ivory)
        ior: 1.5,
        clearcoat: 1, // Shiny top layer
        clearcoatRoughness: 0.1,
      }),
    []
  )

  const blackMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#111111",
        roughness: 0.2,
        metalness: 0.4, // Polished stone/ebony look
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        reflectivity: 0.5,
      }),
    []
  )

  return color === "w" ? whiteMat : blackMat
}

// --- LATHE PROFILES (The secret to natural shapes) ---
// Defines the 2D outline of half the piece
const getLathePoints = (type) => {
  const points = []
  switch (type) {
    case "p": // Pawn
      points.push(new THREE.Vector2(0.3, 0)) // Base
      points.push(new THREE.Vector2(0.3, 0.1))
      points.push(new THREE.Vector2(0.2, 0.2)) // Curve in
      points.push(new THREE.Vector2(0.15, 0.5)) // Neck
      points.push(new THREE.Vector2(0.25, 0.6)) // Collar
      points.push(new THREE.Vector2(0.2, 0.8)) // Head start
      points.push(new THREE.Vector2(0, 0.9)) // Head top
      break
    case "r": // Rook
      points.push(new THREE.Vector2(0.35, 0))
      points.push(new THREE.Vector2(0.35, 0.15))
      points.push(new THREE.Vector2(0.28, 0.2)) // Body base
      points.push(new THREE.Vector2(0.25, 0.7)) // Body top
      points.push(new THREE.Vector2(0.35, 0.8)) // Flare out
      points.push(new THREE.Vector2(0.4, 1.0)) // Top rim
      points.push(new THREE.Vector2(0.25, 1.0)) // Inner rim
      points.push(new THREE.Vector2(0.25, 0.9)) // Inner dip
      points.push(new THREE.Vector2(0, 0.9)) // Center
      break
    case "b": // Bishop
      points.push(new THREE.Vector2(0.35, 0))
      points.push(new THREE.Vector2(0.35, 0.15))
      points.push(new THREE.Vector2(0.2, 0.3)) // Slim body
      points.push(new THREE.Vector2(0.15, 0.7)) // Neck
      points.push(new THREE.Vector2(0.25, 0.85)) // Head bulging
      points.push(new THREE.Vector2(0.1, 1.2)) // Pointy top
      points.push(new THREE.Vector2(0, 1.3)) // Finial
      break
    case "q": // Queen
      points.push(new THREE.Vector2(0.4, 0))
      points.push(new THREE.Vector2(0.4, 0.2))
      points.push(new THREE.Vector2(0.25, 0.4))
      points.push(new THREE.Vector2(0.18, 1.0)) // Tall slender body
      points.push(new THREE.Vector2(0.3, 1.2)) // Crown base flare
      points.push(new THREE.Vector2(0.35, 1.4)) // Crown top rim
      points.push(new THREE.Vector2(0, 1.45)) // Crown center dome
      break
    case "k": // King
      points.push(new THREE.Vector2(0.4, 0))
      points.push(new THREE.Vector2(0.4, 0.2))
      points.push(new THREE.Vector2(0.25, 0.4))
      points.push(new THREE.Vector2(0.2, 1.1)) // Tall body
      points.push(new THREE.Vector2(0.3, 1.25)) // Collar
      points.push(new THREE.Vector2(0.25, 1.4)) // Head section
      points.push(new THREE.Vector2(0, 1.45)) // Top flat
      break
    default:
      break
  }
  return points
}

// --- PIECE GEOMETRY COMPONENTS ---

const LathedPiece = ({ type, material }) => {
  const points = useMemo(() => getLathePoints(type), [type])

  return (
    <mesh material={material} castShadow receiveShadow>
      {/* 32 segments for smooth roundness */}
      <latheGeometry args={[points, 32]} />
    </mesh>
  )
}

// Knight needs to be modelled differently as it's not symmetric
const StylizedKnight = ({ material, color }) => {
  const rotation = color === "b" ? [0, Math.PI, 0] : [0, 0, 0]
  return (
    <group rotation={rotation}>
      {/* Base */}
      <mesh material={material} castShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.3, 32]} />
      </mesh>
      {/* Body/Neck - smoothly curved box */}
      <RoundedBox
        material={material}
        castShadow
        args={[0.3, 0.7, 0.3]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.5, 0]}
        rotation={[Math.PI / 8, 0, 0]}
      />
      {/* Head/Snout */}
      <RoundedBox
        material={material}
        castShadow
        args={[0.25, 0.35, 0.5]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.8, -0.3]}
        rotation={[Math.PI / 12, 0, 0]}
      />
      {/* Mane detail */}
      <RoundedBox
        material={material}
        castShadow
        args={[0.1, 0.5, 0.15]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.75, 0.15]}
        rotation={[-Math.PI / 8, 0, 0]}
      />
    </group>
  )
}

const ChessPiece = ({ type, color, position }) => {
  const ref = useRef()
  const material = usePieceMaterial(color)

  useFrame(({ clock }) => {
    if (ref.current) {
      // Subtle floating/breathing motion for style
      ref.current.position.y =
        position[1] + Math.sin(clock.getElapsedTime() * 1.5 + position[0] * position[2]) * 0.02
    }
  })

  const pieceContent = useMemo(() => {
    if (type === "n") return <StylizedKnight material={material} color={color} />

    // Base lathed piece
    let piece = <LathedPiece type={type} material={material} />

    // Add distinct tops for King and Queen
    if (type === "k") {
      piece = (
        <group>
          {piece}
          {/* The Cross */}
          <group position={[0, 1.6, 0]}>
            <RoundedBox material={material} castShadow args={[0.1, 0.35, 0.1]} radius={0.02} />
            <RoundedBox
              material={material}
              castShadow
              args={[0.3, 0.1, 0.1]}
              radius={0.02}
              position={[0, 0.05, 0]}
            />
          </group>
        </group>
      )
    }
    if (type === "q") {
      piece = (
        <group>
          {piece}
          {/* Tiny sphere finial on crown */}
          <mesh material={material} castShadow position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
          </mesh>
        </group>
      )
    }
    return piece
  }, [type, color, material])

  // Scale down slightly and center vertically based on type height
  let yOffset = 0
  // Adjust seating position based on how tall the lathe profile was
  if (["p", "r"].includes(type)) yOffset = 0.02
  if (["n"].includes(type)) yOffset = 0.02

  return (
    <group position={[position[0], position[1], position[2]]}>
      <group ref={ref} scale={0.85} position={[0, yOffset, 0]}>
        {pieceContent}
      </group>
    </group>
  )
}

const Square = ({ position, color, onClick, isSelected, isLastMove }) => {
  const [hovered, setHover] = useState(false)
  useCursor(hovered && !isSelected)

  const materialColor = isSelected
    ? "#ef4444"
    : isLastMove
    ? "#f59e0b"
    : hovered
    ? "#60a5fa"
    : color

  // Slightly thinner, smoother squares
  return (
    <RoundedBox
      position={position}
      args={[0.98, 0.15, 0.98]}
      radius={0.03}
      smoothness={4}
      onClick={onClick}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      receiveShadow
    >
      <meshStandardMaterial color={materialColor} roughness={0.6} metalness={0.1} />
    </RoundedBox>
  )
}

const Board = ({ game, onSquareClick, selectedSquare, lastMove }) => {
  const squares = []
  const board = game.board()

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isBlack = (row + col) % 2 === 1
      // Cleaner, more modern board colors
      const squareColor = isBlack ? "#475569" : "#cbd5e1"

      const squareName = String.fromCharCode(97 + col) + (8 - row)
      const isSelected = selectedSquare === squareName
      const isLastMove = lastMove && (lastMove.from === squareName || lastMove.to === squareName)
      const x = col - 3.5
      const z = row - 3.5

      squares.push(
        <Square
          key={`${row}-${col}`}
          position={[x, -0.08, z]}
          color={squareColor}
          onClick={(e) => {
            e.stopPropagation()
            onSquareClick(squareName)
          }}
          isSelected={isSelected}
          isLastMove={isLastMove}
        />
      )

      const piece = board[row][col]
      if (piece) {
        squares.push(
          <ChessPiece
            key={`p-${row}-${col}`}
            type={piece.type}
            color={piece.color}
            position={[x, 0, z]}
          />
        )
      }
    }
  }
  return <group>{squares}</group>
}

// --- UI (Minimal tweaks) ---
const UIOverlay = ({ gameStatus, onStart, onReset, turn }) => {
  const containerStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    p: 4,
  }
  const glassPanel = {
    background: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(12px)",
    padding: "30px",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.1)",
    pointerEvents: "auto",
    textAlign: "center",
    color: "white",
    margin: "auto",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
  }
  const btnStyle = {
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "white",
    border: "none",
    padding: "12px 24px",
    borderRadius: "12px",
    cursor: "pointer",
    margin: "8px",
    fontSize: "1rem",
    fontWeight: "600",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)",
    transition: "transform 0.1s",
  }
  const selectStyle = {
    padding: 10,
    borderRadius: 8,
    width: "100%",
    background: "#334155",
    color: "white",
    border: "1px solid #475569",
    outline: "none",
  }

  if (gameStatus === "init") {
    return (
      <div style={{ ...containerStyle, background: "rgba(0,0,0,0.85)" }}>
        <div style={glassPanel}>
          <h1 style={{ marginTop: 0, fontSize: "2.5rem", letterSpacing: "-1px" }}>3D Chess</h1>
          <div style={{ marginBottom: 25, textAlign: "left" }}>
            <label
              style={{
                fontSize: "0.9rem",
                color: "#94a3b8",
                fontWeight: "bold",
                display: "block",
                marginBottom: 5,
              }}
            >
              DIFFICULTY
            </label>
            <select id='diff' style={selectStyle}>
              <option value='easy'>Easy</option>
              <option value='medium'>Medium</option>
              <option value='hard'>Hard</option>
            </select>
          </div>
          <label
            style={{
              fontSize: "0.9rem",
              color: "#94a3b8",
              fontWeight: "bold",
              display: "block",
              marginBottom: 10,
            }}
          >
            PLAY AS
          </label>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => onStart(document.getElementById("diff").value, "w")}
              style={{ ...btnStyle, background: "white", color: "#0f172a" }}
            >
              White
            </button>
            <button
              onClick={() => onStart(document.getElementById("diff").value, "b")}
              style={{
                ...btnStyle,
                background: "#0f172a",
                color: "white",
                border: "1px solid #334155",
              }}
            >
              Black
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={containerStyle}>
      <div style={{ ...glassPanel, margin: "20px", alignSelf: "flex-start", padding: "20px 30px" }}>
        <h3 style={{ margin: "0 0 10px 0", opacity: 0.8 }}>STATUS</h3>
        <div style={{ fontSize: "1.2rem", marginBottom: 15 }}>
          Turn:{" "}
          <span style={{ fontWeight: "bold", color: turn === "w" ? "#86efac" : "#fca5a5" }}>
            {turn === "w" ? "White" : "Black"}
          </span>
        </div>
        {gameStatus === "checkmate" && (
          <h2 style={{ color: "#f87171", margin: "10px 0" }}>Checkmate!</h2>
        )}
        {gameStatus === "draw" && <h2 style={{ margin: "10px 0" }}>Draw!</h2>}
        <button onClick={onReset} style={{ ...btnStyle, background: "#ef4444", marginTop: 10 }}>
          Quit Game
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [game, setGame] = useState(new Chess())
  const [gameStatus, setGameStatus] = useState("init")
  const [playerColor, setPlayerColor] = useState("w")
  const [difficulty, setDifficulty] = useState("easy")
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [lastMove, setLastMove] = useState(null)
  const [isAiThinking, setIsAiThinking] = useState(false)

  useEffect(() => {
    if (game.isGameOver()) {
      if (game.isCheckmate()) setGameStatus("checkmate")
      else setGameStatus("draw")
    }
  }, [game])

  useEffect(() => {
    if (gameStatus !== "playing") return
    if (game.turn() !== playerColor && !isAiThinking) {
      setIsAiThinking(true)
      setTimeout(() => {
        const bestMove = getBestMove(game, difficulty)
        if (bestMove) {
          try {
            game.move(bestMove)
            setLastMove({ from: bestMove.from, to: bestMove.to })
            setGame(new Chess(game.fen()))
          } catch (e) {}
        }
        setIsAiThinking(false)
      }, 500)
    }
  }, [game, gameStatus, playerColor, difficulty, isAiThinking])

  const onSquareClick = (square) => {
    if (gameStatus !== "playing" || game.turn() !== playerColor || isAiThinking) return
    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }
    if (selectedSquare) {
      try {
        const move = game.move({ from: selectedSquare, to: square, promotion: "q" })
        if (move) {
          setLastMove({ from: move.from, to: move.to })
          setGame(new Chess(game.fen()))
          setSelectedSquare(null)
          return
        }
      } catch (e) {}
    }
    const piece = game.get(square)
    if (piece && piece.color === playerColor) setSelectedSquare(square)
    else setSelectedSquare(null)
  }

  const startGame = (diff, color) => {
    const newGame = new Chess()
    setGame(newGame)
    setDifficulty(diff)
    setPlayerColor(color)
    setGameStatus("playing")
    setLastMove(null)
    setSelectedSquare(null)
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#020617" }}>
      <Canvas shadows camera={{ position: [0, 12, 8], fov: 40 }}>
        <color attach='background' args={["#020617"]} />
        <fog attach='fog' args={["#020617", 15, 40]} />
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />

        {/* Stylish Lighting */}
        <ambientLight intensity={0.2} />
        {/* Main strong light for shadows and highlights */}
        <spotLight
          position={[8, 12, 8]}
          angle={0.3}
          penumbra={0.5}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          color='#ffd6a5'
        />
        {/* Cool fill light from opposite side */}
        <pointLight position={[-8, 6, -8]} intensity={0.8} color='#a5c4ff' />

        <group position={[0, -0.5, 0]}>
          {/* Board Base Platform */}
          <mesh position={[0, -0.3, 0]} receiveShadow>
            <boxGeometry args={[9.5, 0.4, 9.5]} />
            <meshStandardMaterial color='#1e293b' roughness={0.8} />
          </mesh>
          <Board
            game={game}
            onSquareClick={onSquareClick}
            selectedSquare={selectedSquare}
            lastMove={lastMove}
          />
        </group>

        <OrbitControls
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={6}
          maxDistance={20}
        />
        {/* Studio environment for beautiful reflections on the new materials */}
        <Environment preset='studio' blur={0.8} background={false} />
      </Canvas>
      <UIOverlay
        gameStatus={gameStatus}
        onStart={startGame}
        onReset={() => setGameStatus("init")}
        turn={game.turn()}
      />
    </div>
  )
}
