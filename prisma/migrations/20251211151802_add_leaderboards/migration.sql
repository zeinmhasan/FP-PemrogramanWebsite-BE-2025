-- CreateTable
CREATE TABLE "Leaderboards" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "user_id" TEXT,
    "player_name" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "time_taken" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leaderboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Leaderboards_game_id_score_idx" ON "Leaderboards"("game_id", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboards_game_id_user_id_key" ON "Leaderboards"("game_id", "user_id");

-- AddForeignKey
ALTER TABLE "Leaderboards" ADD CONSTRAINT "Leaderboards_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leaderboards" ADD CONSTRAINT "Leaderboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
