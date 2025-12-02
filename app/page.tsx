"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const createRoom = () => {
    const socket = io(); // Connect to same host
    // We just need to signal creation, but usually we can just generate an ID and go there.
    // My server implementation for 'create_room' takes a roomId. 
    // So I can generate a random ID client side or ask server.
    // Let's generate a simple random 4-letter code.
    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    socket.emit('create_room', newRoomId, (response: any) => {
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
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100 text-gray-900 font-sans">
      <h1 className="text-5xl font-bold mb-8 text-blue-600">CÓDIGO SECRETO</h1>
      
      <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col gap-6 w-full max-w-md">
        <button 
          onClick={createRoom}
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-xl hover:bg-blue-700 transition"
        >
          CREAR NUEVA SALA
        </button>
        
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-400">O</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-gray-600">Unirse a sala existente:</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="CÓDIGO"
              className="flex-1 p-3 border-2 border-gray-300 rounded-lg uppercase font-bold tracking-widest text-center focus:border-blue-500 outline-none"
            />
            <button 
              onClick={joinRoom}
              className="px-6 py-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900"
            >
              ENTRAR
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}