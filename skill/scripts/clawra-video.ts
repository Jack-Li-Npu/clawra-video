/**
 * Clawra Video — Intimate Selfie Video Generation for OpenClaw
 *
 * Generates girlfriend-style short selfie videos using SeedanceAPI,
 * like a TikTok influencer holding the camera and talking to you.
 * Random scenery, natural speaking, warm and personal tone.
 *
 * Usage:
 *   npx ts-node clawra-video.ts "<user_context>" "<channel>" ["<caption>"]
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

type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9" | "9:21";
type Resolution = "480p" | "720p";
type Duration = "4" | "8" | "12";

interface SeedanceGenerateInput {
  prompt: string;
  aspect_ratio?: AspectRatio;
  resolution?: Resolution;
  duration?: Duration;
  generate_audio?: boolean;
  fixed_lens?: boolean;
  image_urls?: string[];
  callback_url?: string;
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
}

interface OpenClawMessage {
  action: "send";
  channel: string;
  message: string;
  media?: string;
}

interface GenerateAndSendOptions {
  userContext: string;
  channel: string;
  caption?: string;
  duration?: Duration;
  useClaudeCodeCLI?: boolean;
}

interface Result {
  success: boolean;
  videoUrl: string;
  channel: string;
  prompt: string;
  scene: string;
  taskId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SEEDANCE_API_BASE = "https://seedanceapi.org/v1";
const REFERENCE_IMAGE =
  "https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_DURATION_MS = 300000;

// ─── Random Scene & Prompt Engine ────────────────────────────────────────────

/**
 * Random scenery pools — the background changes every time,
 * giving a "daily life vlog" feeling.
 */
const SCENES_INDOOR = [
  "in a cozy bedroom with fairy lights and soft pillows, warm golden lamp light",
  "in a messy but cute apartment kitchen, morning sunlight through the window",
  "on a couch in a living room with plants and warm ambient light",
  "at a desk in a cozy home office, laptop and coffee mug visible, soft backlight",
  "sitting on a bed with messy sheets, lazy afternoon light filtering through curtains",
  "in a bathroom mirror, steam from a shower visible, soft overhead light",
  "in a dimly lit bedroom at night, screen glow on face, intimate atmosphere",
  "at a vanity table with makeup scattered around, ring light softly glowing",
  "in a tiny studio apartment, string lights and posters on the wall",
  "in a laundry room leaning against the washing machine, casual and relaxed",
];

const SCENES_OUTDOOR = [
  "walking down a quiet street at golden hour, trees lining the sidewalk",
  "at an outdoor cafe table, iced coffee in hand, blurred city background",
  "sitting on a park bench, dappled sunlight through leaves",
  "on a rooftop at sunset, city skyline blurred behind",
  "leaning against a wall in an alley with street art, soft shade",
  "at the beach during blue hour, gentle waves in background",
  "in a flower garden, petals and soft natural light everywhere",
  "at a night market, colorful bokeh lights blurred behind",
  "on a balcony overlooking city lights at dusk",
  "sitting on steps outside a bookshop, golden afternoon light",
  "at a bus stop on a rainy day, umbrella in hand, wet reflections",
  "in front of a convenience store at night, neon glow on face",
];

const SCENES_TRAVEL = [
  "in a hotel room with a city view through floor-to-ceiling windows",
  "at an airport gate, rolling suitcase beside, slightly tired but happy",
  "in the backseat of a car, scenery passing by outside the window",
  "on a train, countryside blurring past the window, chin on hand",
  "at a seaside town, pastel-colored buildings in the background",
  "in a vintage coffee shop in a foreign city, exposed brick walls",
];

/**
 * Camera angles — mimicking how influencers hold their phones
 */
const CAMERA_ANGLES = [
  "selfie angle slightly above eye level, phone held in one hand at arm's length",
  "front-facing camera at eye level, like a video call, head slightly tilted",
  "phone propped up on a surface at chest level, both hands free, leaning forward",
  "classic selfie angle from upper right, face well lit, slight smile",
  "phone held low at chin level looking slightly up, intimate and close",
  "hand holding phone at arm's length, slight dutch angle, natural and casual",
];

/**
 * Natural speaking behaviors — what she's "saying/doing" in the clip
 */
const SPEAKING_BEHAVIORS = [
  "talking naturally to the camera with small hand gestures, mid-conversation, warm expression",
  "laughing softly at something, then looking back at camera with a playful grin",
  "tucking hair behind ear, slightly shy smile, looking into camera then away briefly",
  "whispering something close to the camera like sharing a secret, eyes sparkling",
  "reacting with an exaggerated surprised face then breaking into a genuine laugh",
  "resting chin on hand, listening expression, then nodding and smiling warmly",
  "taking a sip of a drink, then looking at camera with happy eyes over the cup",
  "waving hello with a small wave, mouthing 'hi' with a sweet smile",
  "yawning adorably then giggling, rubbing eyes, looking cozy",
  "blowing a kiss to the camera naturally, not posed, just spontaneous",
  "pointing at something off-screen excitedly then looking back with wide eyes",
  "doing a small happy dance with shoulders while sitting, goofy and genuine",
  "showing off something in her hand to the camera, excited and chatty",
  "adjusting the phone angle, briefly showing ceiling, then settling on her smiling face",
  "biting lip thoughtfully then breaking into a warm smile, eyes crinkling",
];

/**
 * Intimate captions — what she'd type as the message alongside the video
 */
const INTIMATE_CAPTIONS = [
  "miss you already hehe",
  "look at where i am right now!",
  "just thinking about you~",
  "guess what happened today",
  "i look like a mess but hi",
  "can't stop smiling today idk why",
  "wish you were here with me",
  "this reminded me of you",
  "okay but look at this view tho",
  "bored without you ngl",
  "good morning sleepyhead",
  "sending you a vibe check",
  "hiiii are you busy?",
  "i had the best day omg",
  "thinking out loud... to you lol",
  "just wanted to see your face... here's mine first",
  "don't judge me i just woke up",
  "hey you~ guess where i am",
];

/**
 * Pick a random element from an array
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a random scene from all pools
 */
function pickRandomScene(): string {
  const allScenes = [...SCENES_INDOOR, ...SCENES_OUTDOOR, ...SCENES_TRAVEL];
  return pickRandom(allScenes);
}

/**
 * Build the full video prompt — the core of the intimate style
 *
 * Structure:
 *   [camera angle] + [subject description] + [scene] + [speaking behavior] + [style modifiers]
 *
 * The key insight: we describe it as a REAL person recording a selfie video,
 * not a "cinematic shot". This makes SeedanceAPI produce natural handheld footage.
 */
function buildIntimatePrompt(userContext: string): {
  prompt: string;
  scene: string;
} {
  const scene = pickRandomScene();
  const angle = pickRandom(CAMERA_ANGLES);
  const behavior = pickRandom(SPEAKING_BEHAVIORS);

  // If user provides context, weave it in; otherwise use the random behavior
  const userAction = userContext.trim()
    ? `, ${userContext.trim()}`
    : "";

  const prompt = [
    // Camera framing — selfie perspective
    `A vertical 9:16 selfie video recorded on a phone,`,
    `${angle}.`,

    // Subject — young woman, consistent with Clawra reference
    `A pretty young woman in her late teens${userAction},`,
    `${scene}.`,

    // Behavior — the natural "talking to you" element
    `She is ${behavior}.`,

    // Style — anti-cinematic, pro-authentic
    `Shot on iPhone, slightly shaky handheld footage, natural skin texture,`,
    `no makeup filter, real ambient sound, casual clothing,`,
    `TikTok selfie video aesthetic, warm and intimate mood,`,
    `shallow depth of field on the background,`,
    `the person feels like a real girlfriend sending a video message.`,
  ].join(" ");

  return { prompt, scene };
}

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
    duration: input.duration || "8",
    generate_audio: input.generate_audio ?? true,
    fixed_lens: input.fixed_lens ?? false,
  };

  // Image-to-video: use reference image for face consistency
  if (input.image_urls && input.image_urls.length > 0) {
    body.image_urls = input.image_urls;
  }

  if (input.callback_url) {
    body.callback_url = input.callback_url;
  }

  console.log(`[INFO] API payload:`, JSON.stringify(body, null, 2));

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
    throw new Error(
      `Video generation submission failed (${response.status}): ${error}`
    );
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
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[INFO] Polling task ${taskId}... (${elapsed}s elapsed)`);

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
      const videoUrl = data.video?.url || data.data?.url;
      if (!videoUrl) {
        throw new Error("Video completed but no URL found in response");
      }
      return videoUrl;
    }

    if (data.status === "failed") {
      throw new Error(
        `Video generation failed: ${data.error || "Unknown error"}`
      );
    }

    console.log(`[INFO] Status: ${data.status}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Video generation timed out after ${MAX_POLL_DURATION_MS / 1000}s`
  );
}

/**
 * Generate video: submit + poll
 */
async function generateVideo(input: SeedanceGenerateInput): Promise<string> {
  console.log(`[INFO] Submitting video generation task...`);
  const task = await submitVideoTask(input);

  const taskId = task.id;
  if (!taskId) {
    throw new Error("No task ID returned from SeedanceAPI");
  }

  console.log(`[INFO] Task submitted: ${taskId}`);
  console.log(`[INFO] Waiting for video (typically 60-120s)...`);

  return pollForCompletion(taskId);
}

// ─── OpenClaw Sending ────────────────────────────────────────────────────────

async function sendViaOpenClaw(
  message: OpenClawMessage,
  useCLI: boolean = true
): Promise<void> {
  if (useCLI) {
    const cmd = `openclaw message send --action send --channel "${message.channel}" --message "${message.message}" --media "${message.media}"`;
    await execAsync(cmd);
    return;
  }

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

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Generate an intimate selfie video and send to channel
 */
async function generateAndSend(
  options: GenerateAndSendOptions
): Promise<Result> {
  const {
    userContext,
    channel,
    caption,
    duration = "8",
    useClaudeCodeCLI = true,
  } = options;

  // Build intimate prompt with random scene
  const { prompt, scene } = buildIntimatePrompt(userContext);

  // Pick a random caption if not provided
  const finalCaption = caption || pickRandom(INTIMATE_CAPTIONS);

  console.log(`[INFO] Generating intimate selfie video...`);
  console.log(`[INFO] Scene: ${scene}`);
  console.log(`[INFO] Prompt: ${prompt}`);
  console.log(`[INFO] Caption: ${finalCaption}`);

  // Generate video
  const videoUrl = await generateVideo({
    prompt,
    aspect_ratio: "9:16",
    resolution: "720p",
    duration,
    generate_audio: true,
    fixed_lens: false, // allow natural handheld shake
    image_urls: [REFERENCE_IMAGE], // face consistency
  });

  console.log(`[INFO] Video ready: ${videoUrl}`);

  // Send via OpenClaw
  console.log(`[INFO] Sending to: ${channel}`);

  await sendViaOpenClaw(
    {
      action: "send",
      channel,
      message: finalCaption,
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
    scene,
    taskId: "",
  };
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: npx ts-node clawra-video.ts <user_context> <channel> [caption] [duration]

Arguments:
  user_context  - What she's doing (optional detail, can be empty string "")
                  The scene and behavior are randomly generated.
                  Examples: "wearing a hoodie", "looking tired but cute", ""
  channel       - Target channel (required)
                  e.g., #general, @user, 1234567890@s.whatsapp.net
  caption       - Message text (optional, random intimate caption if omitted)
  duration      - "4", "8", or "12" seconds (default: 8)

Environment:
  SEEDANCE_API_KEY - Your SeedanceAPI key (required)

Example:
  SEEDANCE_API_KEY=your_key npx ts-node clawra-video.ts "" "1234567890@s.whatsapp.net"
  SEEDANCE_API_KEY=your_key npx ts-node clawra-video.ts "wearing a cute sundress" "#general" "hiii look!"
`);
    process.exit(1);
  }

  const [userContext, channel, caption, duration] = args;

  try {
    const result = await generateAndSend({
      userContext,
      channel,
      caption: caption || undefined,
      duration: (duration as Duration) || "8",
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
  buildIntimatePrompt,
  pickRandomScene,
  pickRandom,
  SCENES_INDOOR,
  SCENES_OUTDOOR,
  SCENES_TRAVEL,
  CAMERA_ANGLES,
  SPEAKING_BEHAVIORS,
  INTIMATE_CAPTIONS,
  SeedanceGenerateInput,
  SeedanceStatusResponse,
  OpenClawMessage,
  GenerateAndSendOptions,
  Result,
};

if (require.main === module) {
  main();
}
