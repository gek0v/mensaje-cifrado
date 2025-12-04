"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [gameMode, setGameMode] = useState<'STANDARD' | 'NEURAL_LINK'>('STANDARD');
  const [maxTime, setMaxTime] = useState<number>(180); // Default 3 min
  const router = useRouter();

  const createRoom = () => {
    const socket = io(); 
    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    socket.emit('create_room', newRoomId, gameMode, maxTime, (response: { success: boolean; hostSecret?: string }) => {
        if (response.success) {
            if (response.hostSecret) {
                sessionStorage.setItem(`host_secret_${newRoomId}`, response.hostSecret);
            }
            router.push(`/room/${newRoomId}`);
        } else {
            alert('Error creating room');
        }
        socket.disconnect();
    });
  };

  const joinRoom = () => {
    if (!roomId) return;
    router.push(`/room/${roomId.toUpperCase()}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-black text-white font-sans relative overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black z-0 pointer-events-none"></div>
      
      <div className="z-10 flex flex-col items-center w-full max-w-md">
        <h1 className={`text-6xl font-black mb-12 text-center text-transparent bg-clip-text ${
          gameMode === 'NEURAL_LINK' 
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-700 text-glow-emerald' 
            : 'bg-gradient-to-br from-purple-400 to-purple-700 text-glow-purple'
        } tracking-tighter`}>
          CÓDIGO<br/>SECRETO
        </h1>
        
        <div className={`glass-panel p-8 rounded-2xl w-full border border-white/5 ${
          gameMode === 'NEURAL_LINK' ? 'box-glow-emerald' : 'box-glow-purple'
        }`}>
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setGameMode('STANDARD')}
              className={`px-4 py-2 rounded-l-lg font-bold text-sm transition-all ${
                gameMode === 'STANDARD' ? 'bg-purple-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
              }`}
            >
              MODO CLÁSICO
            </button>
            <button
              onClick={() => setGameMode('NEURAL_LINK')}
              className={`px-4 py-2 rounded-r-lg font-bold text-sm transition-all ${
                gameMode === 'NEURAL_LINK' ? 'bg-emerald-600 text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
              }`}
            >
              ENLACE NEURAL
            </button>
          </div>
          
          {gameMode === 'NEURAL_LINK' && (
              <div className="flex justify-center gap-2 mb-6">
                  {[90, 180, 300].map(time => (
                      <button
                          key={time}
                          onClick={() => setMaxTime(time)}
                          className={`px-3 py-1 rounded-lg font-bold text-xs transition-all border ${
                              maxTime === time 
                              ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                              : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30'
                          }`}
                      >
                          {time === 90 ? '1:30 MIN' : time === 180 ? '3 MIN' : '5 MIN'}
                      </button>
                  ))}
              </div>
          )}

          <button 
            onClick={createRoom}
            className={`w-full py-4 text-white rounded-xl font-bold text-xl transition-all transform active:scale-95 tracking-widest border ${
              gameMode === 'NEURAL_LINK' 
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] border-emerald-400/30' 
                : 'bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] border-purple-400/30'
            }`}
          >
            CREAR SALA
          </button>
          
          <div className="relative flex py-8 items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-gray-500 font-mono text-xs">SISTEMA DE ACCESO</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <div className="flex flex-col gap-3">
            <label className={`text-xs font-bold uppercase tracking-widest ml-1 ${
              gameMode === 'NEURAL_LINK' ? 'text-emerald-400' : 'text-purple-400'
            }`}>Código de Acceso</label>
            <div className="flex flex-col gap-2">
              <input 
                type="text" 
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="XW9A"
                className={`w-full p-4 bg-black/50 border border-white/10 rounded-xl uppercase font-mono font-bold text-xl tracking-[0.2em] text-center outline-none text-white placeholder-gray-700 transition-all ${
                  gameMode === 'NEURAL_LINK'
                    ? 'focus:border-emerald-500 focus:shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'focus:border-purple-500 focus:shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                }`}
              />
              <button 
                onClick={joinRoom}
                className="w-full h-12 flex items-center justify-center bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 hover:border-white/30 hover:text-purple-200 transition-all text-lg tracking-widest"
              >
                ACCEDER
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
