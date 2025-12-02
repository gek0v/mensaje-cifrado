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
    <div className="grid grid-cols-5 gap-2 sm:gap-4 p-4 max-w-5xl mx-auto w-full">
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
