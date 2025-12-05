import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { generateBoard, checkWinCondition, GameState } from "./lib/gameUtils";
import { randomBytes } from "crypto";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { createRoomSchema, joinRoomSchema, giveClueSchema, flipCardSchema, changeMaxTimeSchema, resetGameSchema } from "./lib/validators";

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

const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 points
  duration: 1, // per second
});

// Helper to check rate limit
async function checkRateLimit(socket: any) {
    try {
        await rateLimiter.consume(socket.id);
        return true;
    } catch (rejRes) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        // socket.disconnect(true); // Optional: disconnected aggressively
        return false;
    }
}

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
                room.winner = 'RED'; // System (RED) wins in Neural Link (Player is BLUE)
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

    socket.on("create_room", async (roomId: string, mode: 'STANDARD' | 'NEURAL_LINK' = 'STANDARD', maxTime: number = 180, callback) => {
        if (!(await checkRateLimit(socket))) return;
        
        const validation = createRoomSchema.safeParse({ roomId, mode, maxTime });
        if (!validation.success) {
            if(callback) callback({ error: "Invalid data", details: validation.error.format() });
            return;
        }

        if (rooms.has(roomId)) {
            if(callback) callback({ error: "Room already exists" });
            return;
        }
        const { board, startingTeam } = generateBoard(mode);
        const redTotal = board.filter(c => c.type === 'RED').length;
        const blueTotal = board.filter(c => c.type === 'BLUE').length;
        const hostSecret = randomBytes(16).toString('hex');
        
        const selectedMaxTime = mode === 'NEURAL_LINK' ? maxTime : 0;

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
            hostSecret,
            gameMode: mode,
            timer: selectedMaxTime,
            timerActive: false,
            maxTime: selectedMaxTime,
        };
        
        // Force BLUE start for Neural Link (Player is BLUE)
        if (mode === 'NEURAL_LINK') {
            initialState.turn = 'BLUE'; 
        }

        rooms.set(roomId, initialState);
        socket.join(roomId);
        callback({ success: true, state: sanitizeState(initialState), hostSecret });
    });

    socket.on("join_room", async ({ roomId, role, nickname }: { roomId: string, role: 'TABLE' | 'SPYMASTER_RED' | 'SPYMASTER_BLUE', nickname: string }, callback) => {
        if (!(await checkRateLimit(socket))) return;

        const validation = joinRoomSchema.safeParse({ roomId, role, nickname });
        if (!validation.success) {
             if(callback) callback({ error: "Invalid data", details: validation.error.format() });
             return;
        }

        const room = rooms.get(roomId);
        if (!room) {
            callback({ error: "Room not found" });
            return;
        }
        socket.join(roomId);

        // Remove from existing roles first to prevent duplicates
        const redIdx = room.spymasters.RED.findIndex(p => p.id === socket.id);
        if (redIdx !== -1) room.spymasters.RED.splice(redIdx, 1);
        const blueIdx = room.spymasters.BLUE.findIndex(p => p.id === socket.id);
        if (blueIdx !== -1) room.spymasters.BLUE.splice(blueIdx, 1);

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

    socket.on("give_clue", async ({ roomId, number }: { roomId: string, number: number }) => {
        if (!(await checkRateLimit(socket))) return;

        const validation = giveClueSchema.safeParse({ roomId, number });
        if (!validation.success) return;

        const room = rooms.get(roomId);
        if (!room || room.phase !== 'CLUE') return;
        
        room.currentClueNumber = number;
        room.currentGuessesCount = 0;
        room.phase = 'GUESSING';
        
        // Start timer in Neural Link if not active
        if (room.gameMode === 'NEURAL_LINK') {
             if (!room.timerActive) {
                room.timerActive = true;
                room.log.push("NEURAL LINK ESTABLISHED. TIMER STARTED.");
             } else {
                 room.log.push("DATA STREAM RESUMED.");
             }
        } else {
             room.log.push(`Clue given! Max words: ${number}`);
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

    socket.on("flip_card", async ({ roomId, cardId }: { roomId: string, cardId: number }) => {
        if (!(await checkRateLimit(socket))) return;

        const validation = flipCardSchema.safeParse({ roomId, cardId });
        if (!validation.success) return;

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
            // In Neural Link, Player is BLUE. If hit assassin, System (RED) wins.
            room.winner = room.gameMode === 'NEURAL_LINK' ? 'RED' : (room.turn === 'RED' ? 'BLUE' : 'RED');
            room.timerActive = false;
            room.log.push(`ASSASSIN HIT! SYSTEM FAILURE!`);
            turnEnded = true;
        } else if (room.gameMode === 'NEURAL_LINK') {
            // Neural Link Logic (Player is BLUE)
            // Correct guess (Blue card)
            room.currentGuessesCount++;
            const win = checkWinCondition(room);
            if (win) {
                room.winner = win;
                room.timerActive = false;
                room.log.push(`${win} WINS! NEURAL LINK SECURE.`);
                turnEnded = true;
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
    
    socket.on("reset_game", async ({ roomId, hostSecret }: { roomId: string, hostSecret: string }) => {
         if (!(await checkRateLimit(socket))) return;

         const validation = resetGameSchema.safeParse({ roomId, hostSecret });
         if (!validation.success) return;

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
         
         if (room.gameMode === 'NEURAL_LINK') {
             room.turn = 'BLUE'; // Force Blue start on reset too
             room.timer = room.maxTime || 180; // Reset timer
             room.timerActive = false;
         }
         
         io.to(roomId).emit("game_update", sanitizeState(room));
    });

    socket.on("change_max_time", async ({ roomId, maxTime }: { roomId: string, maxTime: number }) => {
        if (!(await checkRateLimit(socket))) return;

        const validation = changeMaxTimeSchema.safeParse({ roomId, maxTime });
        if (!validation.success) return;

        const room = rooms.get(roomId);
        if (!room || room.gameMode !== 'NEURAL_LINK') return;
        
        // Prevent changing time if game is active
        if (room.timerActive) {
            // room.log.push("SECURITY ALERT: Cannot reconfigure clock during active link!");
            // Actually, just ignore it or send error? 
            // Let's log it so users know why it failed.
             room.log.push("ERROR: Cannot change time while active.");
             io.to(roomId).emit("game_update", sanitizeState(room));
             return;
        }
        
        // Update time settings
        room.maxTime = maxTime;
        room.timer = maxTime;
        room.timerActive = false; // Pause timer on change to let them get ready
        room.log.push(`System clock reconfigured to ${maxTime}s.`);
        
        io.to(roomId).emit("game_update", sanitizeState(room));
    });

    socket.on("leave_role", ({ roomId }: { roomId: string }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        
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

    socket.on("leave_room", ({ roomId }: { roomId: string }) => {
        const room = rooms.get(roomId);
        if (!room) return;
        
        socket.leave(roomId);
        
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
