import { useEffect } from "react";

/**
 * Sets a descriptive document title and meta description for public pages.
 * Restores the previous values when the page unmounts so route transitions
 * never leave stale metadata behind.
 */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;

    document.title = title.includes("Cosmic Vault")
      ? title
      : `${title} · Cosmic Vault`;

    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    const previousDescription = descriptionTag.getAttribute("content");
    descriptionTag.setAttribute("content", description);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute(
      "href",
      `${window.location.origin}${window.location.pathname}`,
    );

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) {
        descriptionTag?.setAttribute("content", previousDescription);
      }
    };
  }, [title, description]);
}
