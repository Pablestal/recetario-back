// Error handling middleware
export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.stack);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    status: "error",
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

// Middleware for handling not found routes
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
};
