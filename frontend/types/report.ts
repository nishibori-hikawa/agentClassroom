export interface Source {
  name: string;
  url: string;
}

export interface Thread {
  id: string;
  report?: ReportContent;
}

export interface Point {
  id: string;
  title: string;
  content: string;
  source: Source;
  report_id: string;
  detailedReport?: ReportContent;
}

export interface ReportContent {
  id: string;
  topic: string;
  points: Point[];
  thread_id?: string;
} 