import { words } from './words';

export type CardType = 'RED' | 'BLUE' | 'NEUTRAL' | 'ASSASSIN';

export interface Card {
  id: number;
  word: string;
  type: CardType;
  revealed: boolean;
}

export interface GameState {
  roomId: string;
  board: Card[];
  turn: 'RED' | 'BLUE';
  phase: 'CLUE' | 'GUESSING';
  currentClueNumber: number | null;
  redScore: number;
  blueScore: number;
  winner: 'RED' | 'BLUE' | null;
  log: string[];
  spymasters: {
    RED: string[]; // socket ids
    BLUE: string[]; // socket ids
  };
}

export const TOTAL_CARDS = 25;

export function generateBoard(): { board: Card[], startingTeam: 'RED' | 'BLUE' } {
  // Select 25 random words
  const shuffledWords = [...words].sort(() => 0.5 - Math.random()).slice(0, TOTAL_CARDS);
  
  // Determine starting team (9 cards for start, 8 for second)
  const startingTeam = Math.random() < 0.5 ? 'RED' : 'BLUE';
  const secondTeam = startingTeam === 'RED' ? 'BLUE' : 'RED';
  
  const cardTypes: CardType[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(secondTeam),
    ...Array(7).fill('NEUTRAL'),
    'ASSASSIN'
  ];
  
  // Shuffle types
  const shuffledTypes = cardTypes.sort(() => 0.5 - Math.random());
  
  const board: Card[] = shuffledWords.map((word, index) => ({
    id: index,
    word,
    type: shuffledTypes[index],
    revealed: false,
  }));
  
  return { board, startingTeam };
}

export function checkWinCondition(gameState: GameState): 'RED' | 'BLUE' | null {
  const { board } = gameState;
  
  // Check if Assassin revealed
  const assassin = board.find(c => c.type === 'ASSASSIN');
  if (assassin?.revealed) {
    // If assassin revealed, the current turn team LOSES, so the other wins.
    // However, usually the game logic handles this immediately upon reveal.
    // Let's assume this function is called after a move.
    return gameState.turn === 'RED' ? 'BLUE' : 'RED';
  }
  
  // Check if all team cards revealed
  const redCards = board.filter(c => c.type === 'RED');
  const blueCards = board.filter(c => c.type === 'BLUE');
  
  const redWin = redCards.every(c => c.revealed);
  const blueWin = blueCards.every(c => c.revealed);
  
  if (redWin) return 'RED';
  if (blueWin) return 'BLUE';
  
  return null;
}
