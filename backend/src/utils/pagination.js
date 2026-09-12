'use strict';

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 20;

/**
 * Universal pagination parser and enforcer.
 * Clamps limit between 1 and 100 to prevent unbounded queries.
 *
 * @param {Object} query - Express req.query
 * @param {number} [defaultLimit=20]
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query = {}, defaultLimit = DEFAULT_PAGE_LIMIT) {
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > MAX_PAGE_LIMIT) {
    limit = MAX_PAGE_LIMIT; // Hard cap
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Format pagination metadata for JSON envelope.
 *
 * @param {number} total - Total count of matching records
 * @param {number} page
 * @param {number} limit
 * @returns {{ page: number, limit: number, total: number, totalPages: number, hasNext: boolean, hasPrev: boolean }}
 */
function formatPagination(total, page, limit) {
  const totalPages = Math.ceil(total / limit) || (total > 0 ? 1 : 0);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

module.exports = {
  parsePagination,
  formatPagination,
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
};
