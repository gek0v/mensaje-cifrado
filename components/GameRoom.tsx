"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState } from '@/lib/gameUtils';
import Board from './Board';

interface GameRoomProps {
  roomId: string;
}

type Role = 'TABLE' | 'SPYMASTER_RED' | 'SPYMASTER_BLUE' | null;

let socket: Socket;

export default function GameRoom({ roomId }: GameRoomProps) {
  const [role, setRole] = useState<Role>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Nickname state with default random value
  const [nickname, setNickname] = useState('');

  const [clueNumber, setClueNumber] = useState<number>(1);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    // Initialize random nickname on client side only to avoid hydration mismatch
    setNickname(`Agente ${Math.floor(1000 + Math.random() * 9000)}`);

    // Check for host secret
    const secret = sessionStorage.getItem(`host_secret_${roomId}`);
    setIsHost(!!secret);

    // Initialize socket
    socket = io();

    socket.on('game_update', (newState: GameState) => {
      setGameState(newState);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const handleJoin = (selectedRole: Role) => {
    if (!selectedRole) return;
    if (!nickname.trim()) {
        setError("Por favor ingresa un apodo.");
        return;
    }
    setLoading(true);
    
    socket.emit('join_room', { roomId, role: selectedRole, nickname }, (response: any) => {
      setLoading(false);
      if (response.success) {
        setRole(selectedRole);
        setGameState(response.state);
      } else {
        if (response.error === 'Room not found') {
             setError("Sala no encontrada (¿Reiniciaste el servidor?).");
        } else {
             setError(response.error);
        }
      }
    });
  };

  const handleCardClick = (cardId: number) => {
    if (role !== 'TABLE') return;
    if (gameState?.phase !== 'GUESSING') return; 
    socket.emit('flip_card', { roomId, cardId });
  };

  const handleReset = () => {
      const secret = sessionStorage.getItem(`host_secret_${roomId}`);
      if (!secret) return;
      socket.emit('reset_game', { roomId, hostSecret: secret });
  };

  const handleGiveClue = () => {
      if (!gameState) return;
      socket.emit('give_clue', { roomId, number: clueNumber });
  };

  const handleEndTurn = () => {
      socket.emit('end_turn', roomId);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-lg w-full text-center">
          <h2 className="text-2xl font-bold text-blue-600">Sala: <span className="font-mono text-black">{roomId}</span></h2>
          <p className="text-gray-500 mb-6">Configura tu perfil para entrar</p>
          
          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
          
          <div className="flex flex-col gap-6">
            
            <div className="flex flex-col text-left">
                <label className="text-sm font-bold text-gray-700 mb-1">Tu Apodo</label>
                <input 
                    type="text" 
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="p-3 border-2 border-gray-300 rounded-lg font-bold text-lg focus:border-blue-500 outline-none"
                    placeholder="Ej. Agente 007"
                />
            </div>

            <div className="border-t border-gray-200 my-2"></div>
            
            <div className="flex flex-col gap-3">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wide">Selecciona tu Rol</span>
                
                <button 
                onClick={() => handleJoin('TABLE')}
                className="group relative p-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-all overflow-hidden shadow-md hover:shadow-lg"
                >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                        <span className="font-bold text-xl">MESA DE JUEGO</span>
                    </div>
                    <span className="block text-xs text-gray-400 mt-1 font-medium group-hover:text-gray-300">
                        Modo espectador / Pantalla central compartida
                    </span>
                </button>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                <button 
                    onClick={() => handleJoin('SPYMASTER_RED')}
                    className="p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-md hover:shadow-lg transition-transform transform hover:-translate-y-1"
                >
                    JEFE ROJO
                    <span className="block text-xs opacity-70 font-normal mt-1">Da las pistas</span>
                </button>
                <button 
                    onClick={() => handleJoin('SPYMASTER_BLUE')}
                    className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md hover:shadow-lg transition-transform transform hover:-translate-y-1"
                >
                    JEFE AZUL
                    <span className="block text-xs opacity-70 font-normal mt-1">Da las pistas</span>
                </button>
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) return <div className="flex justify-center items-center min-h-screen">Cargando...</div>;

  const isRedTurn = gameState.turn === 'RED';
  const winnerColor = gameState.winner === 'RED' ? 'text-red-600' : 'text-blue-600';
  
  // Check if current user is the active spymaster
  const isMyTurn = (role === 'SPYMASTER_RED' && isRedTurn) || (role === 'SPYMASTER_BLUE' && !isRedTurn);
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm p-2 sm:p-4 flex justify-between items-center sticky top-0 z-50 h-16">
        <div className="font-bold text-lg sm:text-xl text-gray-700 hidden sm:flex flex-col leading-tight">
          <span>Sala</span>
          <span className="font-mono text-black text-sm bg-gray-200 px-1 rounded w-fit">{roomId}</span>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-8 flex-1 justify-center">
            <div className={`text-2xl sm:text-3xl font-black ${isRedTurn ? 'text-red-600' : 'text-gray-300'}`}>
                {gameState.redScore}
            </div>
            <div className="text-lg font-bold text-gray-300">-</div>
            <div className={`text-2xl sm:text-3xl font-black ${!isRedTurn ? 'text-blue-600' : 'text-gray-300'}`}>
                {gameState.blueScore}
            </div>
        </div>

        <div className="flex gap-2 items-center">
            <div className={`px-3 py-1 sm:px-4 sm:py-2 rounded-full font-bold text-white text-xs sm:text-sm transition-colors ${isRedTurn ? 'bg-red-600' : 'bg-blue-600'}`}>
                TURNO {isRedTurn ? 'ROJO' : 'AZUL'}
            </div>
            
            {isHost && (
                <button 
                    onClick={handleReset}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-bold text-xs"
                >
                    ↻
                </button>
            )}
        </div>
      </header>

      {/* Clue / Status Section */}
      <div className="w-full bg-gray-800 text-white p-2 sm:p-4 text-center shadow-inner z-40">
        {gameState.winner ? (
             <span className="text-xl sm:text-2xl font-bold text-yellow-400 animate-pulse">¡JUEGO TERMINADO!</span>
        ) : (
            <>
                {gameState.phase === 'CLUE' ? (
                    <div className="min-h-[3rem] flex items-center justify-center">
                         {role === 'TABLE' && (
                             <span className="text-lg sm:text-xl animate-pulse font-medium">Esperando pista...</span>
                         )}
                         {!isMyTurn && role !== 'TABLE' && (
                             <span className="text-lg text-gray-400">Esperando al Jefe de Espías rival...</span>
                         )}
                         {isMyTurn && (
                             <div className="flex items-center gap-2 sm:gap-4 justify-center flex-wrap">
                                 <span className="font-bold hidden sm:inline">Pista:</span>
                                 <select 
                                    value={clueNumber} 
                                    onChange={(e) => setClueNumber(Number(e.target.value))}
                                    className="bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded font-bold text-lg"
                                 >
                                     {[1,2,3,4,5,6,7,8,9].map(n => (
                                         <option key={n} value={n}>{n}</option>
                                     ))}
                                     <option value={0}>0</option>
                                     <option value={-1}>∞</option>
                                 </select>
                                 <button 
                                    onClick={handleGiveClue}
                                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow-md active:transform active:translate-y-1"
                                 >
                                     ENVIAR
                                 </button>
                             </div>
                         )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center relative">
                        <div className="flex items-baseline gap-2">
                            <span className="text-gray-400 text-xs uppercase tracking-widest">PALABRAS:</span>
                            <span className="text-2xl font-black text-white">
                                {gameState.currentClueNumber === -1 ? '∞' : gameState.currentClueNumber}
                            </span>
                        </div>
                        
                        {role === 'TABLE' && (
                            <button 
                                onClick={handleEndTurn}
                                className="mt-1 px-4 py-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded shadow-md"
                            >
                                TERMINAR TURNO
                            </button>
                        )}
                    </div>
                )}
            </>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 relative w-full flex flex-col overflow-hidden">
        {gameState.winner && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 pointer-events-none">
                <div className="p-8 bg-white rounded-xl shadow-2xl border-4 border-yellow-400 text-center transform rotate-3">
                    <h2 className={`text-5xl font-black ${winnerColor} mb-2`}>
                        {gameState.winner}
                    </h2>
                    <p className="text-gray-800 font-bold text-xl">HA GANADO</p>
                </div>
            </div>
        )}

        <Board 
          board={gameState.board} 
          role={role} 
          onCardClick={handleCardClick} 
        />
      </main>
      
      {/* Footer Info & Log */}
      <footer className="bg-white border-t border-gray-200 p-2 text-xs text-gray-500 flex flex-col sm:flex-row justify-between items-center gap-2">
         <div className="flex gap-4">
             <div className="flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full bg-red-500"></div>
                 <span className="font-bold text-red-700">
                     {gameState.spymasters.RED.map(p => p.name).join(', ') || 'Esperando...'}
                 </span>
             </div>
             <div className="flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 <span className="font-bold text-blue-700">
                     {gameState.spymasters.BLUE.map(p => p.name).join(', ') || 'Esperando...'}
                 </span>
             </div>
         </div>
         
         <div className="opacity-50 truncate max-w-[200px]">
            {gameState.log[gameState.log.length - 1]}
         </div>
      </footer>
    </div>
  );
}