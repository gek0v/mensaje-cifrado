import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { generateBoard, checkWinCondition, GameState } from "./lib/gameUtils";
import { randomBytes } from "crypto";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface ServerGameState extends GameState {
    hostSecret: string;
}

const rooms = new Map<string, ServerGameState>();

function sanitizeState(state: ServerGameState): GameState {
    const { hostSecret, ...publicState } = state;
    return publicState;
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("create_room", (roomId: string, callback) => {
        if (rooms.has(roomId)) {
            callback({ error: "Room already exists" });
            return;
        }
        const { board, startingTeam } = generateBoard();
        const redTotal = board.filter(c => c.type === 'RED').length;
        const blueTotal = board.filter(c => c.type === 'BLUE').length;
        const hostSecret = randomBytes(16).toString('hex');
        
        const initialState: ServerGameState = {
            roomId,
            board,
            turn: startingTeam,
            phase: 'CLUE',
            currentClueNumber: null,
            currentGuessesCount: 0,
            redScore: redTotal,
            blueScore: blueTotal,
            winner: null,
            log: [`Game started! Team ${startingTeam} starts.`],
            spymasters: { RED: [], BLUE: [] },
            hostSecret
        };
        rooms.set(roomId, initialState);
        socket.join(roomId);
        callback({ success: true, state: sanitizeState(initialState), hostSecret });
    });

    socket.on("join_room", ({ roomId, role, nickname }: { roomId: string, role: 'TABLE' | 'SPYMASTER_RED' | 'SPYMASTER_BLUE', nickname: string }, callback) => {
        const room = rooms.get(roomId);
        if (!room) {
            callback({ error: "Room not found" });
            return;
        }
        socket.join(roomId);

        const playerObj = { id: socket.id, name: nickname };

        if (role === 'SPYMASTER_RED') {
            room.spymasters.RED.push(playerObj);
        } else if (role === 'SPYMASTER_BLUE') {
            room.spymasters.BLUE.push(playerObj);
        }
        
        // Send current state
        callback({ success: true, state: sanitizeState(room) });
        
        // Notify others
        io.to(roomId).emit("notification", { nickname: nickname, role: role });
        io.to(roomId).emit("game_update", sanitizeState(room));
    });

    socket.on("give_clue", ({ roomId, number }: { roomId: string, number: number }) => {
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'CLUE') return;
        
        room.currentClueNumber = number;
        room.currentGuessesCount = 0;
        room.phase = 'GUESSING';
        room.log.push(`Clue given! Max words: ${number}`);
        
        io.to(roomId).emit("game_update", sanitizeState(room));
    });

    socket.on("end_turn", (roomId: string) => {
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'GUESSING') return;

        room.turn = room.turn === 'RED' ? 'BLUE' : 'RED';
        room.phase = 'CLUE';
        room.currentClueNumber = null;
        room.currentGuessesCount = 0;
        room.log.push(`Turn ended manually. Now it's ${room.turn}'s turn.`);

        io.to(roomId).emit("game_update", sanitizeState(room));
    });

    socket.on("flip_card", ({ roomId, cardId }: { roomId: string, cardId: number }) => {
        const room = rooms.get(roomId);
        if (!room || room.winner || room.phase !== 'GUESSING') return;

        const card = room.board.find(c => c.id === cardId);
        if (!card || card.revealed) return;

        // Reveal card
        card.revealed = true;
        room.log.push(`Card "${card.word}" revealed: ${card.type}`);

        // Recalculate scores (cards remaining)
        room.redScore = room.board.filter(c => c.type === 'RED' && !c.revealed).length;
        room.blueScore = room.board.filter(c => c.type === 'BLUE' && !c.revealed).length;

        let turnEnded = false;

        // Logic for turn handling
        if (card.type === 'ASSASSIN') {
            room.winner = room.turn === 'RED' ? 'BLUE' : 'RED';
            room.log.push(`ASSASSIN HIT! ${room.winner} WINS!`);
            turnEnded = true;
        } else if (card.type === 'NEUTRAL') {
            room.turn = room.turn === 'RED' ? 'BLUE' : 'RED';
            room.log.push(`Neutral card. Turn passes to ${room.turn}.`);
            turnEnded = true;
        } else if (card.type !== room.turn) {
             // Picked opponent's card
             room.turn = room.turn === 'RED' ? 'BLUE' : 'RED';
             room.log.push(`Opponent's card! Turn passes to ${room.turn}.`);
             
             // Check if opponent won by this
             const win = checkWinCondition(room);
             if (win) {
                 room.winner = win;
                 room.log.push(`${win} WINS!`);
             }
             turnEnded = true;
        } else {
            // Correct guess
             room.currentGuessesCount++;
             const win = checkWinCondition(room);
             if (win) {
                 room.winner = win;
                 room.log.push(`${win} WINS!`);
                 turnEnded = true; // Game over is effectively a turn end
             } else {
                 // Check limit (N rules) - User asked to be exactly N
                 // If currentClueNumber is > 0, limit is N.
                 // BUT user asked: "Once N words selected also change turn even if correct" -> Wait, "Una vez seleccionadas las N palabras también cambia de turno aunque hayas acertado todas"
                 // So if guesses == clueNumber, turn ends.
                 if (room.currentClueNumber && room.currentClueNumber > 0) {
                     if (room.currentGuessesCount >= room.currentClueNumber) {
                         room.turn = room.turn === 'RED' ? 'BLUE' : 'RED';
                         room.log.push(`Max guesses reached (${room.currentClueNumber}). Turn passes.`);
                         turnEnded = true;
                     }
                 }
             }
             // Turn continues if not won and limit not reached
        }

        if (turnEnded && !room.winner) {
            room.phase = 'CLUE';
            room.currentClueNumber = null;
            room.currentGuessesCount = 0;
        }

        // Broadcast update
        io.to(roomId).emit("game_update", sanitizeState(room));
    });
    
    socket.on("reset_game", ({ roomId, hostSecret }: { roomId: string, hostSecret: string }) => {
         const room = rooms.get(roomId);
         if(!room) return;
         
         if (room.hostSecret !== hostSecret) {
             // Unauthorized
             return;
         }
         
         const { board, startingTeam } = generateBoard();
         const redTotal = board.filter(c => c.type === 'RED').length;
         const blueTotal = board.filter(c => c.type === 'BLUE').length;

         room.board = board;
         room.turn = startingTeam;
         room.phase = 'CLUE';
         room.currentClueNumber = null;
         room.currentGuessesCount = 0;
         room.redScore = redTotal;
         room.blueScore = blueTotal;
         room.winner = null;
         room.log = [`Game reset. Team ${startingTeam} starts.`];
         
         io.to(roomId).emit("game_update", sanitizeState(room));
    });

    socket.on("disconnect", () => {
       // Remove player from rooms
       rooms.forEach((room, roomId) => {
           let updated = false;
           const redIdx = room.spymasters.RED.findIndex(p => p.id === socket.id);
           if (redIdx !== -1) {
               room.spymasters.RED.splice(redIdx, 1);
               updated = true;
           }
           const blueIdx = room.spymasters.BLUE.findIndex(p => p.id === socket.id);
           if (blueIdx !== -1) {
               room.spymasters.BLUE.splice(blueIdx, 1);
               updated = true;
           }
           
           if (updated) {
               io.to(roomId).emit("game_update", sanitizeState(room));
           }
       });
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
