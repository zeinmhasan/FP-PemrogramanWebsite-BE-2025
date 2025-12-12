import { z } from 'zod';

export const SubmitScoreSchema = z.object({
  player_name: z.string().min(1, 'Player name is required').max(50),
  score: z.number().int().min(0),
  max_score: z.number().int().min(0),
  time_taken: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
});

export type ISubmitScore = z.infer<typeof SubmitScoreSchema>;
