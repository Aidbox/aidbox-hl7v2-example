/**
 * Tests for Pagination Utilities
 *
 * Tests the shared pagination module used across pages.
 */
import { describe, test, expect } from "bun:test";
import {
  PAGE_SIZE,
  calculateTotalPages,
  parsePageParam,
  clampPage,
  createPagination,
  renderPaginationControls,
} from "../../../src/ui/pagination";

describe("Pagination Utilities", () => {
  test("PAGE_SIZE is 50", () => {
    expect(PAGE_SIZE).toBe(50);
  });

  describe("parsePageParam", () => {
    test("returns 1 when _page is not present", () => {
      const params = new URLSearchParams();
      expect(parsePageParam(params)).toBe(1);
    });

    test("returns parsed number when _page is present", () => {
      const params = new URLSearchParams("_page=5");
      expect(parsePageParam(params)).toBe(5);
    });

    test("returns NaN for non-numeric _page", () => {
      const params = new URLSearchParams("_page=abc");
      expect(parsePageParam(params)).toBeNaN();
    });
  });

  describe("calculateTotalPages", () => {
    test("returns 0 for 0 items", () => {
      expect(calculateTotalPages(0)).toBe(0);
    });

    test("returns 1 for items <= PAGE_SIZE", () => {
      expect(calculateTotalPages(1)).toBe(1);
      expect(calculateTotalPages(50)).toBe(1);
    });

    test("returns correct pages for items > PAGE_SIZE", () => {
      expect(calculateTotalPages(51)).toBe(2);
      expect(calculateTotalPages(100)).toBe(2);
      expect(calculateTotalPages(101)).toBe(3);
    });
  });

  describe("clampPage", () => {
    test("returns 1 for page < 1", () => {
      expect(clampPage(0, 5)).toBe(1);
      expect(clampPage(-1, 5)).toBe(1);
      expect(clampPage(-100, 5)).toBe(1);
    });

    test("returns 1 for NaN", () => {
      expect(clampPage(NaN, 5)).toBe(1);
    });

    test("returns totalPages for page > totalPages", () => {
      expect(clampPage(10, 5)).toBe(5);
      expect(clampPage(100, 3)).toBe(3);
    });

    test("returns page when within bounds", () => {
      expect(clampPage(1, 5)).toBe(1);
      expect(clampPage(3, 5)).toBe(3);
      expect(clampPage(5, 5)).toBe(5);
    });

    test("handles edge case of 0 totalPages", () => {
      expect(clampPage(1, 0)).toBe(1);
      expect(clampPage(5, 0)).toBe(1);
    });
  });

  describe("createPagination", () => {
    test("creates pagination data from rawPage and total", () => {
      const pagination = createPagination(2, 150);
      expect(pagination.currentPage).toBe(2);
      expect(pagination.total).toBe(150);
      expect(pagination.totalPages).toBe(3);
    });

    test("clamps page to valid range", () => {
      const pagination = createPagination(10, 100);
      expect(pagination.currentPage).toBe(2); // 100 items = 2 pages, so page 10 clamps to 2
      expect(pagination.totalPages).toBe(2);
    });

    test("handles page 0 or negative", () => {
      const pagination = createPagination(0, 100);
      expect(pagination.currentPage).toBe(1);
    });

    test("handles empty results", () => {
      const pagination = createPagination(1, 0);
      expect(pagination.currentPage).toBe(1);
      expect(pagination.total).toBe(0);
      expect(pagination.totalPages).toBe(0);
    });
  });

  describe("renderPaginationControls", () => {
    test("returns empty string when totalPages <= 1", () => {
      expect(
        renderPaginationControls({
          pagination: { currentPage: 1, total: 0, totalPages: 0 },
          baseUrl: "/test",
        }),
      ).toBe("");

      expect(
        renderPaginationControls({
          pagination: { currentPage: 1, total: 50, totalPages: 1 },
          baseUrl: "/test",
        }),
      ).toBe("");
    });

    test("shows pagination controls when totalPages > 1", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 1, total: 100, totalPages: 2 },
        baseUrl: "/test",
      });

      expect(html).toContain(">First</span>");
      expect(html).toContain(">Prev</span>");
      expect(html).toContain(">Next</a>");
      expect(html).toContain(">Last</a>");
      expect(html).toContain("1 / 2");
    });

    test("renders First/Prev as non-clickable spans on page 1", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 1, total: 150, totalPages: 3 },
        baseUrl: "/test",
      });

      // First and Prev should be spans (not links) on page 1
      expect(html).toContain(
        '<span class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed">First</span>',
      );
      expect(html).toContain(
        '<span class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed">Prev</span>',
      );

      // Should NOT have href links to page 0
      expect(html).not.toContain("_page=0");
    });

    test("renders Next/Last as non-clickable spans on last page", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 3, total: 150, totalPages: 3 },
        baseUrl: "/test",
      });

      // Next and Last should be spans (not links) on last page
      expect(html).toContain(
        '<span class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed">Next</span>',
      );
      expect(html).toContain(
        '<span class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed">Last</span>',
      );

      // Should NOT have href links beyond last page
      expect(html).not.toContain("_page=4");
    });

    test("renders all buttons as clickable links on middle page", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 2, total: 150, totalPages: 3 },
        baseUrl: "/test",
      });

      expect(html).toContain("2 / 3");
      expect(html).toContain(">First</a>");
      expect(html).toContain(">Prev</a>");
      expect(html).toContain(">Next</a>");
      expect(html).toContain(">Last</a>");
    });

    test("generates correct page links", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 2, total: 200, totalPages: 4 },
        baseUrl: "/test",
      });

      // First -> page 1
      expect(html).toContain('href="/test?_page=1"');
      // Prev -> page 1
      expect(html).toContain('href="/test?_page=1"');
      // Next -> page 3
      expect(html).toContain('href="/test?_page=3"');
      // Last -> page 4
      expect(html).toContain('href="/test?_page=4"');
    });

    test("preserves filter params in pagination links", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 2, total: 150, totalPages: 3 },
        baseUrl: "/mapping/tasks",
        filterParams: { status: "requested" },
      });

      expect(html).toContain("_page=1");
      expect(html).toContain("status=requested");
    });

    test("preserves multiple filter params", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 2, total: 150, totalPages: 3 },
        baseUrl: "/invoices",
        filterParams: { "processing-status": "pending", sort: "date" },
      });

      expect(html).toContain("processing-status=pending");
      expect(html).toContain("sort=date");
    });

    test("works without filter params", () => {
      const html = renderPaginationControls({
        pagination: { currentPage: 1, total: 100, totalPages: 2 },
        baseUrl: "/test",
      });

      expect(html).toContain('href="/test?_page=2"');
      expect(html).not.toContain("undefined");
    });
  });
});
