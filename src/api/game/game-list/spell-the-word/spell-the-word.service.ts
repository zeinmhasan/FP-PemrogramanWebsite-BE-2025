import { type Prisma, type ROLE } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { ErrorResponse, prisma } from '@/common';
import { FileManager } from '@/utils';

import {
  type ICheckSpellingAnswer,
  type ICreateSpellTheWord,
  type ISubmitScore,
  type IUpdateSpellTheWord,
} from './schema';

// Interface for the game JSON structure
interface ISpellTheWordJson {
  score_per_word: number;
  time_limit: number;
  words: {
    word_text: string;
    word_image: string | null;
    word_audio: string | null;
    hint: string | null;
  }[];
}

// Shuffle array helper function
const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];

  for (let index = newArray.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [newArray[index], newArray[randomIndex]] = [
      newArray[randomIndex],
      newArray[index],
    ];
  }

  return newArray;
};

export abstract class SpellTheWordService {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static SPELL_THE_WORD_SLUG = 'spell-the-word';

  static async createSpellTheWord(data: ICreateSpellTheWord, user_id: string) {
    await this.existGameCheck(data.name);

    const newGameId = v4();
    const gameTemplateId = await this.getGameTemplateId();

    let wordWithImageAmount = 0;
    let wordWithAudioAmount = 0;

    for (const word of data.words) {
      if (typeof word.word_image_array_index === 'number')
        wordWithImageAmount++;
      if (typeof word.word_audio_array_index === 'number')
        wordWithAudioAmount++;

      // Validate word only contains letters
      if (!/^[A-Za-z]+$/.test(word.word_text.trim())) {
        throw new ErrorResponse(
          StatusCodes.BAD_REQUEST,
          `Word "${word.word_text}" should only contain letters`,
        );
      }
    }

    // Each word must have an image
    if (wordWithImageAmount !== data.words.length) {
      throw new ErrorResponse(
        StatusCodes.BAD_REQUEST,
        'Each word must have an image',
      );
    }

    if (
      data.files_to_upload &&
      wordWithImageAmount !== data.files_to_upload.length
    ) {
      throw new ErrorResponse(
        StatusCodes.BAD_REQUEST,
        'All uploaded image files must be used',
      );
    }

    if (data.audio_files && wordWithAudioAmount !== data.audio_files.length) {
      throw new ErrorResponse(
        StatusCodes.BAD_REQUEST,
        'All uploaded audio files must be used',
      );
    }

    const thumbnailImagePath = await FileManager.upload(
      `game/spell-the-word/${newGameId}`,
      data.thumbnail_image,
    );

    // Upload image files
    const imageArray: string[] = [];

    if (data.files_to_upload) {
      for (const image of data.files_to_upload) {
        const newImagePath = await FileManager.upload(
          `game/spell-the-word/${newGameId}`,
          image,
        );
        imageArray.push(newImagePath);
      }
    }

    // Upload audio files
    const audioArray: string[] = [];

    if (data.audio_files) {
      for (const audio of data.audio_files) {
        const newAudioPath = await FileManager.upload(
          `game/spell-the-word/${newGameId}`,
          audio,
        );
        audioArray.push(newAudioPath);
      }
    }

    const gameJson: ISpellTheWordJson = {
      score_per_word: data.score_per_word,
      time_limit: data.time_limit,
      words: data.words.map(word => ({
        word_text: word.word_text.toLowerCase().trim(),
        word_image:
          typeof word.word_image_array_index === 'number'
            ? imageArray[word.word_image_array_index]
            : null,
        word_audio:
          typeof word.word_audio_array_index === 'number'
            ? audioArray[word.word_audio_array_index]
            : null,
        hint: word.hint || null,
      })),
    };

    const newGame = await prisma.games.create({
      data: {
        id: newGameId,
        game_template_id: gameTemplateId,
        creator_id: user_id,
        name: data.name,
        description: data.description,
        thumbnail_image: thumbnailImagePath,
        is_published: data.is_publish_immediately,
        game_json: gameJson as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    return newGame;
  }

  static async getGameDetail(
    game_id: string,
    user_id: string,
    user_role: ROLE,
  ) {
    const game = await prisma.games.findUnique({
      where: { id: game_id },
      select: {
        id: true,
        name: true,
        description: true,
        thumbnail_image: true,
        is_published: true,
        created_at: true,
        game_json: true,
        creator_id: true,
        total_played: true,
        game_template: {
          select: { slug: true },
        },
      },
    });

    if (!game || game.game_template.slug !== this.SPELL_THE_WORD_SLUG)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game not found');

    if (user_role !== 'SUPER_ADMIN' && game.creator_id !== user_id)
      throw new ErrorResponse(
        StatusCodes.FORBIDDEN,
        'User cannot access this game',
      );

    return {
      ...game,
      creator_id: undefined,
      game_template: undefined,
    };
  }

  static async updateSpellTheWord(
    data: IUpdateSpellTheWord,
    game_id: string,
    user_id: string,
    user_role: ROLE,
  ) {
    const game = await prisma.games.findUnique({
      where: { id: game_id },
      select: {
        id: true,
        name: true,
        description: true,
        thumbnail_image: true,
        is_published: true,
        game_json: true,
        creator_id: true,
        game_template: {
          select: { slug: true },
        },
      },
    });

    if (!game || game.game_template.slug !== this.SPELL_THE_WORD_SLUG)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game not found');

    if (user_role !== 'SUPER_ADMIN' && game.creator_id !== user_id)
      throw new ErrorResponse(
        StatusCodes.FORBIDDEN,
        'User cannot access this game',
      );

    if (data.name) {
      const isNameExist = await prisma.games.findUnique({
        where: { name: data.name },
        select: { id: true },
      });

      if (isNameExist && isNameExist.id !== game_id)
        throw new ErrorResponse(
          StatusCodes.BAD_REQUEST,
          'Game name is already used',
        );
    }

    const oldGameJson = game.game_json as ISpellTheWordJson | null;
    const oldFilePaths: string[] = [];

    if (oldGameJson?.words) {
      for (const word of oldGameJson.words) {
        if (word.word_image) oldFilePaths.push(word.word_image);
        if (word.word_audio) oldFilePaths.push(word.word_audio);
      }
    }

    if (game.thumbnail_image) {
      oldFilePaths.push(game.thumbnail_image);
    }

    let wordWithNewImageAmount = 0;
    let wordWithNewAudioAmount = 0;

    if (data.words) {
      for (const word of data.words) {
        if (typeof word.word_image_array_index === 'number')
          wordWithNewImageAmount++;
        if (typeof word.word_audio_array_index === 'number')
          wordWithNewAudioAmount++;

        // Validate word only contains letters
        if (!/^[A-Za-z]+$/.test(word.word_text.trim())) {
          throw new ErrorResponse(
            StatusCodes.BAD_REQUEST,
            `Word "${word.word_text}" should only contain letters`,
          );
        }
      }
    }

    if (
      data.files_to_upload &&
      wordWithNewImageAmount !== data.files_to_upload.length
    )
      throw new ErrorResponse(
        StatusCodes.BAD_REQUEST,
        'All uploaded image files must be used',
      );

    if (data.audio_files && wordWithNewAudioAmount !== data.audio_files.length)
      throw new ErrorResponse(
        StatusCodes.BAD_REQUEST,
        'All uploaded audio files must be used',
      );

    let thumbnailImagePath = game.thumbnail_image;

    if (data.thumbnail_image) {
      thumbnailImagePath = await FileManager.upload(
        `game/spell-the-word/${game_id}`,
        data.thumbnail_image,
      );
    }

    // Upload new image files
    const imageArray: string[] = [];

    if (data.files_to_upload) {
      for (const image of data.files_to_upload) {
        const newImagePath = await FileManager.upload(
          `game/spell-the-word/${game_id}`,
          image,
        );
        imageArray.push(newImagePath);
      }
    }

    // Upload new audio files
    const audioArray: string[] = [];

    if (data.audio_files) {
      for (const audio of data.audio_files) {
        const newAudioPath = await FileManager.upload(
          `game/spell-the-word/${game_id}`,
          audio,
        );
        audioArray.push(newAudioPath);
      }
    }

    const gameJson: ISpellTheWordJson = {
      score_per_word: data.score_per_word ?? oldGameJson?.score_per_word ?? 100,
      time_limit: data.time_limit ?? oldGameJson?.time_limit ?? 30,
      words: data.words
        ? data.words.map(word => {
            let wordImage: string | null = null;
            let wordAudio: string | null = null;

            if (typeof word.word_image_array_index === 'number') {
              wordImage = imageArray[word.word_image_array_index];
            } else if (typeof word.word_image_array_index === 'string') {
              wordImage = word.word_image_array_index;
            }

            if (typeof word.word_audio_array_index === 'number') {
              wordAudio = audioArray[word.word_audio_array_index];
            } else if (typeof word.word_audio_array_index === 'string') {
              wordAudio = word.word_audio_array_index;
            }

            return {
              word_text: word.word_text.toLowerCase().trim(),
              word_image: wordImage,
              word_audio: wordAudio,
              hint: word.hint || null,
            };
          })
        : (oldGameJson?.words ?? []),
    };

    const updatedGame = await prisma.games.update({
      where: { id: game_id },
      data: {
        name: data.name,
        description: data.description,
        thumbnail_image: thumbnailImagePath,
        is_published: data.is_publish,
        game_json: gameJson as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    });

    // Remove old files that are no longer used
    const newFilePaths: string[] = [thumbnailImagePath];

    if (gameJson.words) {
      for (const word of gameJson.words) {
        if (word.word_image) newFilePaths.push(word.word_image);
        if (word.word_audio) newFilePaths.push(word.word_audio);
      }
    }

    for (const oldPath of oldFilePaths) {
      if (!newFilePaths.includes(oldPath)) {
        await FileManager.remove(oldPath);
      }
    }

    return updatedGame;
  }

  static async checkAnswer(data: ICheckSpellingAnswer, game_id: string) {
    const game = await prisma.games.findUnique({
      where: { id: game_id },
      select: {
        id: true,
        game_json: true,
        game_template: {
          select: { slug: true },
        },
      },
    });

    if (!game || game.game_template.slug !== this.SPELL_THE_WORD_SLUG)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game not found');

    const gameJson = game.game_json as unknown as ISpellTheWordJson;
    const results = [];
    let correctCount = 0;

    for (const answer of data.answers) {
      const wordIndex = answer.word_index;
      const userAnswer = answer.user_answer.toLowerCase().trim();

      if (wordIndex < 0 || wordIndex >= gameJson.words.length) {
        results.push({
          word_index: wordIndex,
          user_answer: userAnswer,
          is_correct: false,
          correct_answer: 'N/A',
          error: 'Word index out of range',
        });
        continue;
      }

      const word = gameJson.words[wordIndex];
      const isCorrect = userAnswer === word.word_text;
      if (isCorrect) correctCount++;

      results.push({
        word_index: wordIndex,
        user_answer: userAnswer,
        is_correct: isCorrect,
        correct_answer: word.word_text,
      });
    }

    const score = correctCount * gameJson.score_per_word;
    const maxScore = gameJson.words.length * gameJson.score_per_word;
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

    return {
      game_id,
      total_words: gameJson.words.length,
      correct_answers: correctCount,
      incorrect_answers: data.answers.length - correctCount,
      score,
      max_score: maxScore,
      percentage: Math.round(percentage * 100) / 100,
      results,
    };
  }

  static async getGamePlay(
    game_id: string,
    is_public: boolean,
    user_id?: string,
    user_role?: ROLE,
  ) {
    const game = await prisma.games.findUnique({
      where: { id: game_id },
      select: {
        id: true,
        name: true,
        description: true,
        thumbnail_image: true,
        is_published: true,
        game_json: true,
        creator_id: true,
        game_template: {
          select: { slug: true },
        },
      },
    });

    if (
      !game ||
      (is_public && !game.is_published) ||
      game.game_template.slug !== this.SPELL_THE_WORD_SLUG
    )
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game not found');

    if (
      !is_public &&
      user_role !== 'SUPER_ADMIN' &&
      game.creator_id !== user_id
    )
      throw new ErrorResponse(
        StatusCodes.FORBIDDEN,
        'User cannot get this game data',
      );

    const gameJson = game.game_json as unknown as ISpellTheWordJson | null;

    if (!gameJson)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game data not found');

    const wordsWithIndex = (gameJson.words ?? []).map((w, word_index) => ({
      word_index,
      word_image: w.word_image ?? null,
      word_audio: w.word_audio ?? null,
      hint: w.hint ?? null,
      letter_count: w.word_text.length,
      shuffled_letters: shuffleArray([...w.word_text]),
    }));

    return {
      id: game.id,
      name: game.name,
      description: game.description,
      thumbnail_image: game.thumbnail_image,
      score_per_word: gameJson.score_per_word,
      time_limit: gameJson.time_limit,
      words: wordsWithIndex,
      is_published: game.is_published,
    };
  }

  static async deleteGame(game_id: string, user_id: string, user_role: ROLE) {
    const game = await prisma.games.findUnique({
      where: { id: game_id },
      select: {
        id: true,
        thumbnail_image: true,
        game_json: true,
        creator_id: true,
        game_template: {
          select: { slug: true },
        },
      },
    });

    if (!game || game.game_template.slug !== this.SPELL_THE_WORD_SLUG)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game not found');

    if (user_role !== 'SUPER_ADMIN' && game.creator_id !== user_id)
      throw new ErrorResponse(
        StatusCodes.FORBIDDEN,
        'User cannot delete this game',
      );

    const oldGameJson = game.game_json as ISpellTheWordJson | null;
    const oldFilePaths: string[] = [];

    if (oldGameJson?.words) {
      for (const word of oldGameJson.words) {
        if (word.word_image) oldFilePaths.push(word.word_image);
        if (word.word_audio) oldFilePaths.push(word.word_audio);
      }
    }

    if (game.thumbnail_image) oldFilePaths.push(game.thumbnail_image);

    for (const path of oldFilePaths) {
      await FileManager.remove(path);
    }

    await prisma.games.delete({ where: { id: game_id } });

    return { id: game_id };
  }

  private static async existGameCheck(game_name?: string, game_id?: string) {
    const where: Record<string, unknown> = {};
    if (game_name) where.name = game_name;
    if (game_id) where.id = game_id;

    if (Object.keys(where).length === 0) return null;

    const game = await prisma.games.findFirst({
      where,
      select: { id: true, creator_id: true },
    });

    if (game)
      throw new ErrorResponse(
        StatusCodes.BAD_REQUEST,
        'Game name is already exist',
      );

    return game;
  }

  private static async getGameTemplateId() {
    const result = await prisma.gameTemplates.findUnique({
      where: { slug: this.SPELL_THE_WORD_SLUG },
      select: { id: true },
    });

    if (!result)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game template not found');

    return result.id;
  }

  static async submitScore(
    data: ISubmitScore,
    game_id: string,
    user_id?: string,
  ) {
    // Verify game exists
    const game = await prisma.games.findUnique({
      where: { id: game_id },
      select: {
        id: true,
        game_template: { select: { slug: true } },
      },
    });

    if (!game || game.game_template.slug !== this.SPELL_THE_WORD_SLUG)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game not found');

    // Check if user already has a score for this game
    const existingScore = await prisma.leaderboards.findUnique({
      where: {
        game_id_user_id: {
          game_id,
          user_id: (user_id || null) as string,
        },
      },
    });

    // If existing score is better or equal, don't update
    if (existingScore && existingScore.score >= data.score) {
      return {
        id: existingScore.id,
        updated: false,
        message: 'Existing score is better',
      };
    }

    // Upsert the score (create or update)
    const leaderboardEntry = await prisma.leaderboards.upsert({
      where: {
        game_id_user_id: {
          game_id,
          user_id: (user_id || null) as string,
        },
      },
      create: {
        game_id,
        user_id: user_id || null,
        player_name: data.player_name,
        score: data.score,
        max_score: data.max_score,
        time_taken: data.time_taken,
        accuracy: data.accuracy,
      },
      update: {
        player_name: data.player_name,
        score: data.score,
        max_score: data.max_score,
        time_taken: data.time_taken,
        accuracy: data.accuracy,
      },
      select: {
        id: true,
      },
    });

    return {
      id: leaderboardEntry.id,
      updated: true,
      message: 'Score submitted successfully',
    };
  }

  static async getLeaderboard(game_id: string, limit = 10) {
    // Verify game exists
    const game = await prisma.games.findUnique({
      where: { id: game_id },
      select: {
        id: true,
        game_template: { select: { slug: true } },
      },
    });

    if (!game || game.game_template.slug !== this.SPELL_THE_WORD_SLUG)
      throw new ErrorResponse(StatusCodes.NOT_FOUND, 'Game not found');

    const leaderboard = await prisma.leaderboards.findMany({
      where: { game_id },
      orderBy: [{ score: 'desc' }, { time_taken: 'asc' }],
      take: limit,
      select: {
        id: true,
        player_name: true,
        score: true,
        max_score: true,
        time_taken: true,
        accuracy: true,
        created_at: true,
        user: {
          select: {
            id: true,
            username: true,
            profile_picture: true,
          },
        },
      },
    });

    return leaderboard;
  }
}
