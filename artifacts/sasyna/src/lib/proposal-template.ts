export const KMTC_PROPOSAL_HEADINGS = [
  "Cover page",
  "Certification",
  "Declaration",
  "Dedication",
  "Acknowledgment",
  "Table of Contents",
  "List of Abbreviations and Acronyms",
  "Definition of Terms",
  "Abstract",
  "Chapter One",
  "1.1 Introduction",
  "1.2 Background Information",
  "1.3 Problem Statement",
  "1.4 Justification",
  "1.5 Research Questions",
  "1.6 Broad Objectives",
  "1.6.1 Specific Objectives",
  "1.7 Scope of the Study",
  "1.8 Significance of the Study",
  "1.9 Study Limitations",
  "1.10 Study Delimitation",
  "1.11 Assumptions",
  "1.12 Conceptual framework",
  "Chapter Two: Literature Review",
  "2.1 Overview of the study topic",
  "2.2 Literature related to Specific Objective One",
  "2.3 Literature related to Specific Objective Two",
  "2.4 Literature related to Specific Objective Three",
  "Chapter Three: Research Methodology",
  "3.0 Overview",
  "3.1 Study Design",
  "3.2 Study Area",
  "3.3 Study Population",
  "3.4 Sampling technique",
  "3.5 Inclusion Criteria",
  "3.6 Exclusion Criteria",
  "3.7 Variables",
  "3.7.1 Dependent variable",
  "3.7.2 Independent Variables",
  "3.8 Sample size determination",
  "3.9 Data collection process",
  "3.10 Data collection tools",
  "3.11 Piloting",
  "3.12 Validity",
  "3.13 Reliability",
  "3.14 Data analysis",
  "3.15 Ethical considerations",
  "References",
  "Appendices",
  "Appendix I: Research Checklist",
  "Appendix II: Budget",
  "Appendix III: Work Plan",
  "Appendix IV: Map of the Study Area",
] as const;

export function normalizeTemplateHeading(heading: string): string {
  const normalized = heading.trim().replace(/\s+/g, " ");
  if (/^3\.10 data collection process$/i.test(normalized)) {
    return "3.10 Data collection tools";
  }
  return heading;
}

export const FRONT_MATTER_HEADINGS = new Set([
  "Cover page",
  "Certification",
  "Declaration",
  "Dedication",
  "Acknowledgment",
  "Table of Contents",
  "List of Abbreviations and Acronyms",
  "Definition of Terms",
]);

export const NON_GENERATED_HEADINGS = new Set([
  "Cover page",
  "Certification",
  "Declaration",
  "Table of Contents",
  "Chapter One",
  "Chapter Two: Literature Review",
  "Chapter Three: Research Methodology",
  "3.8 Sample size determination",
  "References",
  "Appendices",
  "Appendix II: Budget",
  "Appendix III: Work Plan",
  "Appendix IV: Map of the Study Area",
]);

function objectiveForHeading(value: string): string {
  return value
    .trim()
    .replace(/^\s*(?:\d+[\.\)]|[ivx]+[\.\)]|[-*])\s*/i, "")
    .replace(/^(?:to\s+)?/i, "")
    .replace(/[.?!]+$/, "")
    .replace(/\s+/g, " ");
}

export function createTemplateLines(specificObjectives: string[] = []): string[] {
  const headings: string[] = [...KMTC_PROPOSAL_HEADINGS];
  const objectiveHeadings = specificObjectives
    .map(objectiveForHeading)
    .filter(Boolean)
    .slice(0, 3);

  for (let index = 0; index < 3; index += 1) {
    const objective = objectiveHeadings[index];
    const text = objective
      ? `Literature related to ${objective}`
      : `Literature related to the study objectives`;
    headings[26 + index] = `2.${index + 2} ${text.slice(0, 105)}`;
  }
  return headings;
}

export function getSectionId(heading: string, index: number): string {
  return `section-${index}-${heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}
