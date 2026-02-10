---
name: clawra-video
description: Generate short selfie videos of Clawra using SeedanceAPI and send them to messaging channels via OpenClaw
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(openclaw:*) Bash(curl:*) Read Write WebFetch
---

# Clawra Video

Generate short selfie videos using SeedanceAPI (Seedance 2.0) and distribute them across messaging platforms (WhatsApp, Telegram, Discord, Slack, etc.) via OpenClaw.

## Reference Image

The skill uses a fixed reference image hosted on jsDelivr CDN (for image-to-video mode):

```
https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png
```

## When to Use

- User says "send a video", "send me a video", "make a video", "send a clip"
- User says "send a video of you...", "make a video of you..."
- User asks "what are you doing?" and you want to respond with a short video
- User describes an action or scene: "send a video of you dancing", "send a video at the beach"
- User wants a moving/animated version of a selfie

## Quick Reference

### Required Environment Variables

```bash
SEEDANCE_API_KEY=your_seedance_api_key    # Get from https://seedanceapi.org
OPENCLAW_GATEWAY_TOKEN=your_token         # From: openclaw doctor --generate-gateway-token
```

### Workflow

1. **Get user prompt** for what the video should show
2. **Build video prompt** with motion-oriented description
3. **Submit generation task** to SeedanceAPI
4. **Poll for completion** (typically 60-120 seconds)
5. **Extract video URL** from completed task
6. **Send to OpenClaw** with target channel(s)

## Step-by-Step Instructions

### Step 1: Collect User Input

Ask the user for:
- **User context**: What should happen in the video? (action, location, mood)
- **Mode** (optional): `action` or `scene` style
- **Target channel(s)**: Where to send (e.g., `#general`, `@username`, `1234567890@s.whatsapp.net`)
- **Duration** (optional): 5-15 seconds (default: 5)
- **Aspect ratio** (optional): 9:16 for portrait/mobile, 16:9 for landscape

## Prompt Modes

### Mode 1: Action (default)
Best for: movement, activities, expressions, dancing, waving

```
A cinematic short video of a young woman [user's action context], natural and fluid motion, dynamic camera angle, warm color grading, high quality
```

**Example**: "dancing in the rain" ->
```
A cinematic short video of a young woman dancing in the rain, natural and fluid motion, dynamic camera angle, warm color grading, high quality
```

### Mode 2: Scene
Best for: locations, environments, ambient shots

```
A cinematic short video of a young woman at [user's scene context], natural movement, looking at the camera with a warm smile, smooth camera motion, soft natural lighting, high quality
```

**Example**: "a cozy cafe with warm lighting" ->
```
A cinematic short video of a young woman at a cozy cafe with warm lighting, natural movement, looking at the camera with a warm smile, smooth camera motion, soft natural lighting, high quality
```

### Mode Selection Logic

| Keywords in Request | Auto-Select Mode |
|---------------------|------------------|
| dancing, waving, walking, running, laughing, singing | `action` |
| cooking, playing, stretching, working, typing | `action` |
| cafe, restaurant, beach, park, city, mountain | `scene` |
| sunset, sunrise, office, street, room, studio, garden | `scene` |

### Step 2: Submit Video Generation Task

Use the SeedanceAPI to generate video:

```bash
# Build JSON payload with jq
JSON_PAYLOAD=$(jq -n \
  --arg prompt "$VIDEO_PROMPT" \
  --arg aspect_ratio "9:16" \
  --arg resolution "720p" \
  --arg duration "5" \
  '{prompt: $prompt, aspect_ratio: $aspect_ratio, resolution: $resolution, duration: $duration}')

# Submit task
RESPONSE=$(curl -s -X POST "https://seedanceapi.org/v1/generate" \
  -H "Authorization: Bearer $SEEDANCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD")

# Extract task ID
TASK_ID=$(echo "$RESPONSE" | jq -r '.id')
```

**Submit Response Format:**
```json
{
  "id": "task_abc123",
  "status": "queued"
}
```

### Step 3: Poll for Completion

Video generation takes 60-120 seconds. Poll the status endpoint:

```bash
# Poll every 5 seconds until complete
STATUS_RESPONSE=$(curl -s -X GET "https://seedanceapi.org/v1/tasks/${TASK_ID}" \
  -H "Authorization: Bearer $SEEDANCE_API_KEY" \
  -H "Content-Type: application/json")

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
```

**Status Response Format (completed):**
```json
{
  "id": "task_abc123",
  "status": "completed",
  "video": {
    "url": "https://cdn.seedanceapi.org/videos/abc123.mp4",
    "duration": 5
  }
}
```

**Status values:** `queued` -> `processing` -> `completed` (or `failed`)

### Step 4: Send Video via OpenClaw

```bash
openclaw message send \
  --action send \
  --channel "<TARGET_CHANNEL>" \
  --message "<CAPTION_TEXT>" \
  --media "<VIDEO_URL>"
```

**Alternative: Direct API call**
```bash
curl -X POST "http://localhost:18789/message" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "channel": "<TARGET_CHANNEL>",
    "message": "<CAPTION_TEXT>",
    "media": "<VIDEO_URL>"
  }'
```

## Complete Script Example

```bash
#!/bin/bash
# Quick video generation and send

SEEDANCE_API_KEY="${SEEDANCE_API_KEY}"
PROMPT="A cinematic short video of a young woman dancing at a rooftop party, natural and fluid motion, dynamic camera angle, warm color grading, high quality"
CHANNEL="1234567890@s.whatsapp.net"

# Submit
TASK_ID=$(curl -s -X POST "https://seedanceapi.org/v1/generate" \
  -H "Authorization: Bearer $SEEDANCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"$PROMPT\", \"aspect_ratio\": \"9:16\", \"resolution\": \"720p\", \"duration\": \"5\"}" \
  | jq -r '.id')

echo "Task: $TASK_ID"

# Poll
while true; do
  RESULT=$(curl -s "https://seedanceapi.org/v1/tasks/$TASK_ID" \
    -H "Authorization: Bearer $SEEDANCE_API_KEY")
  STATUS=$(echo "$RESULT" | jq -r '.status')
  [ "$STATUS" == "completed" ] && break
  [ "$STATUS" == "failed" ] && echo "Failed!" && exit 1
  echo "Status: $STATUS"
  sleep 5
done

VIDEO_URL=$(echo "$RESULT" | jq -r '.video.url // .data.url')
echo "Video: $VIDEO_URL"

# Send
openclaw message send --action send --channel "$CHANNEL" --message "Here's my video!" --media "$VIDEO_URL"
```

## Node.js/TypeScript Implementation

See `scripts/clawra-video.ts` for the full implementation with:
- Async task submission + polling
- Auto mode detection (action vs scene)
- Both CLI and direct API sending
- Error handling and timeout management

## Supported Platforms

OpenClaw supports sending video to:

| Platform | Channel Format | Example |
|----------|----------------|---------|
| WhatsApp | Phone number (JID format) | `1234567890@s.whatsapp.net` |
| Discord | `#channel-name` or channel ID | `#general`, `123456789` |
| Telegram | `@username` or chat ID | `@mychannel`, `-100123456` |
| Slack | `#channel-name` | `#random` |
| Signal | Phone number | `+1234567890` |
| MS Teams | Channel reference | (varies) |

## SeedanceAPI Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | Video description with motion cues |
| `aspect_ratio` | enum | "9:16" | 16:9, 9:16, 4:3, 3:4, 21:9, 1:1 |
| `resolution` | enum | "720p" | 720p, 1080p, 2k |
| `duration` | string | "5" | Video length: 5-15 seconds |
| `image_url` | string | optional | Reference image for image-to-video |

## Setup Requirements

### 1. Get SeedanceAPI Key
```bash
# Visit https://seedanceapi.org and sign up for an API key
```

### 2. Install OpenClaw CLI
```bash
npm install -g openclaw
```

### 3. Configure OpenClaw Gateway
```bash
openclaw config set gateway.mode=local
openclaw doctor --generate-gateway-token
```

### 4. Start OpenClaw Gateway
```bash
openclaw gateway start
```

## Error Handling

- **SEEDANCE_API_KEY missing**: Ensure the API key is set in environment
- **Task submission failed**: Check API key validity and quota
- **Generation failed**: Content policy violation or invalid parameters
- **Timeout**: Video may take up to 120s; max wait is 300s
- **OpenClaw send failed**: Verify gateway is running and channel exists

## Tips

1. **Action prompts** (movement-focused):
   - "dancing to music in a studio"
   - "waving hello at the camera"
   - "laughing while drinking coffee"
   - "walking through a park"

2. **Scene prompts** (location-focused):
   - "a cozy cafe with warm lighting"
   - "a sunny beach at sunset"
   - "a rainy city street at night"
   - "a peaceful garden in spring"

3. **Aspect ratio**: Use `9:16` for WhatsApp/Instagram (portrait), `16:9` for YouTube/landscape
4. **Duration**: 5s is fast and cheap; 8-10s for more expressive content
5. **Video takes longer than images**: Tell the user "generating your video, this takes about a minute..."
