"use client";

import { useState, useEffect } from 'react';
import { Card as CardType } from "@/lib/gameUtils";

interface CardProps {
  card: CardType;
  role: 'TABLE' | 'SPYMASTER_RED' | 'SPYMASTER_BLUE';
  onClick: () => void;
}

export default function Card({ card, role, onClick }: CardProps) {
  const [isShaking, setIsShaking] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false); // New state for explosion
  const isSpymaster = role.includes('SPYMASTER');
  const showColor = card.revealed || isSpymaster;
  
  useEffect(() => {
    if (card.type === 'ASSASSIN' && card.revealed) {
      setShowExplosion(true);
      // Hide explosion effect after a short duration
      const timer = setTimeout(() => setShowExplosion(false), 1000); // 1 second for the animation
      return () => clearTimeout(timer);
    }
  }, [card.type, card.revealed]);
  
  const handleCardClick = () => {
    if (!card.revealed && role === 'TABLE') {
      setIsShaking(true);
      // Wait for shake animation, then trigger actual click and reset shake
      setTimeout(() => {
        onClick();
        setIsShaking(false);
      }, 300); 
    }
  };

  // Base styles for Dark / Cyberpunk Theme
  let baseClass = "bg-[#111] border-gray-800 text-gray-300 shadow-sm"; // Default unrevealed state

  if (showColor) {
    switch (card.type) {
      case 'RED':
        baseClass = "bg-red-900/20 border-red-500 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.2)]"; // More compact initial glow
        if (card.revealed) baseClass = "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.7)] border-2 border-red-400";
        break;
      case 'BLUE':
        baseClass = "bg-blue-900/20 border-blue-500 text-blue-100 shadow-[0_0_10px_rgba(59,130,246,0.2)]"; // More compact initial glow
        if (card.revealed) baseClass = "bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.7)] border-2 border-blue-400";
        break;
      case 'NEUTRAL':
        baseClass = "bg-gray-800/50 border-gray-600 text-gray-400";
        if (card.revealed) baseClass = "bg-gray-800 text-gray-500 opacity-50 border-2 border-gray-600";
        break;
      case 'ASSASSIN':
        baseClass = "bg-fuchsia-950/30 border-fuchsia-500/50 text-fuchsia-200";
        if (card.revealed) baseClass = "bg-fuchsia-900 border-fuchsia-300 text-white shadow-[0_0_20px_rgba(232,121,249,0.9)] animate-pulse border-2";
        break;
    }
  } else {
      // Unrevealed for Table
      baseClass = "bg-[#161616] border-white/10 text-gray-200 hover:bg-[#1a1a1a] hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all duration-300";
  }

  // If spymaster sees unrevealed cards, they are semi-transparent or outlined
  if (isSpymaster && !card.revealed) {
      // We keep the colored border but transparent background
      switch (card.type) {
          case 'RED': baseClass = "bg-[#111] border-red-900/80 text-red-400"; break;
          case 'BLUE': baseClass = "bg-[#111] border-blue-900/80 text-blue-400"; break;
          case 'NEUTRAL': baseClass = "bg-[#0a0a0a] border-gray-800 text-gray-600 opacity-60"; break;
          case 'ASSASSIN': baseClass = "bg-black border-fuchsia-700/80 text-fuchsia-400"; break;
      }
  }
  
  const cursor = (!card.revealed && role === 'TABLE') ? "cursor-pointer active:scale-95" : "cursor-default";
  const revealedOpacity = (card.revealed && card.type === 'NEUTRAL') ? 'opacity-40' : 'opacity-100';

  return (
    <div 
      onClick={handleCardClick}
      className={`
        relative flex items-center justify-center 
        w-full h-full rounded-xl border
        ${baseClass} ${cursor} ${revealedOpacity} ${isShaking ? 'animate-shake' : ''}
        font-bold text-xs sm:text-sm md:text-lg select-none overflow-hidden
        transition-all duration-200
      `}
    >
      <span className="uppercase text-center px-1 leading-tight z-10 tracking-wider">
        {card.word}
      </span>
      
      {/* Decoration for unrevealed cards to look "techy" */}
      {!showColor && (
          <>
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 rounded-tl-md"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 rounded-br-md"></div>
          </>
      )}

      {/* Assassin Marker for Spymaster */}
      {isSpymaster && !card.revealed && card.type === 'ASSASSIN' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
              <span className="text-6xl">☠</span>
          </div>
      )}

      {/* Assassin Explosion Effect */}
      {showExplosion && card.type === 'ASSASSIN' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-full h-full bg-radial-gradient-fuchsia opacity-0 animate-assassin-explode"></div>
        </div>
      )}
    </div>
  );
}