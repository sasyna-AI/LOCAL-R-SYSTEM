export type ProposalSection = {
  id: string;
  heading: string;
  content: string;
  citationIds?: string[];
};

export type CitationAuthor = {
  lastName: string;
  initials?: string;
  firstName?: string;
};

export type VerifiedCitation = {
  id: string;
  title: string;
  authors: CitationAuthor[];
  year: number;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  abstract?: string;
  sourceUrl: string;
  source: "Europe PMC" | "Crossref";
};

export type BudgetLineItem = {
  item: string;
  quantity: number;
  unitCost: number;
};

export type StudyAreaPoint = {
  latitude: number;
  longitude: number;
  label: string;
};

export type ResearchProject = {
  id: string;
  title: string;
  documentType: string;
  course: string;
  department: string;
  studentName: string;
  admissionNumber: string;
  studyLocation: string;
  targetPages: number;
  researchQuestions: string;
  broadObjective: string;
  specificObjectives: string;
  status: string;
  updatedAt: string;
  sections: ProposalSection[];
  supervisorName?: string;
  studyDesign?: string;
  targetPopulation?: string;
  studyPeriodStart?: string;
  studyPeriodEnd?: string;
  confidenceLevel?: 90 | 95 | 99;
  proportionEstimate?: number;
  marginOfError?: number;
  populationSize?: number;
  nonresponseRate?: number;
  budgetItems?: BudgetLineItem[];
  workPlanStartDate?: string;
  workPlanDurationMonths?: number;
  mapPoint?: StudyAreaPoint;
  mapImage?: Blob;
  mapZoom?: number;
  references?: VerifiedCitation[];
};
