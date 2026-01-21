export const PAGE_SIZE = 50;

export interface PaginationData {
  currentPage: number;
  total: number;
  totalPages: number;
}

export type FilterParams = Record<string, string | undefined>;

export interface PaginationOptions {
  pagination: PaginationData;
  baseUrl: string;
  filterParams?: FilterParams;
}

export function calculateTotalPages(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

export function parsePageParam(searchParams: URLSearchParams): number {
  return parseInt(searchParams.get("_page") || "1", 10);
}

export function clampPage(page: number, totalPages: number): number {
  if (isNaN(page) || page < 1) return 1;
  if (totalPages <= 0) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

export function createPagination(
  rawPage: number,
  total: number,
): PaginationData {
  const totalPages = calculateTotalPages(total);
  return {
    currentPage: clampPage(rawPage, totalPages),
    total,
    totalPages,
  };
}

function buildUrl(
  baseUrl: string,
  page: number,
  filterParams?: FilterParams,
): string {
  const params = new URLSearchParams();
  params.set("_page", String(page));
  if (filterParams) {
    for (const [key, value] of Object.entries(filterParams)) {
      if (value) {
        params.set(key, value);
      }
    }
  }
  return `${baseUrl}?${params.toString()}`;
}

export function renderPaginationControls(options: PaginationOptions): string {
  const { pagination, baseUrl, filterParams } = options;
  const { currentPage, totalPages } = pagination;

  if (totalPages <= 1) return "";

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  const disabledClass =
    "px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed";
  const enabledClass =
    "px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300";

  const firstButton = isFirstPage
    ? `<span class="${disabledClass}">First</span>`
    : `<a href="${buildUrl(baseUrl, 1, filterParams)}" class="${enabledClass}">First</a>`;

  const prevButton = isFirstPage
    ? `<span class="${disabledClass}">Prev</span>`
    : `<a href="${buildUrl(baseUrl, currentPage - 1, filterParams)}" class="${enabledClass}">Prev</a>`;

  const nextButton = isLastPage
    ? `<span class="${disabledClass}">Next</span>`
    : `<a href="${buildUrl(baseUrl, currentPage + 1, filterParams)}" class="${enabledClass}">Next</a>`;

  const lastButton = isLastPage
    ? `<span class="${disabledClass}">Last</span>`
    : `<a href="${buildUrl(baseUrl, totalPages, filterParams)}" class="${enabledClass}">Last</a>`;

  return `
    <div class="flex items-center gap-1">
      ${firstButton}
      ${prevButton}
      <span class="px-3 py-1.5 text-sm text-gray-600">${currentPage} / ${totalPages}</span>
      ${nextButton}
      ${lastButton}
    </div>`;
}
