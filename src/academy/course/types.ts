/** Course content types (see scripts/convert-course.mjs). */

export type InlineMark =
  | { t: 'text' | 'strong' | 'em' | 'var' | 'nowrap'; text: string }
  | { t: 'gloss'; text: string; key: string };

export type Block =
  | { t: 'p'; marks: InlineMark[] }
  | { t: 'h'; text: string }
  | { t: 'figure'; caption: string }
  | { t: 'takeaways'; items: InlineMark[][] };

export interface QuizQuestion {
  q: InlineMark[];
  options: InlineMark[][];
  correct: number;
  explanation: InlineMark[];
}

export interface Lab {
  goal: InlineMark[];
  equipment: InlineMark[][];
  components: InlineMark[][];
  steps: InlineMark[][];
  expected: InlineMark[] | null;
  connection: InlineMark[] | null;
  trouble: InlineMark[][];
}

export interface Chapter {
  id: string;
  part: number;
  title: string;
  blocks: Block[];
  lab: Lab | null;
  quiz: QuizQuestion[];
}

export interface GlossaryEntry {
  tip: string;
  detail: string;
  unit?: string;
  formula?: string;
  see?: string[];
}

export type GlossaryMap = Record<string, GlossaryEntry>;
