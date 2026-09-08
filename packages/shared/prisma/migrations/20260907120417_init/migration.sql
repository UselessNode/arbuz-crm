-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('admin', 'expert', 'applicant');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "additional_materials" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "file_path" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50),
    "file_bytes_size" DECIMAL(10,2),
    "comment" TEXT,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "additional_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_reviews" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "expert_id" INTEGER NOT NULL,
    "review_status" "ReviewStatus",
    "review_text" TEXT,
    "rating" JSONB,
    "total_score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "application_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "is_editable" BOOLEAN DEFAULT true,
    "is_deletable" BOOLEAN DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "application_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "title" VARCHAR(255) NOT NULL,
    "tender_id" INTEGER,
    "direction_id" INTEGER,
    "status_id" INTEGER NOT NULL DEFAULT 1,
    "idea_description" TEXT NOT NULL,
    "importance_to_team" TEXT NOT NULL,
    "project_goal" TEXT NOT NULL,
    "project_tasks" TEXT NOT NULL,
    "implementation_experience" TEXT,
    "results_description" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_logs" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER,
    "user_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "tender_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "directions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "file_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "file_type" VARCHAR(50),
    "category_id" INTEGER,
    "path" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_budget" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "resource_type" VARCHAR(255) NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "quantity" INTEGER,
    "own_funds" DECIMAL(10,2),
    "grant_funds" DECIMAL(10,2),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_plans" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "task" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "results" TEXT,
    "fixation_form" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "project_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_migrations" (
    "version" VARCHAR(255) NOT NULL,
    "applied_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "surname" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "patronymic" VARCHAR(100),
    "tasks_in_project" TEXT,
    "contact_info" VARCHAR(255),
    "social_media_links" TEXT,
    "forum_url" VARCHAR(255),
    "is_responsible" BOOLEAN,
    "is_coordinator" BOOLEAN,
    "education" TEXT,
    "work_experience" TEXT,
    "is_adult" BOOLEAN,
    "consent_file_path" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_criteria" (
    "id" SERIAL NOT NULL,
    "tender_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "min_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_value" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "surname" VARCHAR(100),
    "name" VARCHAR(100),
    "patronymic" VARCHAR(100),
    "role" "RoleType" NOT NULL DEFAULT 'applicant',
    "last_activity" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_files" (
    "id" SERIAL NOT NULL,
    "team_member_id" INTEGER NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255),
    "file_type" VARCHAR(50),
    "file_size" INTEGER,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "consent_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "category_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_additional_materials_application" ON "additional_materials"("application_id");

-- CreateIndex
CREATE INDEX "idx_additional_materials_deleted" ON "additional_materials"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_app_reviews_application" ON "application_reviews"("application_id");

-- CreateIndex
CREATE INDEX "idx_app_reviews_deleted" ON "application_reviews"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_app_reviews_expert" ON "application_reviews"("expert_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_reviews_application_id_expert_id_key" ON "application_reviews"("application_id", "expert_id");

-- CreateIndex
CREATE INDEX "idx_application_statuses_deleted" ON "application_statuses"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_applications_created" ON "applications"("created_at");

-- CreateIndex
CREATE INDEX "idx_applications_deleted" ON "applications"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_applications_direction" ON "applications"("direction_id");

-- CreateIndex
CREATE INDEX "idx_applications_owner" ON "applications"("owner_id");

-- CreateIndex
CREATE INDEX "idx_applications_status" ON "applications"("status_id");

-- CreateIndex
CREATE INDEX "idx_applications_status_created" ON "applications"("status_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_applications_submitted" ON "applications"("submitted_at");

-- CreateIndex
CREATE INDEX "idx_applications_tender" ON "applications"("tender_id");

-- CreateIndex
CREATE INDEX "idx_change_logs_application" ON "change_logs"("application_id");

-- CreateIndex
CREATE INDEX "idx_change_logs_created" ON "change_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_change_logs_deleted" ON "change_logs"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_change_logs_user" ON "change_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_directions_deleted" ON "directions"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_directions_tender" ON "directions"("tender_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_categories_name_key" ON "file_categories"("name");

-- CreateIndex
CREATE INDEX "idx_file_categories_deleted" ON "file_categories"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_files_category" ON "files"("category_id");

-- CreateIndex
CREATE INDEX "idx_files_deleted" ON "files"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_files_name" ON "files"("name");

-- CreateIndex
CREATE INDEX "idx_project_budget_application" ON "project_budget"("application_id");

-- CreateIndex
CREATE INDEX "idx_project_budget_deleted" ON "project_budget"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_project_plans_application" ON "project_plans"("application_id");

-- CreateIndex
CREATE INDEX "idx_project_plans_deleted" ON "project_plans"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_team_members_application" ON "team_members"("application_id");

-- CreateIndex
CREATE INDEX "idx_team_members_deleted" ON "team_members"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_tenders_deleted" ON "tenders"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_evaluation_criteria_tender" ON "evaluation_criteria"("tender_id");

-- CreateIndex
CREATE INDEX "idx_evaluation_criteria_deleted" ON "evaluation_criteria"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_deleted" ON "users"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_users_last_activity" ON "users"("last_activity");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_consent_files_team_member" ON "consent_files"("team_member_id");

-- CreateIndex
CREATE INDEX "idx_consent_files_deleted" ON "consent_files"("deleted_at") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_posts_published" ON "posts"("is_published");

-- CreateIndex
CREATE INDEX "idx_posts_category" ON "posts"("category_id");

-- CreateIndex
CREATE INDEX "idx_posts_created" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "idx_posts_deleted" ON "posts"("deleted_at") WHERE (deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "additional_materials" ADD CONSTRAINT "additional_materials_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_direction_id_fkey" FOREIGN KEY ("direction_id") REFERENCES "directions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "application_statuses"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "directions" ADD CONSTRAINT "directions_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "file_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_budget" ADD CONSTRAINT "project_budget_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evaluation_criteria" ADD CONSTRAINT "evaluation_criteria_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consent_files" ADD CONSTRAINT "consent_files_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
