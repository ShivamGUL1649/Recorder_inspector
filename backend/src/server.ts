import express, { Request, Response } from "express";
import cors from "cors";
import recorderRoutes from "./routes/recorder.routes";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

app.use(cors());

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

/**
 * Root API health check
 *
 * GET /
 */
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "AI Playwright Smart Recorder backend is running",
  });
});

/**
 * Backend health check
 *
 * GET /health
 */
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Backend health check passed",
  });
});

/**
 * Recorder route registration
 *
 * This registers:
 * GET  /api/recorder/health
 * POST /api/recorder/start
 * POST /api/recorder/stop
 * GET  /api/recorder/actions
 * POST /api/recorder/start-inspector
 * POST /api/recorder/stop-inspector
 * GET  /api/recorder/inspected-element
 * POST /api/recorder/replay
 */
app.use("/api/recorder", recorderRoutes);

/**
 * API route list for quick verification
 *
 * GET /api
 */
app.get("/api", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API base route is working",
    availableRoutes: [
      "GET /api/recorder/health",
      "POST /api/recorder/start",
      "POST /api/recorder/start-recording",
      "POST /api/recorder/stop",
      "POST /api/recorder/stop-recording",
      "GET /api/recorder/actions",
      "DELETE /api/recorder/actions",
      "POST /api/recorder/clear-actions",
      "POST /api/recorder/start-inspector",
      "POST /api/recorder/stop-inspector",
      "GET /api/recorder/inspected-element",
      "POST /api/recorder/replay",
    ],
  });
});

/**
 * 404 fallback
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log(`Backend health: http://localhost:${PORT}/health`);
  console.log(`Recorder health: http://localhost:${PORT}/api/recorder/health`);
  console.log(
    `Inspector route: POST http://localhost:${PORT}/api/recorder/start-inspector`
  );
});