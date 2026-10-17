import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { downloadText } from "@/lib/format";
import { useConvex } from "convex/react";
import { useCallback } from "react";

export function useDocumentDownload() {
  const convex = useConvex();
  return useCallback(
    async (documentId: Id<"documents">) => {
      const { document, url } = await convex.query(api.documents.get, {
        documentId,
      });
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      const safeName = document.name.replace(/[^\w.-]+/g, "-");
      downloadText(
        safeName.endsWith(".txt") ? safeName : `${safeName}.txt`,
        document.body ?? "This document has no content.",
      );
    },
    [convex],
  );
}
