# Clawra Video

<img width="300" alt="clawra" src="https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png" />

Girlfriend-style selfie video generation for OpenClaw. Like receiving a TikTok from someone who misses you.

## Quick Start

```bash
npx clawra-video@latest
```

This will:
1. Check OpenClaw is installed
2. Guide you to get a SeedanceAPI key
3. Install the skill to `~/.openclaw/skills/clawra-video/`
4. Configure OpenClaw to use the skill
5. Add the intimate video persona to your agent's SOUL.md

## What It Does

Your OpenClaw agent can now send short selfie videos that feel like a real person recorded them:

- **Selfie camera angle** — she's holding the phone, looking at you
- **Random scenery** — bedroom, cafe, park, rooftop, train, beach... changes every time
- **Natural behavior** — laughing, waving, tucking hair, whispering, sipping coffee
- **Audio enabled** — ambient sounds make it feel real
- **Intimate captions** — "miss you already hehe", "don't judge me i just woke up"

### Not Cinematic. Real.

Every video is assembled from randomized pools:

| Pool | Examples |
|------|----------|
| **Scene** | cozy bedroom with fairy lights, outdoor cafe at golden hour, train window |
| **Camera** | selfie above eye level, phone at arm's length, propped on surface |
| **Behavior** | talking with hand gestures, laughing softly, blowing a kiss, waving hi |
| **Caption** | "just thinking about you~", "wish you were here", "hiiii are you busy?" |

## Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- [SeedanceAPI](https://seedanceapi.org) account

## Usage Examples

Once installed, your agent responds naturally to:

```
"what are you doing?"        → sends a video from a random location
"i miss you"                 → sends a video waving or blowing a kiss
"good morning"               → sends a cozy video from bed
"send me a video"            → sends a selfie clip with random scene
"show me you at a cafe"      → sends a video with cafe scene context
```

## API Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `aspect_ratio` | `9:16` | Vertical — TikTok / WhatsApp native |
| `resolution` | `720p` | Quality balance |
| `duration` | `8` | 8 seconds — feels personal, not produced |
| `generate_audio` | `true` | Ambient sound = realism |
| `fixed_lens` | `false` | Natural handheld shake |
| `image_urls` | `[reference]` | Face consistency |

## Cloud Deployment

### SSH + Installer

```bash
ssh user@your-server.com
npx clawra-video@latest
```

### Manual Install

```bash
# 1. Clone
git clone https://github.com/Jack-Li-Npu/clawra-video ~/.openclaw/skills/clawra-video

# 2. Configure
cat ~/.openclaw/openclaw.json | jq '.skills.entries["clawra-video"] = {
  "enabled": true,
  "env": { "SEEDANCE_API_KEY": "YOUR_KEY" }
}' > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# 3. Persona
cat ~/.openclaw/skills/clawra-video/templates/soul-injection.md >> ~/.openclaw/workspace/SOUL.md

# 4. Restart
openclaw restart
```

## Project Structure

```
clawra-video/
├── bin/cli.js                # npx installer
├── scripts/
│   ├── clawra-video.ts       # TypeScript — prompt engine + API + send
│   └── clawra-video.sh       # Bash — same logic, shell-native
├── skill/                    # Installed to ~/.openclaw/skills/
│   ├── SKILL.md
│   ├── scripts/
│   └── assets/clawra.png
├── templates/
│   └── soul-injection.md     # Girlfriend persona for SOUL.md
├── SKILL.md                  # Skill definition
├── package.json
└── README.md
```

## License

MIT
