/**
 * Format a successful response
 * @param {Object} data - Data to include in the response
 * @param {string} message - Descriptive message
 * @param {number} statusCode - HTTP status code (default 200)
 */
export const formatSuccess = (
  data,
  message = "Operation successful",
  statusCode = 200
) => {
  return {
    status: "success",
    statusCode,
    message,
    data,
  };
};

/**
 * Format an error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {Object} error - Error details (optional)
 */
export const formatError = (
  message = "Internal server error",
  statusCode = 500,
  error = null
) => {
  const response = {
    status: "error",
    statusCode,
    message,
  };

  if (error && process.env.NODE_ENV === "development") {
    response.error = error;
  }

  return response;
};

/**
 * Format a paginated response
 * @param {Array} data - Data to include in the response
 * @param {number} total - Total number of records
 * @param {number} page - Current page
 * @param {number} limit - Records per page
 * @param {string} message - Descriptive message (optional)
 */
export const formatPagination = (
  data,
  total,
  page,
  limit,
  message = "Data retrieved successfully"
) => {
  return {
    status: "success",
    statusCode: 200,
    message,
    results: data.length,
    totalItems: total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    data,
  };
};
