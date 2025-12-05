import { z } from "zod";

export const createRoomSchema = z.object({
  roomId: z.string().min(1).max(20), // Adjusted max length as needed
  mode: z.enum(['STANDARD', 'NEURAL_LINK']),
  maxTime: z.number().min(60).max(600),
});

export const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(20),
  role: z.enum(['TABLE', 'SPYMASTER_RED', 'SPYMASTER_BLUE']),
  nickname: z.string().min(1).max(20),
  // sessionId is optional, checked if provided
});

export const giveClueSchema = z.object({
  roomId: z.string().min(1).max(20),
  number: z.number().int().min(-1).max(9), // -1 for infinity, 0-9 regular
});

export const flipCardSchema = z.object({
    roomId: z.string().min(1).max(20),
    cardId: z.number().int().nonnegative(),
});

export const changeMaxTimeSchema = z.object({
    roomId: z.string().min(1).max(20),
    maxTime: z.number().min(60).max(600),
});

export const resetGameSchema = z.object({
    roomId: z.string().min(1).max(20),
    hostSecret: z.string().min(1),
});
