import z from 'zod';

import {
  fileArraySchema,
  fileSchema,
  StringToBooleanSchema,
  StringToObjectSchema,
} from '@/common';

// Schema for each word item (update - can optionally provide existing file path)
export const UpdateSpellWordItemSchema = z.object({
  word_text: z.string().max(64).trim(),
  word_image_array_index: z
    .union([
      z.coerce.number().min(0).max(50),
      z.string(), // Can be existing file path
    ])
    .optional(),
  word_audio_array_index: z
    .union([
      z.coerce.number().min(0).max(50),
      z.string(), // Can be existing file path
    ])
    .optional(),
  hint: z.string().max(256).trim().optional(),
});

export const UpdateSpellTheWordSchema = z.object({
  name: z.string().max(128).trim().optional(),
  description: z.string().max(256).trim().optional(),
  thumbnail_image: fileSchema({}).optional(),
  is_publish: StringToBooleanSchema.optional(),
  score_per_word: z.coerce.number().min(1).max(1000).optional(),
  time_limit: z.coerce.number().min(10).max(300).optional(),
  // Image files for words
  files_to_upload: fileArraySchema({
    max_size: 2 * 1024 * 1024,
    min_amount: 0,
    max_amount: 50,
  }).optional(),
  // Audio files for words
  audio_files: fileArraySchema({
    max_size: 5 * 1024 * 1024,
    min_amount: 0,
    max_amount: 50,
  }).optional(),
  words: StringToObjectSchema(
    z.array(UpdateSpellWordItemSchema).min(1).max(50),
  ).optional(),
});

export type IUpdateSpellTheWord = z.infer<typeof UpdateSpellTheWordSchema>;
