/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/no-default-export */
import { Router } from 'express';

import { PairOrNoPairController } from './pair-or-no-pair/pair-or-no-pair.controller';
import { QuizController } from './quiz/quiz.controller';
import { SpellTheWordController } from './spell-the-word/spell-the-word.controller';

const gameListRouter = Router();

gameListRouter.use('/quiz', QuizController);
gameListRouter.use('/pair-or-no-pair', PairOrNoPairController);
gameListRouter.use('/spell-the-word', SpellTheWordController);

export default gameListRouter;
