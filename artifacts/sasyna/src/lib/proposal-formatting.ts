type SectionWordTarget = {
  pattern: RegExp;
  words: number;
};

const SECTION_WORD_TARGETS: SectionWordTarget[] = [
  { pattern: /^dedication$/i, words: 76 },
  { pattern: /^acknowledg(?:e)?ment$/i, words: 104 },
  { pattern: /^list of abbreviations and acronyms$/i, words: 60 },
  { pattern: /^definition of terms?$/i, words: 255 },
  { pattern: /^abstract$/i, words: 251 },
  { pattern: /^1\.1\b/i, words: 262 },
  { pattern: /^1\.2\b/i, words: 563 },
  { pattern: /^1\.3\b/i, words: 360 },
  { pattern: /^1\.4\b/i, words: 218 },
  { pattern: /^1\.5\b/i, words: 75 },
  { pattern: /^1\.6\.1\b/i, words: 75 },
  { pattern: /^1\.6\b/i, words: 23 },
  { pattern: /^1\.7\b/i, words: 164 },
  { pattern: /^1\.8\b/i, words: 163 },
  { pattern: /^1\.9\b/i, words: 136 },
  { pattern: /^1\.10\b/i, words: 102 },
  { pattern: /^1\.11\b/i, words: 218 },
  { pattern: /^1\.12\b/i, words: 70 },
  { pattern: /^2\.1\b/i, words: 501 },
  { pattern: /^2\.2\b/i, words: 399 },
  { pattern: /^2\.3\b/i, words: 453 },
  { pattern: /^2\.4\b/i, words: 566 },
  { pattern: /^3\.0\b/i, words: 37 },
  { pattern: /^3\.1\b/i, words: 52 },
  { pattern: /^3\.2\b/i, words: 193 },
  { pattern: /^3\.3\b/i, words: 73 },
  { pattern: /^3\.4\b/i, words: 69 },
  { pattern: /^3\.5\b/i, words: 21 },
  { pattern: /^3\.6\b/i, words: 29 },
  { pattern: /^3\.7\.1\b/i, words: 11 },
  { pattern: /^3\.7\.2\b/i, words: 37 },
  { pattern: /^3\.7\b/i, words: 20 },
  { pattern: /^3\.8\b/i, words: 149 },
  { pattern: /^3\.9\b/i, words: 67 },
  { pattern: /^3\.10\b/i, words: 75 },
  { pattern: /^3\.11\b/i, words: 65 },
  { pattern: /^3\.12\b/i, words: 98 },
  { pattern: /^3\.13\b/i, words: 41 },
  { pattern: /^3\.14\b/i, words: 66 },
  { pattern: /^3\.15\b/i, words: 100 },
  { pattern: /^appendix i:/i, words: 339 },
];

const MAX_ABBREVIATIONS = 12;
const MAX_ABBREVIATION_WORDS = 60;

function targetFor(heading: string): number | undefined {
  const normalized = heading.trim().replace(/\s+/g, " ");
  return SECTION_WORD_TARGETS.find(({ pattern }) => pattern.test(normalized))?.words;
}

function wordCount(value: string): number {
  return value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function cleanMarkup(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*[-_]{3,}\s*$/gm, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*\*\s+/gm, "• ")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function comparableHeading(value: string): string {
  return cleanMarkup(value)
    .replace(/^\s*[•-]\s*/, "")
    .replace(/^\d+(?:\.\d+)*\s*/, "")
    .replace(/[.:—–-]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function removeRepeatedHeading(value: string, heading: string): string {
  const lines = value.split("\n");
  const expected = comparableHeading(heading);
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && comparableHeading(lines[0]) === expected) {
    lines.shift();
    while (lines.length && !lines[0].trim()) lines.shift();
  }
  return lines.join("\n").trim();
}

function sentenceParts(value: string): string[] {
  return value.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((part) => part.trim()).filter(Boolean) ?? [value.trim()];
}

function trimToWordLimit(value: string, limit: number): string {
  const paragraphs = value.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const kept: string[] = [];
  let remaining = limit;

  for (const paragraph of paragraphs) {
    const sentences = sentenceParts(paragraph);
    const keptSentences: string[] = [];
    for (const sentence of sentences) {
      const sentenceWords = wordCount(sentence);
      if (sentenceWords <= remaining) {
        keptSentences.push(sentence);
        remaining -= sentenceWords;
        continue;
      }
      if (!kept.length && !keptSentences.length && remaining > 0) {
        const shortened = sentence
          .split(/\s+/)
          .slice(0, remaining)
          .join(" ")
          .replace(/[,:;—–-]+$/, "")
          .replace(/[.!?]+$/, "");
        if (shortened) keptSentences.push(`${shortened}…`);
      }
      if (keptSentences.length) kept.push(keptSentences.join(" "));
      return kept.join("\n\n").trim();
    }
    if (keptSentences.length) kept.push(keptSentences.join(" "));
    if (remaining <= 0) break;
  }

  return kept.join("\n\n").trim();
}

function formatAbbreviations(value: string): string {
  const entries = new Map<string, { line: string; words: number }>();
  for (const sourceLine of value.split(/\n+/)) {
    const line = sourceLine
      .replace(/^\s*(?:\d+[.)]|[•*-])\s*/, "")
      .trim();
    const match = line.match(/^([A-Z][A-Z0-9&./-]{0,11})\s*(?::|–|—|-)\s*(.+)$/);
    if (!match) continue;
    const abbreviation = match[1].toUpperCase();
    const expansion = match[2].trim().replace(/[.;]+$/, "");
    if (!expansion || entries.has(abbreviation)) continue;
    entries.set(abbreviation, {
      line: `${abbreviation} – ${expansion}`,
      words: wordCount(`${abbreviation} ${expansion}`),
    });
  }

  const selected: string[] = [];
  let words = 0;
  for (const entry of entries.values()) {
    if (selected.length >= MAX_ABBREVIATIONS) break;
    if (words + entry.words > MAX_ABBREVIATION_WORDS) continue;
    selected.push(entry.line);
    words += entry.words;
  }
  return selected.length ? selected.join("\n") : "No abbreviations are used in this proposal.";
}

export function proposalSectionWordTarget(heading: string): number | undefined {
  return targetFor(heading);
}

export function proposalSectionWordLimit(heading: string): number | undefined {
  const target = targetFor(heading);
  if (target === undefined) return undefined;
  return Math.ceil(target * 1.15);
}

export function formatProposalSectionContent(heading: string, rawContent: string): string {
  let content = removeRepeatedHeading(cleanMarkup(rawContent), heading);

  if (/^list of abbreviations and acronyms$/i.test(heading.trim())) {
    return formatAbbreviations(content);
  }

  const limit = proposalSectionWordLimit(heading);
  if (limit !== undefined && wordCount(content) > limit) {
    content = trimToWordLimit(content, limit);
  }

  return content || "Draft note: review and complete this section before submission.";
}

export function sectionNeedsRefresh(heading: string, content: string): boolean {
  if (!content.trim()) return true;

  const formatted = formatProposalSectionContent(heading, content);
  if (formatted !== content.trim()) return true;

  const limit = proposalSectionWordLimit(heading);
  return limit !== undefined && wordCount(content) > limit;
}
