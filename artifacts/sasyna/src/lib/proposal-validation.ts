import { KMTC_PROPOSAL_HEADINGS, NON_GENERATED_HEADINGS, normalizeTemplateHeading } from "./proposal-template";
import { resolveCitationMarkers } from "./citation-search";
import type { ResearchProject } from "./proposal-types";
import { calculateSampleSize } from "./sample-size";

const PLACEHOLDER_PATTERN = /\[Complete this section|\bTODO\b|\bTBD\b|NEEDS_INFO|citation needs verification|source verification needed|\[\[CITE:/i;

export function sectionRequiresCitationReview(heading: string) {
  return /^(?:1\.[1-4]|1\.(?:8|9|12)|2\.\d|3\.(?:1|2|3|4|7|11|12|13|14|15))(?:\b|$)/i.test(heading);
}

export function validateProposalForExport(project: ResearchProject): string[] {
  const problems: string[] = [];
  const presentHeadings = new Set(
    project.sections.map((section) => normalizeTemplateHeading(section.heading).trim().toLowerCase()),
  );
  for (const heading of KMTC_PROPOSAL_HEADINGS.filter((item) => !/^2\.[234]\b/.test(item))) {
    if (!presentHeadings.has(normalizeTemplateHeading(heading).trim().toLowerCase())) {
      problems.push(`The required template page “${heading}” is missing.`);
    }
  }
  if (project.sections.filter((section) => /^2\.[234]\b/.test(section.heading)).length !== 3) {
    problems.push("The literature review must include three objective-related sections.");
  }
  const required: [string, string | undefined][] = [
    ["working title", project.title],
    ["student name", project.studentName],
    ["admission number", project.admissionNumber],
    ["course or programme", project.course],
    ["department", project.department],
    ["study location", project.studyLocation],
    ["internal supervisor name", project.supervisorName],
    ["study design", project.studyDesign],
    ["target population", project.targetPopulation],
    ["study-period start date", project.studyPeriodStart],
    ["study-period end date", project.studyPeriodEnd],
    ["broad objective", project.broadObjective],
    ["specific objectives", project.specificObjectives],
    ["research questions", project.researchQuestions],
  ];
  for (const [label, value] of required) {
    if (!value?.trim()) problems.push(`Add the ${label} in Project details.`);
  }

  if (project.studyPeriodStart && project.studyPeriodEnd && project.studyPeriodEnd < project.studyPeriodStart) {
    problems.push("The study-period end date must be on or after the start date.");
  }

  try {
    calculateSampleSize({
      confidenceLevel: project.confidenceLevel ?? 95,
      proportionEstimate: project.proportionEstimate ?? 50,
      marginOfError: project.marginOfError ?? 5,
      populationSize: project.populationSize,
      nonresponseRate: project.nonresponseRate ?? 10,
    });
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "Check the sample-size inputs in Project details.");
  }

  if (!project.budgetItems?.length) problems.push("Add budget items and verified KSh costs in Project details.");
  if (project.budgetItems?.some((item) => !item.item.trim() || item.quantity <= 0 || item.unitCost < 0 || !Number.isFinite(item.quantity * item.unitCost))) {
    problems.push("Correct the budget rows. Each row needs an item, a positive quantity, and a non-negative unit cost.");
  }
  if (!project.workPlanStartDate || !Number.isInteger(project.workPlanDurationMonths) || (project.workPlanDurationMonths ?? 0) < 1) {
    problems.push("Add a work-plan start date and duration in Project details.");
  }
  if (!project.mapPoint || !project.mapImage) {
    problems.push("Create and save the study-area map in the Appendix IV section.");
  }

  const citedRecordIds = new Set<string>();
  for (const section of project.sections) {
    if (NON_GENERATED_HEADINGS.has(section.heading)) continue;
    if (!section.content.trim()) problems.push(`${section.heading} is empty.`);
    if (PLACEHOLDER_PATTERN.test(section.content)) problems.push(`${section.heading} contains an unresolved source or draft marker.`);

    const heading = normalizeTemplateHeading(section.heading);
    const resolved = resolveCitationMarkers(section.content, project.references ?? []);
    resolved.citationIds.forEach((id) => citedRecordIds.add(id));
    if (!sectionRequiresCitationReview(heading)) continue;
    if (/citation needs verification|source verification needed/i.test(resolved.content)) {
      problems.push(`${heading} contains a citation that does not match a saved source record.`);
    }
    if (!resolved.citationIds.length) {
      problems.push(`${heading} needs at least one in-text citation linked to a saved source.`);
    }
  }
  for (const citation of project.references ?? []) {
    if (!citedRecordIds.has(citation.id)) continue;
    if (
      !citation.title.trim() ||
      !citation.authors.length ||
      !citation.authors.every((author) => author.lastName.trim()) ||
      !Number.isInteger(citation.year) ||
      !citation.journal?.trim() ||
      !(citation.doi?.trim() || citation.sourceUrl?.trim())
    ) {
      problems.push(`The citation for “${citation.title || "an unnamed source"}” is missing information needed for a complete APA 7 reference.`);
    }
  }
  return [...new Set(problems)];
}
