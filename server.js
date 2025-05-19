import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./src/routes/index.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { requestLogger } from "./src/middleware/requestLogger.js";

// Load env variables
dotenv.config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
app.use("/", routes);

// Error handling middleware (Must be after routes)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(
    `${new Date().toLocaleTimeString()}: Server running on port ${PORT}...`
  );
});

// Handle server shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down server...");
  process.exit(0);
});

export default app;
