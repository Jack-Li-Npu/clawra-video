# Clawra Video

<img width="300" alt="clawra" src="https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png" />

Generate and send short selfie videos via OpenClaw using SeedanceAPI (Seedance 2.0).

## Quick Start

```bash
npx clawra-video@latest
```

This will:
1. Check OpenClaw is installed
2. Guide you to get a SeedanceAPI key
3. Install the skill to `~/.openclaw/skills/clawra-video/`
4. Configure OpenClaw to use the skill
5. Add video capabilities to your agent's SOUL.md

## What It Does

Clawra Video enables your OpenClaw agent to:
- **Generate short videos** (5-15 seconds) of a consistent AI character
- **Send videos** across all messaging platforms (WhatsApp, Discord, Telegram, etc.)
- **Respond with video** to "what are you doing?" and "send me a video" requests

### Video Modes

| Mode | Best For | Keywords |
|------|----------|----------|
| **Action** | Activities, movement | dancing, waving, laughing, walking |
| **Scene** | Locations, ambiance | cafe, beach, park, sunset, city |

## Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- [SeedanceAPI](https://seedanceapi.org) account

## Usage Examples

Once installed, your agent responds to:

```
"Send me a video of you dancing"
"Make a video at a coffee shop"
"What are you doing right now?"
"Send a clip of you waving hello"
```

## Cloud Deployment

To use on OpenClaw deployed in the cloud:

### 1. SSH into your cloud server

```bash
ssh user@your-openclaw-server.com
```

### 2. Run the installer

```bash
npx clawra-video@latest
```

### 3. Or install manually

```bash
# Clone skill
git clone https://github.com/SumeLabs/clawra-video ~/.openclaw/skills/clawra-video

# Set API key in openclaw.json
cat ~/.openclaw/openclaw.json | jq '.skills.entries["clawra-video"] = {
  "enabled": true,
  "apiKey": "YOUR_SEEDANCE_API_KEY",
  "env": { "SEEDANCE_API_KEY": "YOUR_SEEDANCE_API_KEY" }
}' > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Append persona to SOUL.md
cat ~/.openclaw/skills/clawra-video/templates/soul-injection.md >> ~/.openclaw/workspace/SOUL.md

# Restart OpenClaw
openclaw restart
```

### 4. Set environment variable

```bash
export SEEDANCE_API_KEY="your_key_here"
# Or add to your shell profile:
echo 'export SEEDANCE_API_KEY="your_key_here"' >> ~/.bashrc
```

## Technical Details

- **Video Generation**: SeedanceAPI (Seedance 2.0)
- **Generation Time**: 60-120 seconds per video
- **Messaging**: OpenClaw Gateway API
- **Supported Platforms**: Discord, Telegram, WhatsApp, Slack, Signal, MS Teams
- **Video Duration**: 5-15 seconds
- **Resolutions**: 720p, 1080p, 2K

## Project Structure

```
clawra-video/
├── bin/
│   └── cli.js              # npx installer
├── skill/
│   ├── SKILL.md             # Skill definition
│   ├── scripts/             # Generation scripts
│   └── assets/              # Reference image
├── templates/
│   └── soul-injection.md    # Persona template
└── package.json
```

## License

MIT
