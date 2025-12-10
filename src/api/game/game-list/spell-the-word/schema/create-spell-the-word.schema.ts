import z from 'zod';

import {
  fileArraySchema,
  fileSchema,
  StringToBooleanSchema,
  StringToObjectSchema,
} from '@/common';

// Schema for each word item
export const SpellWordItemSchema = z.object({
  word_text: z.string().max(64).trim(),
  word_image_array_index: z.coerce.number().min(0).max(50).optional(), // Index to files_to_upload array
  word_audio_array_index: z.coerce.number().min(0).max(50).optional(), // Index to audio_files array (optional)
  hint: z.string().max(256).trim().optional(),
});

export const CreateSpellTheWordSchema = z.object({
  name: z.string().max(128).trim(),
  description: z.string().max(256).trim().optional(),
  thumbnail_image: fileSchema({}),
  is_publish_immediately: StringToBooleanSchema.default(false),
  score_per_word: z.coerce.number().min(1).max(1000).default(100),
  time_limit: z.coerce.number().min(10).max(300).default(30),
  // Image files for words (required)
  files_to_upload: fileArraySchema({
    max_size: 2 * 1024 * 1024,
    min_amount: 1,
    max_amount: 50,
  }),
  // Audio files for words (optional)
  audio_files: fileArraySchema({
    max_size: 5 * 1024 * 1024,
    min_amount: 0,
    max_amount: 50,
  }).optional(),
  words: StringToObjectSchema(z.array(SpellWordItemSchema).min(1).max(50)),
});

export type ICreateSpellTheWord = z.infer<typeof CreateSpellTheWordSchema>;
