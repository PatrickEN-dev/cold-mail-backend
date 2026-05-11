-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');

-- CreateTable
CREATE TABLE "emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "lead_name" TEXT,
    "company" TEXT NOT NULL,
    "phone" TEXT,
    "region" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT,
    "state" TEXT,
    "address" TEXT,
    "google_maps_url" TEXT,
    "lead_category" TEXT,
    "client_tag" TEXT,
    "lead_classification" TEXT DEFAULT 'cold',
    "status" TEXT DEFAULT 'sent',
    "campaign_name" TEXT DEFAULT '',
    "notes" TEXT DEFAULT '',
    "client_step" TEXT,
    "response_content" TEXT DEFAULT '',
    "reply_we_got" TEXT,
    "our_last_reply" TEXT,
    "time_we_got_reply" TEXT,
    "reply_time" TEXT,
    "date_sent" TIMESTAMPTZ(6),
    "dispatch_platform" TEXT,
    "sender_email" TEXT,
    "sender_email_id" UUID,
    "prospect_cc_email" TEXT,
    "cc_email_1" TEXT,
    "cc_email_2" TEXT,
    "cc_email_3" TEXT,
    "bcc_email_1" TEXT,
    "deal_status" TEXT,
    "deal_value" DECIMAL,
    "deal_closed_at" TIMESTAMPTZ(6),
    "deal_lost_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sender_emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email_address" TEXT NOT NULL,
    "display_name" TEXT NOT NULL DEFAULT '',
    "domain" TEXT NOT NULL DEFAULT '',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "provider_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "provider_metadata" JSONB NOT NULL DEFAULT '{}',
    "last_synced_at" TIMESTAMPTZ(6),
    "platform" TEXT NOT NULL DEFAULT 'none',
    "daily_limit" INTEGER NOT NULL DEFAULT 0,
    "today_usage" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sender_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "webhook_url" TEXT DEFAULT '',
    "email_template" TEXT DEFAULT '',
    "linkedin_webhook_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "body_html" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT 'any',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_date" DATE,
    "scheduled_time" TIME(6) NOT NULL,
    "recurring_days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lead_selections" JSONB NOT NULL DEFAULT '[]',
    "total_leads" INTEGER NOT NULL DEFAULT 0,
    "leads_sent" INTEGER NOT NULL DEFAULT 0,
    "next_run_at" TIMESTAMPTZ(6),
    "last_run_at" TIMESTAMPTZ(6),
    "sender_email_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL DEFAULT '',
    "avatar_url" TEXT,
    "phone" TEXT,
    "company_name" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "billing_cycle" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "current_period_start" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMPTZ(6) DEFAULT (now() + interval '7 days'),
    "cancel_at_period_end" BOOLEAN DEFAULT false,
    "external_customer_id" TEXT,
    "external_subscription_id" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "status" TEXT,
    "data_conecction" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL DEFAULT '',
    "chat_id" TEXT DEFAULT '',
    "message_id" TEXT DEFAULT '',
    "provider_id" TEXT DEFAULT '',
    "public_identifier" TEXT DEFAULT '',
    "member_urn" TEXT DEFAULT '',
    "linkedin_url" TEXT NOT NULL DEFAULT '',
    "first_name" TEXT NOT NULL DEFAULT '',
    "last_name" TEXT NOT NULL DEFAULT '',
    "headline" TEXT DEFAULT '',
    "location" TEXT DEFAULT '',
    "current_company" TEXT NOT NULL DEFAULT '',
    "current_position" TEXT NOT NULL DEFAULT '',
    "top_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "follower_count" INTEGER DEFAULT 0,
    "connections_count" INTEGER DEFAULT 0,
    "is_premium" BOOLEAN DEFAULT false,
    "profile_summary" TEXT DEFAULT '',
    "lead_quality_score" INTEGER DEFAULT 0,
    "profile_picture_url" TEXT DEFAULT '',
    "message_sent" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "response_content" TEXT DEFAULT '',
    "response_message_id" TEXT DEFAULT '',
    "lead_classification" TEXT DEFAULT 'cold',
    "notes" TEXT DEFAULT '',
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "replied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedin_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sender_warmups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "sender_email_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "start_volume" INTEGER NOT NULL DEFAULT 5,
    "increment_per_day" INTEGER NOT NULL DEFAULT 5,
    "daily_limit" INTEGER NOT NULL DEFAULT 50,
    "business_days_only" BOOLEAN NOT NULL DEFAULT true,
    "bounce_threshold_pct" DECIMAL,
    "bounce_window_hours" INTEGER NOT NULL DEFAULT 24,
    "started_at" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "auto_paused_at" TIMESTAMPTZ(6),
    "auto_paused_reason" TEXT,
    "topped_out_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sender_warmups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_warmup_interactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thread_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "receiver" TEXT NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "interaction_order" INTEGER NOT NULL,
    "max_interactions" INTEGER DEFAULT 3,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_warmup_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_actions" (
    "email_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "intent_override" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_actions_pkey" PRIMARY KEY ("email_id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email_id" UUID NOT NULL,
    "thread_id" TEXT,
    "provider_message_id" TEXT,
    "in_reply_to" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "from_address" TEXT NOT NULL,
    "from_name" TEXT,
    "to_address" TEXT NOT NULL,
    "subject" TEXT,
    "body_text" TEXT,
    "body_html" TEXT,
    "provider" TEXT,
    "sent_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emails_user_id_idx" ON "emails"("user_id");

-- CreateIndex
CREATE INDEX "emails_user_status_idx" ON "emails"("user_id", "status");

-- CreateIndex
CREATE INDEX "emails_user_created_idx" ON "emails"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "emails_user_campaign_idx" ON "emails"("user_id", "campaign_name");

-- CreateIndex
CREATE INDEX "emails_user_sender_email_id_idx" ON "emails"("user_id", "sender_email_id");

-- CreateIndex
CREATE INDEX "emails_date_sent_idx" ON "emails"("date_sent" DESC);

-- CreateIndex
CREATE INDEX "emails_sender_email_id_idx" ON "emails"("sender_email_id");

-- CreateIndex
CREATE INDEX "emails_dispatch_platform_idx" ON "emails"("dispatch_platform");

-- CreateIndex
CREATE UNIQUE INDEX "emails_user_id_email_unique" ON "emails"("user_id", "email");

-- CreateIndex
CREATE INDEX "idx_sender_emails_platform" ON "sender_emails"("user_id", "platform");

-- CreateIndex
CREATE INDEX "idx_sender_emails_daily_limit" ON "sender_emails"("user_id", "daily_limit");

-- CreateIndex
CREATE INDEX "sender_emails_domain_idx" ON "sender_emails"("user_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "sender_emails_user_email_unique" ON "sender_emails"("user_id", "email_address");

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- CreateIndex
CREATE INDEX "email_templates_platform_idx" ON "email_templates"("user_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_user_name_unique" ON "email_templates"("user_id", "name");

-- CreateIndex
CREATE INDEX "schedules_user_id_idx" ON "schedules"("user_id");

-- CreateIndex
CREATE INDEX "schedules_user_next_run_at_idx" ON "schedules"("user_id", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_accounts_account_id_key" ON "linkedin_accounts"("account_id");

-- CreateIndex
CREATE INDEX "linkedin_messages_user_id_idx" ON "linkedin_messages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sender_warmups_sender_email_id_key" ON "sender_warmups"("sender_email_id");

-- CreateIndex
CREATE INDEX "sender_warmups_user_enabled_idx" ON "sender_warmups"("user_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "sender_warmups_user_sender_unique" ON "sender_warmups"("user_id", "sender_email_id");

-- CreateIndex
CREATE INDEX "email_warmup_interactions_sender_type_idx" ON "email_warmup_interactions"("sender", "interaction_type");

-- CreateIndex
CREATE INDEX "reply_actions_user_archived_idx" ON "reply_actions"("user_id", "is_archived");

-- CreateIndex
CREATE INDEX "email_messages_email_id_created_at_idx" ON "email_messages"("email_id", "created_at");

-- CreateIndex
CREATE INDEX "email_messages_user_id_idx" ON "email_messages"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_provider_message_id_direction_key" ON "email_messages"("provider_message_id", "direction");

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_sender_email_id_fkey" FOREIGN KEY ("sender_email_id") REFERENCES "sender_emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_sender_email_id_fkey" FOREIGN KEY ("sender_email_id") REFERENCES "sender_emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sender_warmups" ADD CONSTRAINT "sender_warmups_sender_email_id_fkey" FOREIGN KEY ("sender_email_id") REFERENCES "sender_emails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_actions" ADD CONSTRAINT "reply_actions_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
