import type { CitationAuthor, VerifiedCitation } from "./proposal-types";

type EuropePmcAuthor = {
  lastName?: string;
  initials?: string;
  firstName?: string;
};

type EuropePmcResult = {
  id?: string;
  source?: string;
  title?: string;
  authorString?: string;
  authorList?: { author?: EuropePmcAuthor[] };
  firstPublicationDate?: string;
  pubYear?: string;
  journalTitle?: string;
  journalInfo?: { journal?: { title?: string; volume?: string; issue?: string } };
  journalVolume?: string;
  issue?: string;
  pageInfo?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  abstractText?: string;
};

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: { family?: string; given?: string }[];
  issued?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  abstract?: string;
  URL?: string;
};

function cleanText(value: string | undefined): string {
  if (!value) return "";
  if (typeof DOMParser !== "undefined") {
    return new DOMParser().parseFromString(value, "text/html").body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanAbstract(value: string | undefined): string {
  return cleanText(value);
}

function authorsFrom(result: EuropePmcResult): CitationAuthor[] {
  const fromList = result.authorList?.author?.filter((author) => author.lastName);
  if (fromList?.length) {
    return fromList.map((author) => ({
      lastName: author.lastName!.trim(),
      initials: author.initials?.trim(),
      firstName: author.firstName?.trim(),
    }));
  }
  return (result.authorString ?? "")
    .replace(/\.$/, "")
    .split(/\s*,\s*/)
    .filter(Boolean)
    .map((name) => {
      const match = name.match(/^(.*?)(?:\s+)([A-Z]+)$/);
      return { lastName: (match?.[1] ?? name).trim(), initials: match?.[2] };
    });
}

function citationFromResult(result: EuropePmcResult): VerifiedCitation | null {
  const title = result.title?.replace(/\s+/g, " ").trim();
  const yearText = result.firstPublicationDate?.slice(0, 4) || result.pubYear;
  const year = Number(yearText);
  const authors = authorsFrom(result);
  const recordId = result.id || result.pmid || result.pmcid || result.doi;
  if (!title || !Number.isInteger(year) || !authors.length || !recordId) return null;
  const source = result.source || "MED";
  const doi = result.doi?.trim() || undefined;
  const pmid = result.pmid?.trim() || undefined;
  const pmcid = result.pmcid?.trim() || undefined;
  return {
    id: `epmc:${source}:${recordId}`,
    title,
    authors,
    year,
    journal: result.journalTitle || result.journalInfo?.journal?.title || undefined,
    volume: result.journalVolume || result.journalInfo?.journal?.volume || undefined,
    issue: result.issue || result.journalInfo?.journal?.issue || undefined,
    pages: result.pageInfo || undefined,
    doi,
    pmid,
    pmcid,
    abstract: cleanAbstract(result.abstractText),
    sourceUrl: doi ? `https://doi.org/${doi}` : `https://europepmc.org/article/${source}/${recordId}`,
    source: "Europe PMC",
  };
}

export async function searchEuropePmc(query: string, signal?: AbortSignal): Promise<VerifiedCitation[]> {
  const cleanQuery = query.trim().replace(/\s+/g, " ").slice(0, 240);
  if (cleanQuery.length < 4) throw new Error("Enter a research topic or objective with at least four characters.");
  const hostname = window.location.hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("Online source search is available only from the local SASYNA app.");
  }
  const url = new URL("/__europepmc/search", window.location.origin);
  url.searchParams.set("query", cleanQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", "8");
  const response = await fetch(url, {
    method: "GET",
    signal: signal ?? AbortSignal.timeout(15_000),
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`Europe PMC search returned HTTP ${response.status}.`);
  const payload = (await response.json()) as { resultList?: { result?: EuropePmcResult[] } };
  return (payload.resultList?.result ?? [])
    .map(citationFromResult)
    .filter((record): record is VerifiedCitation => Boolean(record))
    .filter((record, index, all) => all.findIndex((item) => item.id === record.id) === index);
}

function crossrefCitation(work: CrossrefWork): VerifiedCitation | null {
  const doi = work.DOI?.trim().toLowerCase();
  const title = cleanText(work.title?.[0]).replace(/\s+/g, " ").trim();
  const yearValue =
    work["published-print"]?.["date-parts"]?.[0]?.[0] ??
    work.published?.["date-parts"]?.[0]?.[0] ??
    work.issued?.["date-parts"]?.[0]?.[0];
  const authors = (work.author ?? [])
    .filter((author) => author.family?.trim())
    .map((author) => ({
      lastName: author.family!.trim(),
      firstName: author.given?.trim(),
      initials: author.given?.trim().split(/\s+/).map((part) => part[0]).join(""),
    }));
  if (!doi || !title || !Number.isInteger(yearValue) || !authors.length) return null;
  return {
    id: `crossref:${doi}`,
    title,
    authors,
    year: yearValue!,
    journal: work["container-title"]?.[0]?.trim() || undefined,
    volume: work.volume?.trim() || undefined,
    issue: work.issue?.trim() || undefined,
    pages: work.page?.trim() || undefined,
    doi,
    abstract: cleanAbstract(work.abstract),
    sourceUrl: `https://doi.org/${doi}`,
    source: "Crossref",
  };
}

async function searchCrossref(query: string, signal?: AbortSignal): Promise<VerifiedCitation[]> {
  const url = new URL("/__crossref/works", window.location.origin);
  url.searchParams.set("query.bibliographic", query);
  url.searchParams.set("rows", "12");
  url.searchParams.set("select", "DOI,title,author,issued,published,published-print,container-title,volume,issue,page,abstract");
  const response = await fetch(url, {
    method: "GET",
    signal: signal ?? AbortSignal.timeout(15_000),
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`Crossref search returned HTTP ${response.status}.`);
  const payload = (await response.json()) as { message?: { items?: CrossrefWork[] } };
  return (payload.message?.items ?? [])
    .map(crossrefCitation)
    .filter((record): record is VerifiedCitation => Boolean(record));
}

/**
 * Search two free scholarly metadata catalogs. Only the topic text is sent;
 * student details and proposal contents are never included in the request.
 */
export async function searchLiterature(query: string, signal?: AbortSignal): Promise<VerifiedCitation[]> {
  const cleanQuery = query.trim().replace(/\s+/g, " ").slice(0, 240);
  if (cleanQuery.length < 4) throw new Error("Enter a research topic or objective with at least four characters.");
  const hostname = window.location.hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("Free literature search is available when SASYNA is running locally.");
  }
  const results = await Promise.allSettled([
    searchEuropePmc(cleanQuery, signal),
    searchCrossref(cleanQuery, signal),
  ]);
  const successful = results.filter((result): result is PromiseFulfilledResult<VerifiedCitation[]> => result.status === "fulfilled");
  if (!successful.length) {
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw new Error(failure?.reason instanceof Error ? failure.reason.message : "Free scholarly-source search failed.");
  }
  const merged = successful.flatMap((result) => result.value);
  const byIdentifier = new Map<string, VerifiedCitation>();
  for (const record of merged) {
    const key = record.doi
      ? `doi:${record.doi.toLowerCase()}`
      : `${record.source}:${record.id}`;
    const current = byIdentifier.get(key);
    if (!current) {
      byIdentifier.set(key, record);
      continue;
    }
    const preferred = record.source === "Crossref" ? record : current;
    byIdentifier.set(key, {
      ...current,
      ...preferred,
      id: current.id,
      source: current.source,
      sourceUrl: current.sourceUrl || record.sourceUrl,
      abstract: current.abstract || record.abstract,
      pmid: current.pmid || record.pmid,
      pmcid: current.pmcid || record.pmcid,
    });
  }
  return [...byIdentifier.values()];
}

function formatInitials(initials?: string, firstName?: string): string {
  const value = initials || firstName?.split(/\s+/).map((part) => part[0]).join("") || "";
  return value
    .replace(/[^A-Za-z]/g, "")
    .split("")
    .map((letter) => `${letter.toUpperCase()}.`)
    .join(" ");
}

function apaJournalTitle(value: string): string {
  const lowercaseWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "over", "per", "the", "to", "via", "with"]);
  return value.trim().split(/\s+/).map((word, index) => {
    const match = word.match(/^([^A-Za-z0-9]*)([A-Za-z][A-Za-z0-9-]*)([^A-Za-z0-9]*)$/);
    if (!match) return word;
    const [, prefix, core, suffix] = match;
    const mixedCase = /[a-z].*[A-Z]/.test(core);
    const allCaps = /^[A-Z0-9-]+$/.test(core) && /[A-Z]/.test(core);
    if (mixedCase || allCaps) return word;
    const lower = core.toLowerCase();
    const formatted = index > 0 && lowercaseWords.has(lower)
      ? lower
      : `${lower[0].toUpperCase()}${lower.slice(1)}`;
    return `${prefix}${formatted}${suffix}`;
  }).join(" ");
}

export function citationAuthorYear(citation: VerifiedCitation): string {
  const first = citation.authors[0]?.lastName || "Unknown author";
  if (citation.authors.length === 1) return `${first}, ${citation.year}`;
  if (citation.authors.length === 2) return `${first} & ${citation.authors[1].lastName}, ${citation.year}`;
  return `${first} et al., ${citation.year}`;
}

export type BibliographicReferencePart = {
  text: string;
  italic?: boolean;
};

export function formatBibliographicReferenceParts(citation: VerifiedCitation): BibliographicReferencePart[] {
  const names = citation.authors.map((author) => `${author.lastName}, ${formatInitials(author.initials, author.firstName)}`);
  let authors = names[0] || "Author unavailable";
  if (names.length === 2) authors = `${names[0]}, & ${names[1]}`;
  else if (names.length > 2 && names.length <= 20) {
    authors = `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  } else if (names.length > 20) {
    authors = `${names.slice(0, 19).join(", ")}, … ${names[names.length - 1]}`;
  }
  const title = citation.title.trim().replace(/[.]+$/, "");
  const parts: BibliographicReferencePart[] = [
    { text: `${authors} (${citation.year}). ${title}.` },
  ];
  const journal = citation.journal?.trim();
  const volume = citation.volume?.trim();
  const issue = citation.issue?.trim();
  const locator = citation.pages?.trim();

  if (journal || volume || issue || locator) {
    parts.push({ text: " " });
    if (journal) parts.push({ text: apaJournalTitle(journal), italic: true });
    if (volume) {
      parts.push({ text: journal ? ", " : "" });
      parts.push({ text: volume, italic: true });
    }
    if (issue) parts.push({ text: `(${issue})` });
    if (locator) {
      const articleNumber = /^\d+$/.test(locator) ? `Article ${locator}` : locator;
      parts.push({ text: `, ${articleNumber}` });
    }
    parts.push({ text: "." });
  }

  const doi = citation.doi?.trim().replace(/^https?:\/\/doi\.org\//i, "");
  parts.push({
    text: ` ${doi ? `https://doi.org/${doi}` : citation.sourceUrl}`,
  });
  return parts;
}

export function formatBibliographicReference(citation: VerifiedCitation): string {
  return formatBibliographicReferenceParts(citation).map((part) => part.text).join("").replace(/\s+/g, " ").trim();
}

export function resolveCitationMarkers(
  rawText: string,
  citations: VerifiedCitation[],
): { content: string; citationIds: string[] } {
  const missingInfo = rawText.match(/NEEDS_INFO:\s*([\s\S]*)/i);
  if (missingInfo) {
    return {
      content: `Draft note: study-specific information or sources were not available. Review this section before submission. ${missingInfo[1].trim()}`,
      citationIds: [],
    };
  }
  const byId = new Map(citations.map((citation) => [citation.id, citation]));
  const citationIds = new Set<string>();
  let content = rawText.replace(/\[\[CITE:([^\]]+)\]\]/g, (_token, id: string) => {
    const citation = byId.get(id.trim());
    if (!citation) return "(citation needs verification)";
    citationIds.add(citation.id);
    return `(${citationAuthorYear(citation)})`;
  });
  content = content.replace(/\[\[(epmc:[A-Z]+:[^\]]+|crossref:[^\]]+)\]\]/gi, (_token, id: string) => {
    const citation = byId.get(id);
    if (!citation) return "(citation needs verification)";
    citationIds.add(citation.id);
    return `(${citationAuthorYear(citation)})`;
  });
  const authorYearPattern = /\(([^()]{2,120}?),\s*((?:19|20)\d{2}[a-z]?)\)/g;
  content = content.replace(authorYearPattern, (whole, authorText: string, yearText: string) => {
    const year = Number(yearText.slice(0, 4));
    const normalizedAuthor = authorText.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const matches = citations.filter((citation) =>
      citation.year === year &&
      citation.authors.some((author) => {
        const surname = author.lastName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        return surname.length > 1 && normalizedAuthor.includes(surname);
      }),
    );
    if (matches.length !== 1) return "(citation needs verification)";
    const match = matches[0];
    citationIds.add(match.id);
    return `(${citationAuthorYear(match)})`;
  });
  content = content
    .replace(/\[\[(?:VERIFIED SOURCE|SOURCE|LOCAL CONTEXT)\b[^\]]*\]\]/gi, "")
    .replace(/^\s*(?:Source review needed: confirm every source-dependent claim in this section is supported by the linked references\.|Citation review needed: no verified source is linked to this section\. Add real references before submission\.|Review each source-dependent claim before submission\. Only references linked to saved source records are listed above\.)\s*$/gim, "")
    .replace(/\[SOURCE NEEDED\]|\[LOCAL SOURCE[^\]]*\]|\[Complete this section\]/gi, "(source verification needed)")
    .replace(/\b(?:TODO|TBD)\b/gi, "(draft detail needs review)")
    .replace(/\[\[CITE:[^\]]*\]\]/gi, "(citation needs verification)")
    .trim();
  if (!content) {
    content = "Draft note: review and complete this section before submission.";
  }
  return { content, citationIds: [...citationIds] };
}
