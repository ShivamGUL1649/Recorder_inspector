import { Router } from "express";
import {
  startRecordingHandler,
  stopRecordingHandler,
  getRecordedActionsHandler,
  clearRecordedActionsHandler,
  replayRecordedActionsHandler,
  startInspectorHandler,
  stopInspectorHandler,
  getInspectedElementHandler,
} from "../recorder/recorder.service";

const router = Router();

/**
 * Health check route.
 * Use this to confirm recorder routes are registered correctly.
 *
 * GET /api/recorder/health
 */
router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Recorder routes are registered successfully",
  });
});

/**
 * Recording routes
 *
 * POST /api/recorder/start
 * POST /api/recorder/start-recording
 */
router.post("/start", startRecordingHandler);
router.post("/start-recording", startRecordingHandler);

/**
 * Stop recording routes
 *
 * POST /api/recorder/stop
 * POST /api/recorder/stop-recording
 */
router.post("/stop", stopRecordingHandler);
router.post("/stop-recording", stopRecordingHandler);

/**
 * Recorded actions routes
 *
 * GET    /api/recorder/actions
 * DELETE /api/recorder/actions
 * POST   /api/recorder/clear-actions
 */
router.get("/actions", getRecordedActionsHandler);
router.delete("/actions", clearRecordedActionsHandler);
router.post("/clear-actions", clearRecordedActionsHandler);

/**
 * Replay route
 *
 * POST /api/recorder/replay
 */
router.post("/replay", replayRecordedActionsHandler);

/**
 * Smart Inspector routes
 *
 * POST /api/recorder/start-inspector
 * POST /api/recorder/stop-inspector
 * GET  /api/recorder/inspected-element
 */
router.post("/start-inspector", startInspectorHandler);
router.post("/stop-inspector", stopInspectorHandler);
router.get("/inspected-element", getInspectedElementHandler);

export default router;