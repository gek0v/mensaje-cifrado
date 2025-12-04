"use client";

import { Card as CardType } from "@/lib/gameUtils";

interface CardProps {
  card: CardType;
  role: 'TABLE' | 'SPYMASTER_RED' | 'SPYMASTER_BLUE';
  onClick: () => void;
}

export default function Card({ card, role, onClick }: CardProps) {
  const isSpymaster = role.includes('SPYMASTER');
  const showColor = card.revealed || isSpymaster;
  
  // Base styles
  let bgColor = "bg-gray-200";
  let textColor = "text-gray-800";
  let borderColor = "border-gray-300";

  if (showColor) {
    switch (card.type) {
      case 'RED':
        bgColor = "bg-red-500";
        textColor = "text-white";
        borderColor = "border-red-600";
        break;
      case 'BLUE':
        bgColor = "bg-blue-500";
        textColor = "text-white";
        borderColor = "border-blue-600";
        break;
      case 'NEUTRAL':
        bgColor = "bg-amber-200";
        textColor = "text-amber-900";
        borderColor = "border-amber-300";
        break;
      case 'ASSASSIN':
        bgColor = "bg-gray-900";
        textColor = "text-white";
        borderColor = "border-black";
        break;
    }
  }

  // Spymaster view of unrevealed cards should be "tinted" or just clear but marked?
  // Usually Spymaster sees the full color map.
  // If it's revealed, we might want to mark it as "done" (e.g. opacity or an overlay).
  
  const opacity = card.revealed ? "opacity-50" : "opacity-100";
  const cursor = (!card.revealed && role === 'TABLE') ? "cursor-pointer hover:scale-105 transition-transform" : "cursor-default";

  return (
    <div 
      onClick={(!card.revealed && role === 'TABLE') ? onClick : undefined}
      className={`
        relative flex items-center justify-center 
        w-full h-full rounded-lg border-b-2 sm:border-b-4 
        ${bgColor} ${textColor} ${borderColor} ${opacity} ${cursor}
        shadow-md font-bold text-xs sm:text-sm md:text-lg lg:text-xl select-none overflow-hidden
      `}
    >
      <span className="uppercase text-center px-1 leading-tight z-10">
        {card.word}
      </span>
      
      {/* Optional: Icon for Spymaster to verify type if colorblind or just for clarity */}
      {isSpymaster && !card.revealed && (
          <div className="absolute top-1 right-1 text-[10px] opacity-50">
              {card.type[0]}
          </div>
      )}
    </div>
  );
}
