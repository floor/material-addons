// src/components/paginator/types.ts

/** The slice the paginator describes: the rows of one page within a total. */
export interface PaginatorRange {
  start: number;
  end: number;
  total: number;
  page: number;
  pageSize: number;
}

/** The vetoable proposal a user interaction makes, before the model commits. */
export interface PaginatorBeforeChangeEvent {
  page: number;
  pageSize: number;
  previousPage: number;
  previousPageSize: number;
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

/** The committed model after a user interaction. */
export interface PaginatorChangeEvent {
  page: number;
  pageSize: number;
  previousPage: number;
  previousPageSize: number;
}

export interface PaginatorEvents {
  beforechange: (event: PaginatorBeforeChangeEvent) => void;
  change: (event: PaginatorChangeEvent) => void;
}

export interface PaginatorConfig {
  /** Current page, 1-based. Clamped into 1..pageCount. */
  page?: number;
  /** Rows in one page. Silent writes clamp the page, they do not reset it. */
  pageSize?: number;
  /** Options in the rows-per-page select. */
  pageSizes?: number[];
  /** Full item count, not the count on this page. */
  total?: number;
  /** Shows numbered page buttons between previous and next. */
  numbered?: boolean;
  /** Numbered pages kept on each side of the current page. */
  siblingCount?: number;
  /** Numbered pages kept at the start and at the end. */
  boundaryCount?: number;
  /** First and last buttons, on by default. `<m-paginator no-ends>` opts out. */
  ends?: boolean;
  disabled?: boolean;
  /** The landmark label. Default `Pagination`. */
  ariaLabel?: string;
  /** The rows-per-page label text. Default `Rows per page`. */
  pageSizeLabel?: string;
  firstLabel?: string;
  prevLabel?: string;
  nextLabel?: string;
  lastLabel?: string;
  /** Accessible name for a numbered page button. Default `Page ${page}`. */
  pageLabel?: (page: number) => string;
  /** The range text. Default `${start}–${end} of ${total}`. */
  formatRange?: (range: PaginatorRange) => string;
  /** The shared class hook */
  class?: string;
  componentName?: string;
  onBeforeChange?: PaginatorEvents["beforechange"];
  onChange?: PaginatorEvents["change"];
  on?: Partial<PaginatorEvents>;
}

export interface PaginatorComponent {
  element: HTMLElement;
  /** The rows-per-page select */
  select: HTMLSelectElement;
  /** The live range line */
  range: HTMLElement;
  getPage: () => number;
  setPage: (page: number) => PaginatorComponent;
  getPageSize: () => number;
  setPageSize: (pageSize: number) => PaginatorComponent;
  getPageSizes: () => number[];
  setPageSizes: (pageSizes: number[]) => PaginatorComponent;
  getTotal: () => number;
  setTotal: (total: number) => PaginatorComponent;
  getPageCount: () => number;
  getRange: () => PaginatorRange;
  /** The guarded move: emits beforechange, then change when it commits. */
  goTo: (page: number) => boolean;
  setNumbered: (numbered: boolean) => PaginatorComponent;
  enable: () => PaginatorComponent;
  disable: () => PaginatorComponent;
  isDisabled: () => boolean;
  on: <K extends keyof PaginatorEvents>(event: K, handler: PaginatorEvents[K]) => PaginatorComponent;
  off: <K extends keyof PaginatorEvents>(event: K, handler: PaginatorEvents[K]) => PaginatorComponent;
  destroy: () => void;
}
