/**
 * Clawra Video - Selfie Video Generation for OpenClaw
 *
 * Generates short videos using SeedanceAPI (Seedance 2.0)
 * and sends them to messaging channels via OpenClaw.
 *
 * Usage:
 *   npx ts-node clawra-video.ts "<prompt>" "<channel>" ["<caption>"] ["<aspect_ratio>"] ["<duration>"]
 *
 * Environment variables:
 *   SEEDANCE_API_KEY       - Your SeedanceAPI key
 *   OPENCLAW_GATEWAY_URL   - OpenClaw gateway URL (default: http://localhost:18789)
 *   OPENCLAW_GATEWAY_TOKEN - Gateway auth token (optional)
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Types ───────────────────────────────────────────────────────────────────

type AspectRatio = "16:9" | "9:16" | "4:3" | "3:4" | "21:9" | "1:1";
type Resolution = "720p" | "1080p" | "2k";

interface SeedanceGenerateInput {
  prompt: string;
  aspect_ratio?: AspectRatio;
  resolution?: Resolution;
  duration?: string; // "5" to "15"
  image_url?: string; // optional: reference image for image-to-video
}

interface SeedanceGenerateResponse {
  id: string;
  status: string;
  [key: string]: unknown;
}

interface SeedanceStatusResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  video?: {
    url: string;
    duration?: number;
  };
  data?: {
    url: string;
    task_id?: string;
    has_audio?: boolean;
  };
  error?: string | null;
  meta?: {
    usage?: {
      tokens_used?: number;
    };
  };
}

interface OpenClawMessage {
  action: "send";
  channel: string;
  message: string;
  media?: string;
}

interface GenerateAndSendOptions {
  prompt: string;
  channel: string;
  caption?: string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  duration?: string;
  imageUrl?: string; // reference image for image-to-video mode
  useClaudeCodeCLI?: boolean;
}

interface Result {
  success: boolean;
  videoUrl: string;
  channel: string;
  prompt: string;
  taskId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SEEDANCE_API_BASE = "https://seedanceapi.org/v1";
const REFERENCE_IMAGE =
  "https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png";

const POLL_INTERVAL_MS = 5000; // 5 seconds between polls
const MAX_POLL_DURATION_MS = 300000; // 5 minutes max wait

// ─── Video Generation ────────────────────────────────────────────────────────

/**
 * Submit a video generation task to SeedanceAPI
 */
async function submitVideoTask(
  input: SeedanceGenerateInput
): Promise<SeedanceGenerateResponse> {
  const apiKey = process.env.SEEDANCE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SEEDANCE_API_KEY environment variable not set. Get your key from https://seedanceapi.org"
    );
  }

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspect_ratio || "9:16",
    resolution: input.resolution || "720p",
    duration: input.duration || "5",
  };

  // If reference image provided, use image-to-video mode
  if (input.image_url) {
    body.image_url = input.image_url;
  }

  const response = await fetch(`${SEEDANCE_API_BASE}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Video generation submission failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Poll for video generation completion
 */
async function pollForCompletion(taskId: string): Promise<string> {
  const apiKey = process.env.SEEDANCE_API_KEY;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
    console.log(`[INFO] Polling task ${taskId}...`);

    const response = await fetch(`${SEEDANCE_API_BASE}/tasks/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Status check failed (${response.status}): ${error}`);
    }

    const data: SeedanceStatusResponse = await response.json();

    if (data.status === "completed") {
      // Handle both possible response shapes
      const videoUrl = data.video?.url || data.data?.url;
      if (!videoUrl) {
        throw new Error("Video completed but no URL found in response");
      }
      return videoUrl;
    }

    if (data.status === "failed") {
      throw new Error(`Video generation failed: ${data.error || "Unknown error"}`);
    }

    // Still processing, wait and retry
    console.log(`[INFO] Status: ${data.status} — waiting ${POLL_INTERVAL_MS / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Video generation timed out after ${MAX_POLL_DURATION_MS / 1000}s`);
}

/**
 * Generate video: submit task + poll for completion
 */
async function generateVideo(input: SeedanceGenerateInput): Promise<string> {
  console.log(`[INFO] Submitting video generation task...`);
  const task = await submitVideoTask(input);

  const taskId = task.id;
  if (!taskId) {
    throw new Error("No task ID returned from SeedanceAPI");
  }

  console.log(`[INFO] Task submitted: ${taskId}`);
  console.log(`[INFO] Polling for completion (this may take 60-120s)...`);

  return pollForCompletion(taskId);
}

// ─── OpenClaw Sending ────────────────────────────────────────────────────────

/**
 * Send video via OpenClaw
 */
async function sendViaOpenClaw(
  message: OpenClawMessage,
  useCLI: boolean = true
): Promise<void> {
  if (useCLI) {
    const cmd = `openclaw message send --action send --channel "${message.channel}" --message "${message.message}" --media "${message.media}"`;
    await execAsync(cmd);
    return;
  }

  // Direct API call
  const gatewayUrl =
    process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (gatewayToken) {
    headers["Authorization"] = `Bearer ${gatewayToken}`;
  }

  const response = await fetch(`${gatewayUrl}/message`, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenClaw send failed: ${error}`);
  }
}

// ─── Prompt Construction ─────────────────────────────────────────────────────

type VideoMode = "action" | "scene" | "auto";

function detectMode(userContext: string): "action" | "scene" {
  const actionKeywords =
    /dancing|waving|walking|running|laughing|singing|cooking|playing|stretching|working|typing/i;
  const sceneKeywords =
    /cafe|restaurant|beach|park|city|mountain|sunset|sunrise|office|street|room|studio|garden/i;

  if (actionKeywords.test(userContext)) return "action";
  if (sceneKeywords.test(userContext)) return "scene";
  return "action"; // default
}

function buildVideoPrompt(userContext: string, mode: "action" | "scene"): string {
  if (mode === "scene") {
    return `A cinematic short video of a young woman at ${userContext}, natural movement, looking at the camera with a warm smile, smooth camera motion, soft natural lighting, high quality`;
  }
  return `A cinematic short video of a young woman ${userContext}, natural and fluid motion, dynamic camera angle, warm color grading, high quality`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Main function: Generate video and send to channel
 */
async function generateAndSend(
  options: GenerateAndSendOptions
): Promise<Result> {
  const {
    prompt,
    channel,
    caption = "Here's a video for you!",
    aspectRatio = "9:16",
    resolution = "720p",
    duration = "5",
    imageUrl,
    useClaudeCodeCLI = true,
  } = options;

  console.log(`[INFO] Generating video with SeedanceAPI...`);
  console.log(`[INFO] Prompt: ${prompt}`);
  console.log(`[INFO] Aspect ratio: ${aspectRatio}, Duration: ${duration}s`);

  // Generate video (submit + poll)
  const videoUrl = await generateVideo({
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    duration,
    image_url: imageUrl,
  });

  console.log(`[INFO] Video ready: ${videoUrl}`);

  // Send via OpenClaw
  console.log(`[INFO] Sending to channel: ${channel}`);

  await sendViaOpenClaw(
    {
      action: "send",
      channel,
      message: caption,
      media: videoUrl,
    },
    useClaudeCodeCLI
  );

  console.log(`[INFO] Done! Video sent to ${channel}`);

  return {
    success: true,
    videoUrl,
    channel,
    prompt,
    taskId: "",
  };
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: npx ts-node clawra-video.ts <prompt> <channel> [caption] [aspect_ratio] [duration]

Arguments:
  prompt        - Video description (required)
  channel       - Target channel (required) e.g., #general, @user, 1234567890@s.whatsapp.net
  caption       - Message caption (default: 'Here\\'s a video for you!')
  aspect_ratio  - Video ratio (default: 9:16) Options: 16:9, 9:16, 4:3, 1:1
  duration      - Video length in seconds (default: 5) Range: 5-15

Environment:
  SEEDANCE_API_KEY - Your SeedanceAPI key (required)

Example:
  SEEDANCE_API_KEY=your_key npx ts-node clawra-video.ts "dancing in the rain" "#general" "Check this out!"
`);
    process.exit(1);
  }

  const [prompt, channel, caption, aspectRatio, duration] = args;

  try {
    const result = await generateAndSend({
      prompt,
      channel,
      caption,
      aspectRatio: (aspectRatio as AspectRatio) || "9:16",
      duration: duration || "5",
    });

    console.log("\n--- Result ---");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}`);
    process.exit(1);
  }
}

// Exports
export {
  generateVideo,
  sendViaOpenClaw,
  generateAndSend,
  buildVideoPrompt,
  detectMode,
  SeedanceGenerateInput,
  SeedanceStatusResponse,
  OpenClawMessage,
  GenerateAndSendOptions,
  Result,
};

// Run if executed directly
if (require.main === module) {
  main();
}
