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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hostSecret: _hostSecret, ...publicState } = state;
    return publicState;
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);

  // Global Timer Loop
  setInterval(() => {
    rooms.forEach((room, roomId) => {
        if (room.gameMode === 'NEURAL_LINK' && room.timerActive && !room.winner) {
            room.timer -= 1;
            
            if (room.timer <= 0) {
                room.timer = 0;
                room.timerActive = false;
                room.winner = 'BLUE'; // System wins (Blue represents System/Time in this mode context usually, or just 'BLUE' as enemy)
                room.log.push("TIME OVER! SYSTEM WINS!");
                io.to(roomId).emit("game_update", sanitizeState(room));
            } else {
                // Optimize: Only emit time every second might be too much traffic if many rooms. 
                // But for now it's fine. Ideally emit only on significant changes or let client interpolate.
                // We will emit full state for simplicity to keep clients in sync.
                // To reduce bandwidth, we could emit a specific 'timer_tick' event.
                 io.to(roomId).emit("timer_update", room.timer);
            }
        }
    });
  }, 1000);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("create_room", (roomId: string, mode: 'STANDARD' | 'NEURAL_LINK' = 'STANDARD', callback) => {
        if (rooms.has(roomId)) {
            callback({ error: "Room already exists" });
            return;
        }
        const { board, startingTeam } = generateBoard();
        const redTotal = board.filter(c => c.type === 'RED').length;
        const blueTotal = board.filter(c => c.type === 'BLUE').length;
        const hostSecret = randomBytes(16).toString('hex');
        
        const defaultMaxTime = 180; // 3 minutes for Neural Link mode

        const initialState: ServerGameState = {
            roomId,
            board,
            turn: startingTeam, // In Neural Link, usually Red starts, but let's keep random for now or force RED? Let's force RED for Neural Link usually.
            phase: 'CLUE',
            currentClueNumber: null,
            currentGuessesCount: 0,
            redScore: redTotal,
            blueScore: blueTotal,
            winner: null,
            log: [`Game started! Team ${startingTeam} starts.`],
            spymasters: { RED: [], BLUE: [] },
            hostSecret,
            gameMode: mode,
            timer: mode === 'NEURAL_LINK' ? defaultMaxTime : 0,
            timerActive: false,
            maxTime: defaultMaxTime,
        };
        
        // Force RED start for Neural Link single player feel
        if (mode === 'NEURAL_LINK') {
            initialState.turn = 'RED'; 
        }

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

    socket.on("get_room_state", (roomId: string, callback) => {
        const room = rooms.get(roomId);
        if (!room) {
            callback({ error: "Room not found" });
            return;
        }
        callback({ success: true, state: sanitizeState(room) });
    });

    socket.on("give_clue", ({ roomId, number }: { roomId: string, number: number }) => {
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'CLUE') return;
        
        room.currentClueNumber = number;
        room.currentGuessesCount = 0;
        room.phase = 'GUESSING';
        room.log.push(`Clue given! Max words: ${number}`);
        
        // Start timer in Neural Link if not active
        if (room.gameMode === 'NEURAL_LINK' && !room.timerActive) {
            room.timerActive = true;
            room.log.push("NEURAL LINK ESTABLISHED. TIMER STARTED.");
        }
        
        io.to(roomId).emit("game_update", sanitizeState(room));
    });

    socket.on("end_turn", (roomId: string) => {
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'GUESSING') return;

        // In Neural Link, "End Turn" might just mean "Stop Guessing" but turn stays with RED? 
        // Or maybe it passes to "System"? 
        // For Speedrun mode described: "No hay turnos rivales". 
        // So End Turn just goes back to Giving Clue phase.
        
        if (room.gameMode === 'NEURAL_LINK') {
            room.phase = 'CLUE';
            room.currentClueNumber = null;
            room.currentGuessesCount = 0;
            room.log.push(`Transmission ended. New clue required.`);
        } else {
            room.turn = room.turn === 'RED' ? 'BLUE' : 'RED';
            room.phase = 'CLUE';
            room.currentClueNumber = null;
            room.currentGuessesCount = 0;
            room.log.push(`Turn ended manually. Now it's ${room.turn}'s turn.`);
        }

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
            room.winner = room.turn === 'RED' ? 'BLUE' : 'RED'; // In Neural Link, if RED hits assassin, BLUE (System) wins.
            room.timerActive = false;
            room.log.push(`ASSASSIN HIT! SYSTEM FAILURE!`);
            turnEnded = true;
        } else if (room.gameMode === 'NEURAL_LINK') {
            // Neural Link Logic
            if (card.type === 'NEUTRAL') {
                const penalty = 30;
                room.timer = Math.max(0, room.timer - penalty);
                room.log.push(`Neutral noise encountered. Time penalty: -${penalty}s`);
                // Do NOT end turn, just penalize
            } else if (card.type !== room.turn) { // Opponent (Blue) in Neural Link
                 const penalty = 60;
                 room.timer = Math.max(0, room.timer - penalty);
                 room.log.push(`Enemy firewall hit! Time penalty: -${penalty}s`);
                 // Do NOT end turn, just penalize
            } else {
                // Correct guess
                room.currentGuessesCount++;
                const win = checkWinCondition(room);
                if (win) {
                    room.winner = win;
                    room.timerActive = false;
                    room.log.push(`${win} WINS! NEURAL LINK SECURE.`);
                    turnEnded = true;
                }
                // No limit check enforced in speedrun usually, but we can keep the N+1 rule if desired.
                // For now, let's allow infinite guesses until time runs out or user stops.
            }
        } else {
            // Standard Logic
            if (card.type === 'NEUTRAL') {
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
                    if (room.currentClueNumber && room.currentClueNumber > 0) {
                        if (room.currentGuessesCount >= room.currentClueNumber) {
                            room.turn = room.turn === 'RED' ? 'BLUE' : 'RED';
                            room.log.push(`Max guesses reached (${room.currentClueNumber}). Turn passes.`);
                            turnEnded = true;
                        }
                    }
                }
            }
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
