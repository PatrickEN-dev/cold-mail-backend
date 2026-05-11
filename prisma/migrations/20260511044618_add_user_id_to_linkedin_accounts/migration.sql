-- AlterTable
ALTER TABLE "linkedin_accounts" ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "current_period_end" SET DEFAULT (now() + interval '7 days');

-- CreateIndex
CREATE INDEX "linkedin_accounts_user_id_idx" ON "linkedin_accounts"("user_id");
