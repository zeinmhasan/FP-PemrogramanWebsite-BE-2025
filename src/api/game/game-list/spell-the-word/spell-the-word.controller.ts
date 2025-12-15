import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type AuthedRequest,
  SuccessResponse,
  validateAuth,
  validateBody,
} from '@/common';

import {
  CheckSpellingAnswerSchema,
  CreateSpellTheWordSchema,
  type ICheckSpellingAnswer,
  type ICreateSpellTheWord,
  type ISubmitScore,
  type IUpdateSpellTheWord,
  SubmitScoreSchema,
  UpdateSpellTheWordSchema,
} from './schema';
import { SpellTheWordService } from './spell-the-word.service';

export const SpellTheWordController = Router()
  .post(
    '/',
    validateAuth({}),
    validateBody({
      schema: CreateSpellTheWordSchema,
      file_fields: [
        { name: 'thumbnail_image', maxCount: 1 },
        { name: 'files_to_upload', maxCount: 50 },
        { name: 'audio_files', maxCount: 50 },
      ],
    }),
    async (
      request: AuthedRequest<{}, {}, ICreateSpellTheWord>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const newGame = await SpellTheWordService.createSpellTheWord(
          request.body,
          request.user!.user_id,
        );
        const result = new SuccessResponse(
          StatusCodes.CREATED,
          'Spell the Word game created',
          newGame,
        );

        return response.status(result.statusCode).json(result.json());
      } catch (error) {
        next(error);
      }
    },
  )
  .get(
    '/:game_id',
    validateAuth({}),
    async (
      request: AuthedRequest<{ game_id: string }>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const game = await SpellTheWordService.getGameDetail(
          request.params.game_id,
          request.user!.user_id,
          request.user!.role,
        );
        const result = new SuccessResponse(
          StatusCodes.OK,
          'Get game successfully',
          game,
        );

        return response.status(result.statusCode).json(result.json());
      } catch (error) {
        return next(error);
      }
    },
  )
  .get(
    '/:game_id/play/public',
    async (
      request: Request<{ game_id: string }>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const game = await SpellTheWordService.getGamePlay(
          request.params.game_id,
          true,
        );
        const result = new SuccessResponse(
          StatusCodes.OK,
          'Get public game successfully',
          game,
        );

        return response.status(result.statusCode).json(result.json());
      } catch (error) {
        return next(error);
      }
    },
  )
  .get(
    '/:game_id/play/private',
    validateAuth({}),
    async (
      request: AuthedRequest<{ game_id: string }>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const game = await SpellTheWordService.getGamePlay(
          request.params.game_id,
          true,
          request.user!.user_id,
          request.user!.role,
        );
        const result = new SuccessResponse(
          StatusCodes.OK,
          'Get private game successfully',
          game,
        );

        return response.status(result.statusCode).json(result.json());
      } catch (error) {
        return next(error);
      }
    },
  )
  .patch(
    '/:game_id',
    validateAuth({}),
    validateBody({
      schema: UpdateSpellTheWordSchema,
      file_fields: [
        { name: 'thumbnail_image', maxCount: 1 },
        { name: 'files_to_upload', maxCount: 50 },
        { name: 'audio_files', maxCount: 50 },
      ],
    }),
    async (
      request: AuthedRequest<{ game_id: string }, {}, IUpdateSpellTheWord>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const updatedGame = await SpellTheWordService.updateSpellTheWord(
          request.body,
          request.params.game_id,
          request.user!.user_id,
          request.user!.role,
        );
        const result = new SuccessResponse(
          StatusCodes.OK,
          'Spell the Word game updated',
          updatedGame,
        );

        return response.status(result.statusCode).json(result.json());
      } catch (error) {
        next(error);
      }
    },
  )
  .post(
    '/:game_id/check',
    validateBody({ schema: CheckSpellingAnswerSchema }),
    async (
      request: Request<{ game_id: string }, {}, ICheckSpellingAnswer>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const result = await SpellTheWordService.checkAnswer(
          request.body,
          request.params.game_id,
        );
        const successResponse = new SuccessResponse(
          StatusCodes.OK,
          'Answer checked successfully',
          result,
        );

        return response
          .status(successResponse.statusCode)
          .json(successResponse.json());
      } catch (error) {
        next(error);
      }
    },
  )
  .delete(
    '/:game_id',
    validateAuth({}),
    async (
      request: AuthedRequest<{ game_id: string }>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const result = await SpellTheWordService.deleteGame(
          request.params.game_id,
          request.user!.user_id,
          request.user!.role,
        );

        const successResponse = new SuccessResponse(
          StatusCodes.OK,
          'Spell the Word game deleted successfully',
          result,
        );

        return response
          .status(successResponse.statusCode)
          .json(successResponse.json());
      } catch (error) {
        return next(error);
      }
    },
  )
  .post(
    '/:game_id/submit-score',
    validateAuth({ optional: true }),
    validateBody({ schema: SubmitScoreSchema }),
    async (
      request: AuthedRequest<{ game_id: string }, {}, ISubmitScore>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const result = await SpellTheWordService.submitScore(
          request.body,
          request.params.game_id,
          request.user?.user_id,
        );

        const successResponse = new SuccessResponse(
          StatusCodes.OK,
          result.message,
          result,
        );

        return response
          .status(successResponse.statusCode)
          .json(successResponse.json());
      } catch (error) {
        return next(error);
      }
    },
  )
  .get(
    '/:game_id/leaderboard',
    async (
      request: Request<{ game_id: string }, {}, {}, { limit?: string }>,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const limit = request.query.limit
          ? Number.parseInt(request.query.limit)
          : 10;
        const leaderboard: Awaited<
          ReturnType<typeof SpellTheWordService.getLeaderboard>
        > = await SpellTheWordService.getLeaderboard(
          request.params.game_id,
          limit,
        );

        const result = new SuccessResponse(
          StatusCodes.OK,
          'Get leaderboard successfully',
          leaderboard,
        );

        return response.status(result.statusCode).json(result.json());
      } catch (error) {
        return next(error);
      }
    },
  );
