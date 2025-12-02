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

  const [clueNumber, setClueNumber] = useState<number>(1);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
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
    setLoading(true);
    
    socket.emit('join_room', { roomId, role: selectedRole }, (response: any) => {
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
    // ... (Login UI remains same, skipping for brevity in replace block if possible, but I must provide exact match context or full file replacement.
    // Since I am replacing logic inside the component, I should probably just provide the full component content or large chunks.
    // To be safe and clean, I will replace the whole main return block and the new functions.)
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-lg w-full text-center">
          <h2 className="text-2xl font-bold mb-6 text-blue-600">Elige tu Rol para la Sala: {roomId}</h2>
          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
          
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => handleJoin('TABLE')}
              className="p-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-bold text-lg"
            >
              MESA DE JUEGO
              <span className="block text-sm font-normal opacity-70 mt-1">
                Dispositivo central para ver palabras y jugar
              </span>
            </button>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleJoin('SPYMASTER_RED')}
                className="p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
              >
                JEFE ROJO
              </button>
              <button 
                onClick={() => handleJoin('SPYMASTER_BLUE')}
                className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
              >
                JEFE AZUL
              </button>
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
  const isCluePhase = gameState.phase === 'CLUE';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="font-bold text-xl text-gray-700 hidden sm:block">
          Sala: <span className="font-mono text-black bg-gray-200 px-2 py-1 rounded">{roomId}</span>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-8 flex-1 justify-center">
            <div className={`text-2xl font-black ${isRedTurn ? 'text-red-600' : 'text-gray-400'}`}>
                {gameState.redScore}
            </div>
            <div className="text-xl font-bold text-gray-400">vs</div>
            <div className={`text-2xl font-black ${!isRedTurn ? 'text-blue-600' : 'text-gray-400'}`}>
                {gameState.blueScore}
            </div>
        </div>

        <div className="flex gap-2 items-center">
            <div className={`px-3 py-1 sm:px-4 sm:py-2 rounded-full font-bold text-white text-sm sm:text-base ${isRedTurn ? 'bg-red-600' : 'bg-blue-600'}`}>
                {isRedTurn ? 'ROJO' : 'AZUL'}
            </div>
            
            {/* Reset only for Host */}
            {isHost && (
                <button 
                    onClick={handleReset}
                    className="px-3 py-1 sm:px-4 sm:py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-semibold text-sm sm:text-base"
                >
                    Reset
                </button>
            )}
        </div>
      </header>

      {/* Clue / Status Section */}
      <div className="w-full bg-gray-800 text-white p-4 text-center shadow-inner">
        {gameState.winner ? (
             <span className="text-2xl font-bold text-yellow-400">¡JUEGO TERMINADO!</span>
        ) : (
            <>
                {gameState.phase === 'CLUE' ? (
                    <div className="min-h-[3rem] flex items-center justify-center">
                         {role === 'TABLE' && (
                             <span className="text-xl animate-pulse">Esperando pista del Jefe de Espías...</span>
                         )}
                         {!isMyTurn && role !== 'TABLE' && (
                             <span className="text-xl text-gray-400">Esperando pista del equipo contrario...</span>
                         )}
                         {isMyTurn && (
                             <div className="flex items-center gap-4">
                                 <span className="font-bold">Elige número de palabras:</span>
                                 <select 
                                    value={clueNumber} 
                                    onChange={(e) => setClueNumber(Number(e.target.value))}
                                    className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-bold"
                                 >
                                     {[1,2,3,4,5,6,7,8,9].map(n => (
                                         <option key={n} value={n}>{n}</option>
                                     ))}
                                     <option value={0}>0</option>
                                     <option value={-1}>∞</option>
                                 </select>
                                 <button 
                                    onClick={handleGiveClue}
                                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded font-bold"
                                 >
                                     DAR PISTA
                                 </button>
                             </div>
                         )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center relative">
                        <span className="text-gray-400 text-sm uppercase tracking-widest">PISTA ACTUAL</span>
                        <div className="text-3xl font-black text-white mt-1 mb-2">
                            {gameState.currentClueNumber === -1 ? '∞' : gameState.currentClueNumber} PALABRAS
                        </div>
                        
                        {/* Table End Turn Button */}
                        {role === 'TABLE' && (
                            <button 
                                onClick={handleEndTurn}
                                className="mt-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg shadow-md transition transform active:scale-95"
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
      <main className="flex-grow p-4 flex flex-col items-center">
        {gameState.winner && (
            <div className="mb-8 p-6 bg-white rounded-xl shadow-lg border-4 border-yellow-400 text-center animate-bounce z-10">
                <h2 className={`text-4xl font-black ${winnerColor}`}>
                    ¡EQUIPO {gameState.winner} GANA!
                </h2>
            </div>
        )}

        <Board 
          board={gameState.board} 
          role={role} 
          onCardClick={handleCardClick} 
        />
        
        {/* Game Log */}
        <div className="mt-8 w-full max-w-3xl bg-white rounded-lg shadow p-4 max-h-40 overflow-y-auto">
            <h3 className="font-bold text-gray-500 mb-2 text-xs uppercase tracking-wider">Log de la partida</h3>
            <div className="flex flex-col-reverse">
                {gameState.log.map((entry, i) => (
                    <div key={i} className="text-sm text-gray-600 border-b border-gray-100 py-1 last:border-0">
                        {entry}
                    </div>
                ))}
            </div>
        </div>
      </main>
      
      {/* Footer Info */}
      <footer className="p-2 text-center text-xs text-gray-400">
        Rol actual: {role} | Fase: {gameState.phase}
      </footer>
    </div>
  );
}
