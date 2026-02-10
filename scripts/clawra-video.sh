#!/bin/bash
# clawra-video.sh — Generate selfie videos with SeedanceAPI and send via OpenClaw
#
# Usage:
#   ./clawra-video.sh "<user_context>" "<channel>" [mode] [aspect_ratio] [duration] [caption]
#
# Environment:
#   SEEDANCE_API_KEY       - Your SeedanceAPI key (required)
#   OPENCLAW_GATEWAY_TOKEN - OpenClaw gateway token (optional, for direct API)

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

SEEDANCE_API_BASE="https://seedanceapi.org/v1"
REFERENCE_IMAGE="https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png"
POLL_INTERVAL=5        # seconds between polls
MAX_POLL_SECONDS=300   # 5 minutes max

# ─── Validate ─────────────────────────────────────────────────────────────────

if [ -z "${SEEDANCE_API_KEY:-}" ]; then
  echo "Error: SEEDANCE_API_KEY environment variable not set"
  echo "Get your key from: https://seedanceapi.org"
  exit 1
fi

USER_CONTEXT="${1:-}"
CHANNEL="${2:-}"
MODE="${3:-auto}"
ASPECT_RATIO="${4:-9:16}"
DURATION="${5:-5}"
CAPTION="${6:-Here's a video for you!}"

if [ -z "$USER_CONTEXT" ] || [ -z "$CHANNEL" ]; then
  echo "Usage: $0 <user_context> <channel> [mode] [aspect_ratio] [duration] [caption]"
  echo ""
  echo "Arguments:"
  echo "  user_context   What the video should show (required)"
  echo "  channel        Target channel (required)"
  echo "  mode           action | scene | auto (default: auto)"
  echo "  aspect_ratio   9:16 | 16:9 | 4:3 | 1:1 (default: 9:16)"
  echo "  duration       5-15 seconds (default: 5)"
  echo "  caption        Message caption"
  echo ""
  echo "Examples:"
  echo "  $0 'dancing in a studio' '#general' action 9:16 5"
  echo "  $0 'sitting at a cozy cafe' '1234567890@s.whatsapp.net' scene 9:16 8"
  exit 1
fi

# ─── Auto-detect mode ────────────────────────────────────────────────────────

if [ "$MODE" == "auto" ]; then
  if echo "$USER_CONTEXT" | grep -qiE "dancing|waving|walking|running|laughing|singing|cooking|playing|stretching|working|typing"; then
    MODE="action"
  elif echo "$USER_CONTEXT" | grep -qiE "cafe|restaurant|beach|park|city|mountain|sunset|sunrise|office|street|room|studio|garden"; then
    MODE="scene"
  else
    MODE="action"
  fi
  echo "Auto-detected mode: $MODE"
fi

# ─── Build prompt ────────────────────────────────────────────────────────────

if [ "$MODE" == "scene" ]; then
  VIDEO_PROMPT="A cinematic short video of a young woman at $USER_CONTEXT, natural movement, looking at the camera with a warm smile, smooth camera motion, soft natural lighting, high quality"
else
  VIDEO_PROMPT="A cinematic short video of a young woman $USER_CONTEXT, natural and fluid motion, dynamic camera angle, warm color grading, high quality"
fi

echo "Mode: $MODE"
echo "Prompt: $VIDEO_PROMPT"
echo "Aspect ratio: $ASPECT_RATIO | Duration: ${DURATION}s"

# ─── Submit video generation task ─────────────────────────────────────────────

echo ""
echo "Submitting video generation task..."

JSON_PAYLOAD=$(jq -n \
  --arg prompt "$VIDEO_PROMPT" \
  --arg aspect_ratio "$ASPECT_RATIO" \
  --arg resolution "720p" \
  --arg duration "$DURATION" \
  '{prompt: $prompt, aspect_ratio: $aspect_ratio, resolution: $resolution, duration: $duration}')

SUBMIT_RESPONSE=$(curl -s -X POST "${SEEDANCE_API_BASE}/generate" \
  -H "Authorization: Bearer $SEEDANCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

TASK_ID=$(echo "$SUBMIT_RESPONSE" | jq -r '.id // empty')

if [ -z "$TASK_ID" ]; then
  echo "Error: Failed to submit video task"
  echo "Response: $SUBMIT_RESPONSE"
  exit 1
fi

echo "Task submitted: $TASK_ID"

# ─── Poll for completion ─────────────────────────────────────────────────────

echo "Polling for completion (this may take 60-120s)..."

ELAPSED=0
VIDEO_URL=""

while [ $ELAPSED -lt $MAX_POLL_SECONDS ]; do
  STATUS_RESPONSE=$(curl -s -X GET "${SEEDANCE_API_BASE}/tasks/${TASK_ID}" \
    -H "Authorization: Bearer $SEEDANCE_API_KEY" \
    -H "Content-Type: application/json")

  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')

  if [ "$STATUS" == "completed" ]; then
    # Try both response shapes
    VIDEO_URL=$(echo "$STATUS_RESPONSE" | jq -r '.video.url // .data.url // empty')
    if [ -z "$VIDEO_URL" ]; then
      echo "Error: Video completed but no URL found"
      echo "Response: $STATUS_RESPONSE"
      exit 1
    fi
    break
  fi

  if [ "$STATUS" == "failed" ]; then
    ERROR_MSG=$(echo "$STATUS_RESPONSE" | jq -r '.error // "Unknown error"')
    echo "Error: Video generation failed - $ERROR_MSG"
    exit 1
  fi

  echo "  Status: $STATUS (${ELAPSED}s elapsed)"
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ -z "$VIDEO_URL" ]; then
  echo "Error: Timed out after ${MAX_POLL_SECONDS}s"
  exit 1
fi

echo "Video ready: $VIDEO_URL"

# ─── Send via OpenClaw ────────────────────────────────────────────────────────

echo "Sending to channel: $CHANNEL"

openclaw message send \
  --action send \
  --channel "$CHANNEL" \
  --message "$CAPTION" \
  --media "$VIDEO_URL"

echo "Done! Video sent to $CHANNEL"
