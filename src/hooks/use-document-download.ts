import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { downloadPdfDocument } from "@/lib/pdf";
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
      const safeName = document.name
        .replace(/[^\w.-]+/g, "-")
        .replace(/\.(csv|txt)$/i, "");
      downloadPdfDocument({
        filename: `${safeName}.pdf`,
        title: document.name,
        lines: (document.body ?? "This document has no content.").split("\n"),
      });
    },
    [convex],
  );
}
