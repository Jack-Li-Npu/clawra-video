#!/bin/bash
# clawra-video.sh — Intimate girlfriend-style selfie video via SeedanceAPI
#
# Generates TikTok-style selfie videos with random scenery,
# natural speaking behavior, and handheld camera feel.
# Like your girlfriend sending you a quick video message.
#
# Usage:
#   ./clawra-video.sh "<user_context>" "<channel>" ["<caption>"] ["<duration>"]
#
# Environment:
#   SEEDANCE_API_KEY       - Your SeedanceAPI key (required)
#   OPENCLAW_GATEWAY_TOKEN - OpenClaw gateway token (optional)

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────

SEEDANCE_API_BASE="https://seedanceapi.org/v1"
REFERENCE_IMAGE="https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png"
POLL_INTERVAL=5
MAX_POLL_SECONDS=300

# ─── Validate ─────────────────────────────────────────────────────────────────

if [ -z "${SEEDANCE_API_KEY:-}" ]; then
  echo "Error: SEEDANCE_API_KEY environment variable not set"
  echo "Get your key from: https://seedanceapi.org"
  exit 1
fi

USER_CONTEXT="${1:-}"
CHANNEL="${2:-}"
CAPTION="${3:-}"
DURATION="${4:-8}"

if [ -z "$CHANNEL" ]; then
  echo "Usage: $0 <user_context> <channel> [caption] [duration]"
  echo ""
  echo "Arguments:"
  echo "  user_context   What she's doing (can be empty string \"\")"
  echo "  channel        Target channel (required)"
  echo "  caption        Message text (random if omitted)"
  echo "  duration       4, 8, or 12 seconds (default: 8)"
  echo ""
  echo "Examples:"
  echo "  $0 '' '1234567890@s.whatsapp.net'"
  echo "  $0 'wearing a hoodie' '#general' 'hiii look!'"
  exit 1
fi

# ─── Random Scene Pools ──────────────────────────────────────────────────────

SCENES_INDOOR=(
  "in a cozy bedroom with fairy lights and soft pillows, warm golden lamp light"
  "in a messy but cute apartment kitchen, morning sunlight through the window"
  "on a couch in a living room with plants and warm ambient light"
  "at a desk in a cozy home office, laptop and coffee mug visible, soft backlight"
  "sitting on a bed with messy sheets, lazy afternoon light filtering through curtains"
  "in a dimly lit bedroom at night, screen glow on face, intimate atmosphere"
  "at a vanity table with makeup scattered around, ring light softly glowing"
  "in a tiny studio apartment, string lights and posters on the wall"
)

SCENES_OUTDOOR=(
  "walking down a quiet street at golden hour, trees lining the sidewalk"
  "at an outdoor cafe table, iced coffee in hand, blurred city background"
  "sitting on a park bench, dappled sunlight through leaves"
  "on a rooftop at sunset, city skyline blurred behind"
  "at the beach during blue hour, gentle waves in background"
  "in a flower garden, petals and soft natural light everywhere"
  "at a night market, colorful bokeh lights blurred behind"
  "on a balcony overlooking city lights at dusk"
  "at a bus stop on a rainy day, umbrella in hand, wet reflections"
  "in front of a convenience store at night, neon glow on face"
)

SCENES_TRAVEL=(
  "in a hotel room with a city view through floor-to-ceiling windows"
  "in the backseat of a car, scenery passing by outside the window"
  "on a train, countryside blurring past the window, chin on hand"
  "at a seaside town, pastel-colored buildings in the background"
  "in a vintage coffee shop in a foreign city, exposed brick walls"
)

# Combine all scenes
ALL_SCENES=("${SCENES_INDOOR[@]}" "${SCENES_OUTDOOR[@]}" "${SCENES_TRAVEL[@]}")

CAMERA_ANGLES=(
  "selfie angle slightly above eye level, phone held in one hand at arm's length"
  "front-facing camera at eye level, like a video call, head slightly tilted"
  "phone propped up on a surface at chest level, both hands free, leaning forward"
  "classic selfie angle from upper right, face well lit, slight smile"
  "phone held low at chin level looking slightly up, intimate and close"
  "hand holding phone at arm's length, slight dutch angle, natural and casual"
)

SPEAKING_BEHAVIORS=(
  "talking naturally to the camera with small hand gestures, mid-conversation, warm expression"
  "laughing softly at something, then looking back at camera with a playful grin"
  "tucking hair behind ear, slightly shy smile, looking into camera then away briefly"
  "whispering something close to the camera like sharing a secret, eyes sparkling"
  "reacting with an exaggerated surprised face then breaking into a genuine laugh"
  "resting chin on hand, listening expression, then nodding and smiling warmly"
  "taking a sip of a drink, then looking at camera with happy eyes over the cup"
  "waving hello with a small wave, mouthing hi with a sweet smile"
  "yawning adorably then giggling, rubbing eyes, looking cozy"
  "blowing a kiss to the camera naturally, not posed, just spontaneous"
  "doing a small happy dance with shoulders while sitting, goofy and genuine"
  "showing off something in her hand to the camera, excited and chatty"
  "adjusting the phone angle, briefly showing ceiling, then settling on her smiling face"
  "biting lip thoughtfully then breaking into a warm smile, eyes crinkling"
)

INTIMATE_CAPTIONS=(
  "miss you already hehe"
  "look at where i am right now!"
  "just thinking about you~"
  "guess what happened today"
  "i look like a mess but hi"
  "can't stop smiling today idk why"
  "wish you were here with me"
  "this reminded me of you"
  "okay but look at this view tho"
  "bored without you ngl"
  "good morning sleepyhead"
  "sending you a vibe check"
  "hiiii are you busy?"
  "i had the best day omg"
  "just wanted to see your face... here's mine first"
  "don't judge me i just woke up"
  "hey you~ guess where i am"
)

# ─── Random Pick Helper ──────────────────────────────────────────────────────

pick_random() {
  local -n arr=$1
  local len=${#arr[@]}
  local idx=$((RANDOM % len))
  echo "${arr[$idx]}"
}

# ─── Build Intimate Prompt ───────────────────────────────────────────────────

SCENE=$(pick_random ALL_SCENES)
ANGLE=$(pick_random CAMERA_ANGLES)
BEHAVIOR=$(pick_random SPEAKING_BEHAVIORS)

USER_ACTION=""
if [ -n "$USER_CONTEXT" ]; then
  USER_ACTION=", $USER_CONTEXT"
fi

VIDEO_PROMPT="A vertical 9:16 selfie video recorded on a phone, ${ANGLE}. A pretty young woman in her late teens${USER_ACTION}, ${SCENE}. She is ${BEHAVIOR}. Shot on iPhone, slightly shaky handheld footage, natural skin texture, no makeup filter, real ambient sound, casual clothing, TikTok selfie video aesthetic, warm and intimate mood, shallow depth of field on the background, the person feels like a real girlfriend sending a video message."

# Pick random caption if not provided
if [ -z "$CAPTION" ]; then
  CAPTION=$(pick_random INTIMATE_CAPTIONS)
fi

echo "Scene: $SCENE"
echo "Prompt: $VIDEO_PROMPT"
echo "Caption: $CAPTION"
echo "Duration: ${DURATION}s"
echo ""

# ─── Submit video generation task ─────────────────────────────────────────────

echo "Submitting video generation task..."

JSON_PAYLOAD=$(jq -n \
  --arg prompt "$VIDEO_PROMPT" \
  --arg aspect_ratio "9:16" \
  --arg resolution "720p" \
  --arg duration "$DURATION" \
  --argjson generate_audio true \
  --argjson fixed_lens false \
  --arg image_url "$REFERENCE_IMAGE" \
  '{
    prompt: $prompt,
    aspect_ratio: $aspect_ratio,
    resolution: $resolution,
    duration: $duration,
    generate_audio: $generate_audio,
    fixed_lens: $fixed_lens,
    image_urls: [$image_url]
  }')

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

echo "Waiting for video (typically 60-120s)..."

ELAPSED=0
VIDEO_URL=""

while [ $ELAPSED -lt $MAX_POLL_SECONDS ]; do
  STATUS_RESPONSE=$(curl -s -X GET "${SEEDANCE_API_BASE}/tasks/${TASK_ID}" \
    -H "Authorization: Bearer $SEEDANCE_API_KEY" \
    -H "Content-Type: application/json")

  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')

  if [ "$STATUS" == "completed" ]; then
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
