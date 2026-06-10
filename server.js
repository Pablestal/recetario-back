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
const allowedOrigins = [
  "http://localhost:5173",
  "https://recetario-eight.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS not allowed for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
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
