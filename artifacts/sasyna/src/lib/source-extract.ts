import mammoth from "mammoth";

export type ExtractedSource = {
  text: string;
  warning?: string;
};

const MAX_SOURCE_CHARS = 120_000;
const MAX_PDF_PAGES = 80;

function extension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export async function extractLocalSource(file: File): Promise<ExtractedSource> {
  const ext = extension(file.name);
  if (["txt", "md", "csv", "tsv"].includes(ext) || file.type.startsWith("text/")) {
    return { text: (await file.text()).slice(0, MAX_SOURCE_CHARS) };
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return {
      text: result.value.slice(0, MAX_SOURCE_CHARS),
      warning: result.messages.length ? "Some Word formatting was skipped during local text extraction." : undefined,
    };
  }

  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`This PDF has ${pdf.numPages} pages. The local index currently accepts up to ${MAX_PDF_PAGES} pages per file.`);
    }
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      pages.push(text);
      if (pages.join("\n").length >= MAX_SOURCE_CHARS) break;
    }
    const text = pages.join("\n").slice(0, MAX_SOURCE_CHARS);
    return {
      text,
      warning: text.trim()
        ? undefined
        : "No selectable text was found. Scanned PDFs need OCR, which is not enabled.",
    };
  }

  throw new Error("Local text extraction supports PDF, DOCX, TXT, Markdown, CSV, and TSV files.");
}

export function findRelevantLocalSources(
  sources: { name: string; extractedText?: string }[],
  query: string,
  maxSources = 4,
): { name: string; excerpt: string }[] {
  const terms = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 3),
  );
  return sources
    .filter((source) => source.extractedText?.trim())
    .map((source) => {
      const text = source.extractedText ?? "";
      const paragraphs = text.split(/\n{1,2}/).map((part) => part.trim()).filter(Boolean);
      const ranked = paragraphs
        .map((paragraph) => ({
          paragraph,
          score: [...terms].reduce(
            (score, term) => score + (paragraph.toLowerCase().includes(term) ? 1 : 0),
            0,
          ),
        }))
        .sort((a, b) => b.score - a.score);
      return {
        name: source.name,
        excerpt: ranked.slice(0, 3).map((item) => item.paragraph).join("\n").slice(0, 3200),
      };
    })
    .filter((source) => source.excerpt)
    .slice(0, maxSources);
}
