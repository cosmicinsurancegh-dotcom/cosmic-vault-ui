import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback } from "react";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export type UploadedFile = {
  storageId: Id<"_storage">;
  name: string;
  size: number;
  contentType: string;
};

export function useUpload() {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  return useCallback(
    async (file: File): Promise<UploadedFile> => {
      if (file.size === 0) throw new Error("That file is empty.");
      if (file.size > MAX_BYTES) throw new Error("Files must be 10 MB or smaller.");
      if (!ALLOWED.includes(file.type)) {
        throw new Error("Upload a PDF, image (PNG/JPEG/WebP), DOCX, or text file.");
      }
      const url = await generateUploadUrl();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("The upload failed. Please try again.");
      const json = (await response.json()) as { storageId: Id<"_storage"> };
      return {
        storageId: json.storageId,
        name: file.name,
        size: file.size,
        contentType: file.type,
      };
    },
    [generateUploadUrl],
  );
}
