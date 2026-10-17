import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export async function validateUpload(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
) {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) {
    throw new Error("That upload could not be found. Please upload it again.");
  }
  if (meta.size > MAX_FILE_BYTES) {
    throw new Error("Files must be 10 MB or smaller.");
  }
  if (!ALLOWED_TYPES.has(meta.contentType ?? "")) {
    throw new Error("Upload a PDF, image (PNG/JPEG/WebP), DOCX, or plain text file.");
  }
  return { size: meta.size, contentType: meta.contentType ?? "application/octet-stream" };
}

export async function storageUrl(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
) {
  return await ctx.storage.getUrl(storageId);
}
