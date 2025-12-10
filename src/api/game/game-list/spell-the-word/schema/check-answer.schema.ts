import z from 'zod';

// Schema for checking spelling answers
export const CheckSpellingAnswerSchema = z.object({
  answers: z
    .array(
      z.object({
        word_index: z.number().int().min(0),
        user_answer: z.string().max(64).trim(),
      }),
    )
    .min(1),
});

export type ICheckSpellingAnswer = z.infer<typeof CheckSpellingAnswerSchema>;
