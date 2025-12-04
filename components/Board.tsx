"use client";

import { Card as CardType } from "@/lib/gameUtils";
import Card from "./Card";

interface BoardProps {
  board: CardType[];
  role: 'TABLE' | 'SPYMASTER_RED' | 'SPYMASTER_BLUE';
  onCardClick: (id: number) => void;
}

export default function Board({ board, role, onCardClick }: BoardProps) {
  return (
    <div className="flex-1 w-full grid grid-cols-5 grid-rows-5 gap-2 p-2 min-h-0">
      {board.map((card) => (
        <Card 
          key={card.id} 
          card={card} 
          role={role} 
          onClick={() => onCardClick(card.id)} 
        />
      ))}
    </div>
  );
}
