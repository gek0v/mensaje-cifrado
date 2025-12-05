"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState } from '@/lib/gameUtils';
import Board from './Board';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

interface GameRoomProps {
  roomId: string;
}

type Role = 'TABLE' | 'SPYMASTER_RED' | 'SPYMASTER_BLUE' | null;
type NotificationPayload = { nickname: string; role: Role };

let socket: Socket; // Keeping module scope for simplicity as handlers need it, but strictly managing in useEffect is better. 
// Actually, let's move it to a ref inside component to be 100% safe against race conditions.

export default function GameRoom({ roomId }: GameRoomProps) {
  // const socketRef = useState<Socket | null>(null); // Removed unused socketRef
  
  const [role, setRole] = useState<Role>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [nickname, setNickname] = useState(() => `Agente ${Math.floor(1000 + Math.random() * 9000)}`);
  const [notifications, setNotifications] = useState<{id: number, payload: NotificationPayload}[]>([]);
  const [clueNumber, setClueNumber] = useState<number>(1);
  const [isHost, setIsHost] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const router = useRouter();

  const handleCopyLink = async () => {
      try {
          await navigator.clipboard.writeText(window.location.href);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
          console.error('Failed to copy:', err);
      }
  };

  useEffect(() => {
    const secret = sessionStorage.getItem(`host_secret_${roomId}`);
    const newIsHost = !!secret;
    if (newIsHost !== isHost) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsHost(newIsHost);
    }

    // Initialize socket only once if possible, or handle cleanup properly
    socket = io();
    
    socket.on('connect', () => {
        console.log("Connected to server");
        
        // Try to restore session
        const savedSession = localStorage.getItem('mensaje_cifrado_session');
        if (savedSession) {
            try {
                const { roomId: savedRoomId, role: savedRole, nickname: savedNickname } = JSON.parse(savedSession);
                if (savedRoomId === roomId && savedRole && savedNickname) {
                    console.log("Restoring session...", savedRole, savedNickname);
                    setNickname(savedNickname); // Restore nickname to state
                    socket.emit('join_room', { roomId, role: savedRole, nickname: savedNickname }, (response: { success: boolean; state?: GameState; error?: string }) => {
                        if (response.success && response.state) {
                            setRole(savedRole);
                            setGameState(response.state);
                        }
                    });
                }
            } catch (e) {
                console.error("Failed to parse session", e);
            }
        }

        // Get initial state to know mode
        socket.emit('get_room_state', roomId, (response: { success: boolean; state?: GameState }) => {
            if (response.success && response.state) {
                setGameState(response.state);
            }
        });
    });

    socket.on('game_update', (newState: GameState) => setGameState(newState));
    
    // Listen for timer update (lighter payload)
    socket.on('timer_update', (time: number) => {
        setGameState(prev => prev ? { ...prev, timer: time } : null);
    });
    
    // Listen for notification (can be string or object payload)
    socket.on('notification', (payload: NotificationPayload | string) => {
        console.log("Notification received:", payload);
        const id = Date.now();
        // Normalize payload to object structure if it comes as string
        const normalizedPayload = typeof payload === 'string' 
            ? { nickname: payload, role: 'TABLE' as Role } // Fallback for string messages
            : payload;

        setNotifications(prev => [...prev, { id, payload: normalizedPayload }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    });

    return () => { 
        socket.disconnect(); 
    };
  }, [roomId, isHost]);

  const handleJoin = (selectedRole: Role) => {
    if (!selectedRole) return;
    if (!nickname.trim()) { setError("Requerido"); return; }
    
    socket.emit('join_room', { roomId, role: selectedRole, nickname }, (response: { success: boolean; state?: GameState; error?: string }) => {
      if (response.success && response.state) {
        setRole(selectedRole);
        setGameState(response.state);
        // Save session
        localStorage.setItem('mensaje_cifrado_session', JSON.stringify({ roomId, role: selectedRole, nickname }));
      } else {
        setError(response.error === 'Room not found' ? "Sala no encontrada" : (response.error || 'Error desconocido'));
      }
    });
  };

  const handleCardClick = (cardId: number) => {
    if (role !== 'TABLE' || gameState?.phase !== 'GUESSING') return; 
    socket.emit('flip_card', { roomId, cardId });
  };

  const handleReset = () => {
      const secret = sessionStorage.getItem(`host_secret_${roomId}`);
      if (secret) socket.emit('reset_game', { roomId, hostSecret: secret });
  };

  const handleGiveClue = () => {
      if (!gameState) return;
      socket.emit('give_clue', { roomId, number: clueNumber });
  };

  const handleEndTurn = () => {
      socket.emit('end_turn', roomId);
  };

  const handleChangeRole = () => {
      socket.emit('leave_role', { roomId, currentRole: role, nickname });
      setRole(null);
      localStorage.removeItem('mensaje_cifrado_session');
      // Do not clear gameState so we remember the mode
  };

  const handleGoToHome = () => {
      socket.emit('leave_room', { roomId, nickname });
      localStorage.removeItem('mensaje_cifrado_session');
      router.push('/');
  };

  const handleChangeTime = (newTime: number) => {
      socket.emit('change_max_time', { roomId, maxTime: newTime });
      setShowTimeMenu(false);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Grid Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className={`absolute inset-0 ${gameState?.gameMode === 'NEURAL_LINK' ? 'bg-[radial-gradient(circle_800px_at_50%_200px,#064e3b,transparent)]' : 'bg-[radial-gradient(circle_800px_at_50%_200px,#3b0764,transparent)]'} opacity-40 pointer-events-none`}></div>

        <div className={`glass-panel p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center relative z-10 border ${gameState?.gameMode === 'NEURAL_LINK' ? 'border-emerald-500/20 box-glow-emerald' : 'border-purple-500/20 box-glow-purple'}`}>
          <h2 className={`text-3xl font-black text-transparent bg-clip-text ${gameState?.gameMode === 'NEURAL_LINK' ? 'bg-gradient-to-r from-emerald-400 to-teal-600' : 'bg-gradient-to-r from-purple-400 to-pink-600'} mb-2`}>SALA DE ACCESO</h2>
          <div className={`inline-block bg-purple-900/30 border ${
            gameState?.gameMode === 'NEURAL_LINK' ? 'border-emerald-500/30 text-emerald-200' : 'border-purple-500/30 text-purple-200'
          } px-3 py-1 rounded font-mono mb-6 tracking-widest`}>{roomId}</div>
          
          {error && <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}
          
          <div className="flex flex-col gap-6 text-left">
            <div>
                <label className={`text-xs font-bold uppercase tracking-widest mb-2 block ${
                    gameState?.gameMode === 'NEURAL_LINK' ? 'text-emerald-400' : 'text-purple-400'
                }`}>Identificación</label>
                <input 
                    type="text" 
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={`w-full p-4 bg-black/40 border border-white/10 rounded-xl font-bold text-white outline-none transition-all ${
                        gameState?.gameMode === 'NEURAL_LINK'
                            ? 'focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'focus:border-purple-500 focus:shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    }`}
                    placeholder="Nombre en clave..."
                />
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
            
            <div className="flex flex-col gap-3">
                <button 
                onClick={() => handleJoin('TABLE')}
                className={`group relative p-5 bg-gray-900/80 border border-white/10 rounded-xl transition-all overflow-hidden ${
                    gameState?.gameMode === 'NEURAL_LINK'
                        ? 'hover:border-emerald-500/50 hover:bg-emerald-900/10'
                        : 'hover:border-purple-500/50 hover:bg-purple-900/10'
                }`}
                >
                    <div className="flex flex-col items-center gap-1">
                        <span className={`font-bold text-xl text-white tracking-widest ${
                            gameState?.gameMode === 'NEURAL_LINK' ? 'group-hover:text-emerald-200' : 'group-hover:text-purple-200'
                        }`}>MESA DE JUEGO</span>
                        <span className="text-[10px] text-gray-500 group-hover:text-purple-400 uppercase tracking-widest">Pantalla Principal</span>
                    </div>
                </button>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                {gameState?.gameMode !== 'NEURAL_LINK' && (
                    <button 
                        onClick={() => handleJoin('SPYMASTER_RED')}
                        className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-xl hover:bg-red-900/50 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all font-bold"
                    >
                        JEFE ROJO
                    </button>
                )}
                <button 
                    onClick={() => handleJoin('SPYMASTER_BLUE')}
                    className={`p-4 bg-blue-950/30 border border-blue-900/50 text-blue-400 rounded-xl hover:bg-blue-900/50 hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all font-bold ${gameState?.gameMode === 'NEURAL_LINK' ? 'col-span-2' : ''}`}
                >
                    JEFE AZUL
                </button>
                </div>
            </div>

            <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink mx-4 text-gray-500 font-mono text-xs">REGRESAR</span>
                <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-gray-700/50 text-gray-300 rounded-xl font-bold text-lg hover:bg-gray-600/70 hover:shadow-[0_0_15px_rgba(156,163,175,0.2)] transition-all transform active:scale-95 tracking-widest border border-gray-500/30"
            >
                PANTALLA INICIAL
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return <div className="flex justify-center items-center min-h-screen bg-black text-purple-500 font-mono animate-pulse">CONECTANDO AL SISTEMA...</div>;

  const isRedTurn = gameState.turn === 'RED';
  const winnerColor = gameState.winner === 'RED' ? 'text-red-500' : 'text-blue-500';
  const isMyTurn = (role === 'SPYMASTER_RED' && isRedTurn) || (role === 'SPYMASTER_BLUE' && !isRedTurn);

  return (
    <div className="min-h-screen bg-black flex flex-col text-gray-200 font-sans selection:bg-purple-500/30 relative">
      
      {/* Notifications Container (Toast) */}
      <div className="fixed top-24 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
         {notifications.map(n => {
             // Defensive check: ensure payload exists and is an object
             if (!n.payload || typeof n.payload !== 'object') return null;
             
             const { nickname, role } = n.payload;
             const safeRole = role || 'TABLE';
             const safeNickname = nickname || 'Agente';

             const message = `${safeNickname} se ha unido como ${safeRole === 'TABLE' ? 'MESA' : safeRole === 'SPYMASTER_RED' ? 'JEFE ROJO' : 'JEFE AZUL'}!`;
             
             let bgColor = "bg-purple-900/90";
             let borderColor = "border-purple-400";
             let shadowColor = "shadow-[0_0_20px_rgba(168,85,247,0.6)]";
             
             if (gameState.gameMode === 'NEURAL_LINK' && safeRole === 'TABLE') {
                bgColor = "bg-emerald-900/90";
                borderColor = "border-emerald-400";
                shadowColor = "shadow-[0_0_20px_rgba(16,185,129,0.6)]";
             }


             switch (safeRole) {
                case 'SPYMASTER_RED':
                    bgColor = "bg-red-900/90";
                    borderColor = "border-red-400";
                    shadowColor = "shadow-[0_0_20px_rgba(239,68,68,0.6)]";
                    break;
                case 'SPYMASTER_BLUE':
                    bgColor = "bg-blue-900/90";
                    borderColor = "border-blue-400";
                    shadowColor = "shadow-[0_0_20px_rgba(59,130,246,0.6)]";
                    break;
                case 'TABLE':
                default:
                    // Keep purple
                    break;
             }
             return (
                <div 
                    key={n.id} 
                    className={`${bgColor} ${borderColor} text-white ${shadowColor} px-6 py-3 rounded-full animate-bounce font-bold text-sm tracking-widest uppercase backdrop-blur-sm transition-all duration-300 border`}
                >
                    ⚡ {message}
                </div>
             );
         })}
      </div>

      {/* Cyberpunk Header */}
      <header className="bg-black/80 backdrop-blur-md border-b border-white/5 p-2 sm:p-4 grid grid-cols-3 items-center sticky top-0 z-50 h-16 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex flex-col leading-none">
            <span className={`text-[10px] tracking-[0.3em] font-bold ${
                gameState?.gameMode === 'NEURAL_LINK' ? 'text-emerald-500' : 'text-purple-500'
            }`}>SALA</span>
            <span className={`font-mono text-white text-lg tracking-widest ${
                gameState?.gameMode === 'NEURAL_LINK' ? 'text-glow-emerald' : 'text-glow-purple'
            }`}>{roomId}</span>
          </div>
        </div>
        
        {/* Scoreboard or Timer */}
        <div className="flex items-center gap-6 sm:gap-12 justify-center relative">
            {gameState.gameMode === 'NEURAL_LINK' ? (
                <div className={`text-4xl font-mono font-black tracking-widest ${gameState.timer < 30 ? 'text-red-500 animate-pulse drop-shadow-[0_0_10px_red]' : 'text-purple-400 text-glow-purple'}`}>
                    {Math.floor(gameState.timer / 60)}:{(gameState.timer % 60).toString().padStart(2, '0')}
                </div>
            ) : (
                <>
                    <div className={`text-3xl font-black transition-all duration-500 ${isRedTurn ? 'text-red-500 text-glow-red scale-110' : 'text-red-900 blur-[1px]'}`}>
                        {gameState.redScore}
                    </div>
                    <div className="h-8 w-px bg-white/10 rotate-12"></div>
                    <div className={`text-3xl font-black transition-all duration-500 ${!isRedTurn ? 'text-blue-500 text-glow-blue scale-110' : 'text-blue-900 blur-[1px]'}`}>
                        {gameState.blueScore}
                    </div>
                    
                    {/* Active Turn Indicator Underline */}
                    <div className={`absolute -bottom-6 h-0.5 w-20 bg-current transition-all duration-500 ${isRedTurn ? 'text-red-500 -translate-x-8' : 'text-blue-500 translate-x-8'}`}></div>
                </>
            )}
        </div>

        <div className="flex gap-3 items-center justify-end">
             {/* Nickname Display */}
             <div className="hidden sm:block font-mono text-gray-500 uppercase text-xs tracking-wider border-r border-white/10 pr-3 mr-1">
                 {nickname}
             </div>

             <div className="relative">
                                 <button 
                                    onClick={() => {
                                        if (isHost && gameState.gameMode === 'NEURAL_LINK') {
                                            setShowTimeMenu(!showTimeMenu);
                                        }
                                    }}
                                    disabled={!isHost || gameState.gameMode !== 'NEURAL_LINK'}
                                    className={`px-4 py-1.5 rounded-full font-bold text-xs tracking-widest border transition-all transform ${
                                        gameState.gameMode === 'NEURAL_LINK' 
                                        ? `bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] ${isHost ? 'hover:bg-emerald-500/20 cursor-pointer active:scale-95' : 'cursor-default'}`
                                        : isRedTurn ? 'bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)] cursor-default' : 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)] cursor-default'
                                    }`}
                                >
                                    {gameState.gameMode === 'NEURAL_LINK' ? 'DURACIÓN' : (isRedTurn ? 'TURNO ROJO' : 'TURNO AZUL')}
                                </button>                
                {/* Floating Time Menu */}
                {showTimeMenu && (
                    <div className="absolute top-full right-0 mt-2 w-32 bg-black/90 border border-emerald-500/50 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                        <div className="flex flex-col">
                             <button onClick={() => handleChangeTime(90)} className="px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all text-left">1:30 MIN</button>
                             <button onClick={() => handleChangeTime(180)} className="px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all text-left border-t border-emerald-500/10">3 MIN</button>
                             <button onClick={() => handleChangeTime(300)} className="px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all text-left border-t border-emerald-500/10">5 MIN</button>
                        </div>
                    </div>
                )}
            </div>
            
            <button 
                onClick={() => setShowShareModal(true)} 
                className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-emerald-600/50 border border-white/10 rounded-full text-white transition-all text-sm"
                title="Compartir Sala"
            >
                🔗
            </button>
            <button 
                onClick={handleChangeRole} 
                className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-purple-600/50 border border-white/10 rounded-full text-white transition-all text-sm"
                title="Cambiar Rol"
            >
                👥
            </button>
            <button 
                onClick={handleGoToHome} 
                className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-red-600/50 border border-white/10 rounded-full text-white transition-all text-sm"
                title="Salir de la partida"
            >
                🏠
            </button>

            {isHost && (
                <button onClick={handleReset} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all">
                    ↺
                </button>
            )}
        </div>
      </header>

      {/* Status Bar / Notifications */}
      <div className="w-full bg-[#0a0a0a] border-b border-white/5 p-3 text-center relative overflow-hidden transition-all duration-300">
        <div className={`absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent ${
            gameState?.gameMode === 'NEURAL_LINK' ? 'via-emerald-500/50' : 'via-purple-500/50'
        } to-transparent`}></div>
        
        {gameState.winner ? (
             <span className="text-2xl font-black tracking-widest text-yellow-400 animate-pulse drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">MISIÓN FINALIZADA</span>
        ) : (
            <>
                {gameState.phase === 'CLUE' ? (
                        <div className="flex items-center justify-center min-h-[2.5rem] animate-in fade-in duration-300">
                            {role === 'TABLE' && (
                                <span className="text-purple-300 animate-pulse font-mono text-sm tracking-widest">[ ESPERANDO TRANSMISIÓN CIFRADA... ]</span>
                            )}
                            {!isMyTurn && role !== 'TABLE' && (
                                <span className="text-gray-500 font-mono text-xs tracking-widest">ESPERANDO AL JEFE RIVAL</span>
                            )}
                            {isMyTurn && (
                                <div className="flex items-center gap-4 justify-center animate-in fade-in slide-in-from-top-2">
                                    {gameState.gameMode === 'NEURAL_LINK' ? (
                                        <button 
                                            onClick={() => {
                                                socket.emit('give_clue', { roomId, number: -1 });
                                            }}
                                            className="px-8 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-base tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.6)] transition-all animate-pulse"
                                        >
                                            INICIAR SISTEMA
                                        </button>
                                    ) : (
                                        <>
                                            <select 
                                                value={clueNumber} 
                                                onChange={(e) => setClueNumber(Number(e.target.value))}
                                                className="bg-black border border-purple-500/50 text-purple-400 px-4 py-1 rounded font-mono font-bold focus:outline-none focus:border-purple-500"
                                            >
                                                {[1,2,3,4,5,6,7,8,9].map(n => (
                                                    <option key={n} value={n}>{n}</option>
                                                ))}
                                                <option value={0}>0</option>
                                                <option value={-1}>∞</option>
                                            </select>
                                            <button 
                                                onClick={handleGiveClue}
                                                className="px-6 py-1 text-white rounded font-bold text-sm tracking-widest transition-all bg-purple-600 hover:bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                                            >
                                                TRANSMITIR
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center animate-in fade-in duration-300">
                            <div className="flex items-baseline gap-3">
                                <span className="text-gray-500 text-[10px] font-mono uppercase tracking-[0.2em]">OBJETIVOS</span>
                                <span className={`text-3xl font-black text-white font-mono ${gameState.gameMode === 'NEURAL_LINK' ? 'text-glow-emerald' : 'text-glow-purple'}`}>
                                    {gameState.currentClueNumber === -1 ? '∞' : gameState.currentClueNumber}
                                </span>
                            </div>
                            
                            {role === 'TABLE' && gameState.gameMode !== 'NEURAL_LINK' && (
                                <button 
                                    onClick={handleEndTurn}
                                    className="mt-2 px-6 py-1 bg-transparent border border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:border-orange-500 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] text-xs font-bold rounded transition-all uppercase tracking-widest"
                                >
                                    ABORTAR TURNO
                                </button>
                            )}
                        </div>
                    )}
            </>
        )}
      </div>

      {/* Main Board */}
      <main className="flex-1 relative w-full flex flex-col overflow-hidden bg-[radial-gradient(circle_at_center,#1a1a1a_0%,#000000_100%)]">
        {gameState.winner && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80 backdrop-blur-sm pointer-events-none animate-in fade-in duration-700">
                <div className="p-12 bg-black border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                    <h2 className={`text-6xl font-black ${winnerColor} mb-4 tracking-tighter drop-shadow-[0_0_15px_rgba(0,0,0,1)]`}>
                        {gameState.winner}
                    </h2>
                    <p className="text-white font-mono text-xl tracking-[0.5em] uppercase">VICTORIA</p>
                </div>
            </div>
        )}

        <Board 
          board={gameState.board} 
          role={role} 
          onCardClick={handleCardClick} 
        />
      </main>
      
      {/* Footer Log */}
      <footer className="bg-black border-t border-white/5 p-2 text-[10px] text-gray-500 flex justify-between items-center font-mono uppercase tracking-wide">
         <div className="flex gap-6 pl-2">
             <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_red]"></div>
                 <span className="text-red-400 font-bold">
                     {gameState.spymasters.RED.map(p => p.name).join(', ') || '---'}
                 </span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_blue]"></div>
                 <span className="text-blue-400 font-bold">
                     {gameState.spymasters.BLUE.map(p => p.name).join(', ') || '---'}
                 </span>
             </div>
         </div>
         
         <div className="opacity-60 truncate max-w-[250px] pr-2 text-right text-purple-300/50">
            {gameState.log[gameState.log.length - 1]}
         </div>
      </footer>

      {/* Share Modal */}
      {showShareModal && (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
            onClick={() => setShowShareModal(false)}
        >
            <div 
                className={`bg-[#0a0a0a] border ${gameState?.gameMode === 'NEURAL_LINK' ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)]'} rounded-2xl p-8 max-w-sm w-full relative overflow-hidden flex flex-col items-center gap-6`} 
                onClick={e => e.stopPropagation()}
            >
                 <h3 className={`text-xl font-black tracking-widest uppercase ${gameState?.gameMode === 'NEURAL_LINK' ? 'text-emerald-400' : 'text-purple-400'}`}>
                     ENLACE DE ACCESO
                 </h3>
                 
                 <div className="bg-white p-4 rounded-xl">
                     <QRCodeSVG 
                        value={typeof window !== 'undefined' ? window.location.href : ''} 
                        size={200}
                        level={"H"}
                        includeMargin={false}
                     />
                 </div>
                 
                 <div className="w-full flex flex-col gap-3">
                     <div className="bg-white/5 p-3 rounded-lg text-center font-mono text-xs text-gray-400 break-all border border-white/10">
                         {typeof window !== 'undefined' ? window.location.href : ''}
                     </div>
                     
                     <button 
                        onClick={handleCopyLink}
                        className={`w-full py-3 rounded-xl font-bold tracking-widest transition-all flex items-center justify-center gap-2 ${
                            copySuccess 
                                ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                                : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                     >
                        {copySuccess ? '¡ENLACE COPIADO!' : 'COPIAR ENLACE'}
                     </button>
                 </div>
                 
                 <button 
                    onClick={() => setShowShareModal(false)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                 >
                    ✕
                 </button>
            </div>
        </div>
      )}
    </div>
  );
}
