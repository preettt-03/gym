-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('WORKOUT_PLAN', 'DIET_PLAN', 'FORM_TIP', 'MOTIVATION', 'NUTRITION_SUGGESTION', 'CHATBOT');

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "workoutPlanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dietPlanEnabled" BOOLEAN NOT NULL DEFAULT true,
    "formTipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "motivationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nutritionSuggestionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatbotEnabled" BOOLEAN NOT NULL DEFAULT true,
    "prompts" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "feature" "AiFeature" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_logs_feature_createdAt_idx" ON "ai_logs"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "ai_logs_userId_createdAt_idx" ON "ai_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_chat_messages_userId_createdAt_idx" ON "ai_chat_messages"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
