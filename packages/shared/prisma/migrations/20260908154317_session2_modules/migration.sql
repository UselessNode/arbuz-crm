-- CreateEnum
CREATE TYPE "PdfExportStatus" AS ENUM ('pending', 'processing', 'done', 'error');

-- CreateTable
CREATE TABLE "pdf_export_jobs" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "status" "PdfExportStatus" NOT NULL DEFAULT 'pending',
    "file_id" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts_files" (
    "post_id" INTEGER NOT NULL,
    "file_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_files_pkey" PRIMARY KEY ("post_id","file_id")
);

-- CreateIndex
CREATE INDEX "idx_pdf_export_jobs_application" ON "pdf_export_jobs"("application_id");

-- CreateIndex
CREATE INDEX "idx_pdf_export_jobs_status" ON "pdf_export_jobs"("status");

-- CreateIndex
CREATE INDEX "idx_pdf_export_jobs_file" ON "pdf_export_jobs"("file_id");

-- CreateIndex
CREATE INDEX "idx_posts_files_file" ON "posts_files"("file_id");

-- AddForeignKey
ALTER TABLE "pdf_export_jobs" ADD CONSTRAINT "pdf_export_jobs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pdf_export_jobs" ADD CONSTRAINT "pdf_export_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "posts_files" ADD CONSTRAINT "posts_files_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "posts_files" ADD CONSTRAINT "posts_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
