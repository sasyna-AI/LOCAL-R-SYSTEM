import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageNumber,
  Paragraph,
  Packer,
  SectionType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { estimatePageNumbersWith } from "docx/layout";
import { formatBibliographicReferenceParts, resolveCitationMarkers } from "./citation-search";
import { sampleSizeSectionText } from "./sample-size";
import { formatProposalSectionContent } from "./proposal-formatting";
import { normalizeTemplateHeading } from "./proposal-template";
import { validateProposalForExport } from "./proposal-validation";
import type { ResearchProject } from "./proposal-types";

export type ExportProject = ResearchProject;

const FONT = "Times New Roman";
const BODY_SIZE = 24;
const page = {
  size: { width: 12240, height: 15840 },
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
};

const lineBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

function paragraph(text: string, options: Record<string, unknown> = {}): Paragraph {
  return new Paragraph({
    ...options,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: BODY_SIZE,
        color: "000000",
      }),
    ],
  });
}

function bodyParagraphs(content: string): Paragraph[] {
  if (!content.trim()) return [];
  return content
    .split(/\n{1,2}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      new Paragraph({
        children: [new TextRun({ text: part, font: FONT, size: BODY_SIZE, color: "000000" })],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 180, line: 360 },
      }),
    );
}

function centered(text: string, bold = false, size = BODY_SIZE): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 180, line: 360 },
    children: [new TextRun({ text, font: FONT, size, bold, color: "000000" })],
  });
}

function removeEntryMarker(value: string): string {
  return value.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s*)/, "").trim();
}

function abbreviationParagraphs(content: string): Paragraph[] {
  return content
    .split(/\r?\n+/)
    .map(removeEntryMarker)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([A-Z][A-Z0-9&./-]{0,11})\s*(?:–|—|-|:)\s*(.+)$/);
      const children = match
        ? [
            new TextRun({ text: match[1], font: FONT, size: BODY_SIZE, bold: true, color: "000000" }),
            new TextRun({ text: ` – ${match[2].trim()}`, font: FONT, size: BODY_SIZE, color: "000000" }),
          ]
        : [new TextRun({ text: line, font: FONT, size: BODY_SIZE, color: "000000" })];
      return new Paragraph({
        children,
        alignment: AlignmentType.LEFT,
        spacing: { after: 180, line: 360 },
        keepLines: true,
      });
    });
}

function definitionTermParagraphs(content: string): Paragraph[] {
  return content
    .split(/\r?\n+/)
    .map(removeEntryMarker)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.{1,100}?)(?::|\s+[-–—]\s+)\s*(.+)$/);
      const children = match
        ? [
            new TextRun({ text: `${match[1].trim()}:`, font: FONT, size: BODY_SIZE, bold: true, color: "000000" }),
            new TextRun({ text: ` ${match[2].trim()}`, font: FONT, size: BODY_SIZE, color: "000000" }),
          ]
        : [new TextRun({ text: line, font: FONT, size: BODY_SIZE, color: "000000" })];
      return new Paragraph({
        children,
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 180, line: 360 },
        keepLines: true,
      });
    });
}

function footer(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: BODY_SIZE, color: "000000" })],
      }),
    ],
  });
}

function getContent(project: ExportProject, heading: string): string {
  return project.sections.find((section) => section.heading === heading)?.content ?? "";
}

function formattedSectionContent(project: ExportProject, heading: string, content: string): string {
  const resolved = resolveCitationMarkers(content, project.references ?? []);
  return formatProposalSectionContent(normalizeTemplateHeading(heading), resolved.content);
}

function sectionHeading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2, pageBreakBefore = false): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    pageBreakBefore,
    keepNext: true,
    spacing: { before: 240, after: 120, line: 360 },
  });
}

function withoutRepeatedHeading(content: string, heading: string): string {
  const lines = content.trim().split(/\r?\n/);
  if (lines[0]?.trim().toLowerCase() === heading.trim().toLowerCase()) return lines.slice(1).join("\n").trim();
  return content.trim();
}

function money(value: number): string {
  return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function tableCell(
  text: string,
  bold = false,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
): TableCell {
  return new TableCell({
    margins: { top: 90, bottom: 90, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment,
        spacing: { after: 0, line: 300 },
        children: [new TextRun({ text, font: FONT, size: 20, bold, color: "000000" })],
      }),
    ],
  });
}

function budgetTable(project: ExportProject): Table {
  const items = project.budgetItems ?? [];
  const rows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        tableCell("Item description", true),
        tableCell("Quantity", true, AlignmentType.RIGHT),
        tableCell("Unit cost (KSh)", true, AlignmentType.RIGHT),
        tableCell("Total cost (KSh)", true, AlignmentType.RIGHT),
      ],
    }),
    ...items.map((item) => new TableRow({
      cantSplit: true,
      children: [
        tableCell(item.item),
        tableCell(String(item.quantity), false, AlignmentType.RIGHT),
        tableCell(money(item.unitCost), false, AlignmentType.RIGHT),
        tableCell(money(item.quantity * item.unitCost), false, AlignmentType.RIGHT),
      ],
    })),
    new TableRow({
      cantSplit: true,
      children: [
        tableCell("Grand total", true),
        tableCell("", true),
        tableCell("", true),
        tableCell(money(items.reduce((total, item) => total + item.quantity * item.unitCost, 0)), true, AlignmentType.RIGHT),
      ],
    }),
  ];
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4800, 1000, 1780, 1780],
    borders: lineBorders,
  });
}

function addMonths(value: string, offset: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function workPlanTable(project: ExportProject): Table {
  const duration = project.workPlanDurationMonths ?? 6;
  const phases = [
    { activity: "Proposal refinement and supervisor review", start: 0, end: 0.18 },
    { activity: "Institutional and ethics permissions", start: 0.12, end: 0.36 },
    { activity: "Pre-test the data collection tool", start: 0.30, end: 0.44 },
    { activity: "Collect study data", start: 0.42, end: 0.70 },
    { activity: "Clean, code, and analyse data", start: 0.68, end: 0.84 },
    { activity: "Write, revise, and submit the report", start: 0.82, end: 1 },
  ];
  const rows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [tableCell("Activity", true), tableCell("Start", true), tableCell("Finish", true)],
    }),
    ...phases.map((phase) => {
      const startMonth = Math.min(duration, Math.floor(phase.start * duration) + 1);
      const endMonth = Math.min(duration, Math.max(startMonth, Math.ceil(phase.end * duration)));
      return new TableRow({
        cantSplit: true,
        children: [
          tableCell(phase.activity),
          tableCell(`Month ${startMonth} (${addMonths(project.workPlanStartDate!, startMonth - 1)})`),
          tableCell(`Month ${endMonth} (${addMonths(project.workPlanStartDate!, endMonth - 1)})`),
        ],
      });
    }),
  ];
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4800, 2280, 2280],
    borders: lineBorders,
  });
}

function frameworkCell(title: string, items: string[]): TableCell {
  return new TableCell({
    margins: { top: 150, bottom: 150, left: 160, right: 160 },
    borders: lineBorders,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: 300 },
        children: [new TextRun({ text: title, font: FONT, size: 22, bold: true, color: "000000" })],
      }),
      ...items.map((item) => new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 90, line: 300 },
        children: [new TextRun({ text: `• ${item}`, font: FONT, size: 20, color: "000000" })],
      })),
    ],
  });
}

function conceptualFrameworkTable(project: ExportProject): Table {
  const factors = project.specificObjectives
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*(?:\d+[\.\)]|[ivx]+[\.\)]|[-*])\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const outcome = project.broadObjective.trim().replace(/^\s*(?:to\s+)?/i, "");
  return new Table({
    rows: [new TableRow({
      cantSplit: true,
      children: [
        frameworkCell("Independent variables", factors.length ? factors : ["Factors described in the specific objectives"]),
        new TableCell({
          margins: { top: 100, bottom: 100, left: 60, right: 60 },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 140 },
            children: [new TextRun({ text: "→", font: FONT, size: 32, bold: true, color: "000000" })],
          })],
        }),
        frameworkCell("Dependent variable / study outcome", [outcome || project.title]),
      ],
    })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4200, 960, 4200],
    borders: lineBorders,
  });
}

function citedReferences(project: ExportProject) {
  const citations = project.references ?? [];
  const used = new Set(project.sections.flatMap((section) => [
    ...resolveCitationMarkers(section.content, citations).citationIds,
  ]));
  return citations
    .filter((citation) => used.has(citation.id))
    .sort((a, b) =>
      (a.authors[0]?.lastName ?? "").localeCompare(b.authors[0]?.lastName ?? "") ||
      a.year - b.year ||
      a.title.localeCompare(b.title),
    );
}

function referenceParagraph(citation: NonNullable<ExportProject["references"]>[number]): Paragraph {
  return new Paragraph({
    children: formatBibliographicReferenceParts(citation).map((part) =>
      new TextRun({
        text: part.text,
        font: FONT,
        size: BODY_SIZE,
        color: "000000",
        italics: part.italic ?? false,
      }),
    ),
    alignment: AlignmentType.LEFT,
    spacing: { after: 180, line: 360 },
    indent: { hanging: 360, left: 720 },
    keepLines: true,
  });
}

export async function createProposalDocx(project: ExportProject): Promise<Blob> {
  const problems = validateProposalForExport(project);
  if (problems.length) throw new Error(`Complete these items before exporting:\n• ${problems.join("\n• ")}`);
  const title = project.title.trim().toUpperCase() || "RESEARCH PROPOSAL";
  const cover = [
    centered(title, true, 40),
    centered("", true),
    centered("BY", true),
    centered(`NAME: ${project.studentName.trim().toUpperCase()}`, true),
    centered(`ADMISSION: ${project.admissionNumber.trim().toUpperCase()}`, true),
    centered("", true),
    centered(
      `A RESEARCH PROPOSAL SUBMITTED TO THE DEPARTMENT OF ${project.department} IN PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE AWARD IN ${project.course}`.toUpperCase(),
      true,
    ),
    centered("", true),
    centered("KENYA MEDICAL TRAINING COLLEGE", true),
    centered("P.O BOX 30195-00100", true),
    centered("NAIROBI", true),
    centered(`${new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(new Date()).toUpperCase()}, ${new Date().getUTCFullYear()}.`, true),
  ];

  const front: (Paragraph | TableOfContents)[] = [];
  const frontHeadings = [
    "Certification",
    "Declaration",
    "Dedication",
    "Acknowledgment",
    "Table of Contents",
    "List of Abbreviations and Acronyms",
    "Definition of Terms",
    "Abstract",
  ];
  for (const heading of frontHeadings) {
    front.push(
      new Paragraph({
        text: heading,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
      }),
    );
    if (heading === "Table of Contents") {
      front[front.length - 1] = new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
        keepNext: true,
        spacing: { before: 180, after: 220, line: 360 },
        children: [new TextRun({ text: "TABLE OF CONTENTS", font: FONT, size: 32, bold: true, color: "000000" })],
      });
      front.push(new TableOfContents("Table of Contents", {
        headingStyleRange: "1-3",
        hyperlink: true,
      }));
      continue;
    }
    if (heading === "Certification") {
      front.push(...bodyParagraphs(`This research proposal has been read and is recommended for consideration by the internal supervisor named below.`));
      front.push(paragraph("Submitted by:"));
      front.push(paragraph(`Name: ${project.studentName}`));
      front.push(paragraph(`Admission: ${project.admissionNumber}`));
      front.push(paragraph("Student signature ______________________________   Date ______________________________"));
      front.push(paragraph(`Internal supervisor: ${project.supervisorName}`));
      front.push(paragraph("SIGNATURE ______________________________   DATE ______________________________"));
      continue;
    }
    if (heading === "Declaration") {
      front.push(...bodyParagraphs(`I declare that this research proposal is my original work and has not been presented for an academic qualification at another institution.`));
      front.push(paragraph(`Researcher: ${project.studentName}`));
      front.push(paragraph("Student signature ______________________________   Date ______________________________"));
      continue;
    }
    const content = formattedSectionContent(project, heading, getContent(project, heading));
    if (heading === "List of Abbreviations and Acronyms") {
      front.push(...abbreviationParagraphs(content));
    } else if (heading === "Definition of Terms") {
      front.push(...definitionTermParagraphs(content));
    } else {
      front.push(...bodyParagraphs(content));
    }
  }

  const body: (Paragraph | Table)[] = [];
  for (const section of project.sections) {
    const sourceHeading = section.heading;
    const heading = normalizeTemplateHeading(sourceHeading);
    const isContainerHeading =
      sourceHeading === "Chapter One" ||
      sourceHeading.startsWith("Chapter Two") ||
      sourceHeading.startsWith("Chapter Three") ||
      sourceHeading === "Appendices";
    if (
      [
        "Cover page",
        ...frontHeadings,
        "Appendices",
      ].includes(sourceHeading)
    ) continue;
    const isMajorHeading = sourceHeading === "Chapter One" || sourceHeading.startsWith("Chapter Two") ||
      sourceHeading.startsWith("Chapter Three") || sourceHeading === "References" || sourceHeading.startsWith("Appendix");
    if (isMajorHeading) body.push(sectionHeading(heading, HeadingLevel.HEADING_1, true));
    else if (!isContainerHeading) body.push(sectionHeading(heading, HeadingLevel.HEADING_2));

    if (sourceHeading === "3.8 Sample size determination") {
      body.push(...bodyParagraphs(sampleSizeSectionText({
        confidenceLevel: project.confidenceLevel ?? 95,
        proportionEstimate: project.proportionEstimate ?? 50,
        marginOfError: project.marginOfError ?? 5,
        populationSize: project.populationSize,
        nonresponseRate: project.nonresponseRate ?? 10,
      })));
    } else if (sourceHeading === "References") {
      const references = citedReferences(project);
      for (const reference of references) {
        body.push(referenceParagraph(reference));
      }
    } else if (sourceHeading === "Appendix II: Budget") {
      body.push(paragraph("For each budget item, line total = quantity × unit cost. The grand total is the sum of all line totals. These values use the costs entered in Project details."));
      body.push(budgetTable(project));
    } else if (sourceHeading === "Appendix III: Work Plan") {
      body.push(paragraph(`Indicative schedule beginning ${addMonths(project.workPlanStartDate!, 0)} and spanning ${project.workPlanDurationMonths} months.`));
      body.push(workPlanTable(project));
    } else if (sourceHeading === "Appendix IV: Map of the Study Area") {
      const image = new Uint8Array(await project.mapImage!.arrayBuffer());
      body.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
        keepNext: true,
        children: [new ImageRun({ data: image, type: "png", transformation: { width: 624, height: 416 } })],
      }));
      body.push(paragraph(`Map location: ${project.mapPoint!.label}. Map data © OpenStreetMap contributors.`));
    } else if (sourceHeading === "1.12 Conceptual framework") {
      const content = formattedSectionContent(project, sourceHeading, section.content);
      body.push(...bodyParagraphs(withoutRepeatedHeading(content, heading)));
      body.push(new Paragraph({
        keepNext: true,
        children: [new TextRun({
          text: "Figure 1. Conceptual framework showing the relationship between the study factors and outcome.",
          font: FONT,
          size: BODY_SIZE,
          color: "000000",
        })],
      }));
      body.push(conceptualFrameworkTable(project));
    } else if (!isContainerHeading) {
      const content = formattedSectionContent(project, sourceHeading, section.content);
      body.push(...bodyParagraphs(content));
    }
  }

  const doc = new Document({
    creator: "SASYNA – The World of Research",
    title: project.title,
    description: "KMTC research proposal with APA 7 citations linked to scholarly catalog records.",
    features: { updateFields: true },
    pageNumbers: estimatePageNumbersWith({ guess: true }),
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE, color: "000000" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: FONT, size: BODY_SIZE, color: "000000" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 180, line: 360 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, size: 32, bold: true, color: "000000" },
          paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 360, after: 180, line: 360 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, size: 28, bold: true, color: "000000" },
          paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 240, after: 120, line: 360 }, keepNext: true },
        },
        {
          id: "TOC1",
          name: "TOC 1",
          run: { font: FONT, size: BODY_SIZE, color: "000000" },
          paragraph: { spacing: { after: 80, line: 360 } },
        },
        {
          id: "TOC2",
          name: "TOC 2",
          run: { font: FONT, size: BODY_SIZE, color: "000000" },
          paragraph: { spacing: { after: 60, line: 360 }, indent: { left: 360 } },
        },
        {
          id: "TOC3",
          name: "TOC 3",
          run: { font: FONT, size: BODY_SIZE, color: "000000" },
          paragraph: { spacing: { after: 40, line: 360 }, indent: { left: 720 } },
        },
      ],
    },
    sections: [
      {
        properties: { page, type: SectionType.NEXT_PAGE },
        children: cover,
      },
      {
        properties: {
          page: {
            ...page,
            pageNumbers: { start: 1, formatType: "lowerRoman" },
          },
          type: SectionType.NEXT_PAGE,
        },
        footers: { default: footer() },
        children: front,
      },
      {
        properties: {
          page: {
            ...page,
            pageNumbers: { start: 1, formatType: "decimal" },
          },
          type: SectionType.NEXT_PAGE,
        },
        footers: { default: footer() },
        children: body.length ? body : [paragraph("Proposal content is empty.")],
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
