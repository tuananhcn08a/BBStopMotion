<div align="center">

  # BBStopMotion

  **Stop-motion studio for kids · NEO One**

  [![PyPI version](https://img.shields.io/pypi/v/bbstopmotion)](https://pypi.org/project/bbstopmotion/)
  [![Python](https://img.shields.io/pypi/pyversions/bbstopmotion)](https://pypi.org/project/bbstopmotion/)
  [![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
  [![GitHub](https://img.shields.io/badge/github-tuananhcn08a%2FBBStopMotion-blue)](https://github.com/tuananhcn08a/BBStopMotion)
</div>

---

## Table of Contents

- [Description](#description)
- [Features](#features)
- [Installation](#installation)
- [User Manual](#user-manual)
- [Documents](#documents)
- [About & Contributing](#about--contributing)

---

## Description

NeoStopMotion is an open-source stop-motion animation studio designed for children aged 6–14, built to run on the **NEO One** education device (ARM64/Armbian) and standard Linux/macOS desktops.

Students physically capture animation frames one by one using the **ThingBot** controller (two arcade buttons via UART), then the app automatically assembles an MP4 + GIF, uploads it to the cloud, and generates a QR code that parents can scan to download the film.

The project is grounded in **Constructionism** (Papert, MIT): children learn by building something personally meaningful with their own hands, not by watching a demonstration.

**Tech stack:** Python 3.10+ · PyQt6 · QML 6 · OpenCV · pyserial · ffmpeg · qrcode · loguru · catbox.moe

---

## Features

- **Live webcam preview** with **onion skin** overlay — the previous frame appears faintly over the live feed to guide positioning
- **2-button ThingBot controller** (IO1 blue = capture frame · IO2 red = create film) over UART, with full keyboard fallback (`Space` / `Enter` / `Z`)
- **MP4 export** (H.264 1280×720 at 10 fps) and **GIF** (640×360 lanczos palette) via ffmpeg, all processed on a non-blocking QThread
- **BBStopMotion watermark** automatically embedded bottom-right at 85% opacity
- **Automatic cloud upload** — catbox.moe (permanent, primary) with 0x0.st as 30-day fallback
- **QR code** generated locally and displayed on-screen for instant parent download
- **Auto-reset flow** — pressing the capture button on the success screen immediately starts a new session without losing the previous film
- Onion skin exists only in live preview and is never written to saved frames (preserving full image quality)
- **Synthetic capture fallback** for development environments without a webcam

---

## Installation

### From PyPI (recommended)

```bash
pip install neo-stopmotion
neo-stopmotion
```

> Requires **ffmpeg** to be installed separately (`brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu/Debian).

### On NEO One (ARM64 — Armbian / Ubuntu)

The installer handles system Qt6/PyQt6 and OpenCV via apt to avoid building from source on ARM:

```bash
curl -sSL https://raw.githubusercontent.com/tuananhcn08a/BBStopMotion/main/scripts/install_on_neo.sh | bash
neo-stopmotion
```

Pin a specific version:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/tuananhcn08a/BBStopMotion/main/scripts/install_on_neo.sh) --version=1.0.1
```

Uninstall:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/tuananhcn08a/BBStopMotion/main/scripts/install_on_neo.sh) --uninstall
```

### Developer setup (macOS / Ubuntu desktop)

```bash
git clone https://github.com/tuananhcn08a/BBStopMotion.git
cd neo-stopmotion
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
brew install ffmpeg          # macOS; use apt on Linux
make run                     # real webcam (camera permission popup on first run)
make run-sim                 # synthetic frames — no camera needed
```

Run tests and linting:

```bash
make test     # 29 unit tests
make lint     # ruff + mypy
```

---

## User Manual

### Controls

| Key | ThingBot button | Action |
|-----|-----------------|--------|
| `Space` | IO1 (blue) | Capture one frame. On the Success screen: auto-reset and capture the first frame of a new film. |
| `Z` | — | Delete the most recent frame (undo). |
| `Enter` | IO2 (red) | Create film from all captured frames (requires ≥ 5 frames). |

### Workflow

```
SplashScreen ──2s──► CapturePage ◄──────────────────────────┐
                          │                                  │
                    (≥ 5 frames)                             │
                          │                                  │
                          ▼                               reset_session()
                    ExportingPage                            │
                          │                                  │
                          ▼                                  │
                    SuccessPage ─── press IO1 / Space ───────┘
```

### Typical session (25–30 minutes)

1. **Set up the stage** — arrange characters on a flat 60×60 cm surface in front of the webcam.
2. **Shoot frames** — press IO1, move the character a small amount, press IO1 again. Repeat 30–50 times. The onion skin overlay shows the previous frame faintly to help guide each movement.
3. **Create the film** — press IO2 (or `Enter`) once you have at least 5 frames. The app exports MP4 + GIF and uploads to the cloud automatically.
4. **Share** — a QR code appears on-screen. Parents scan it with any camera app to download the MP4.
5. **Next film** — press IO1 on the success screen to reset immediately and start a new session.

### Session output

```
~/projects/session_2026_05_10_193722/
├── frames/
│   ├── frame_0001.png   # raw PNG, no watermark
│   └── ...
├── output.mp4           # 1280×720 H.264 + BBStopMotion watermark
├── output.gif           # 640×360 lanczos + watermark
├── qr.png               # 360 px QR pointing to cloud URL
└── project.json         # session metadata (id, frame count, urls…)
```

### Environment variables

| Variable | Values | Effect |
|----------|--------|--------|
| `NEO_STOPMOTION_UART` | `auto` / `simulator` / `/dev/ttyUSB0` | Select UART backend |
| `NEO_STOPMOTION_CAPTURE` | `synthetic` | Skip webcam, use test pattern |
| `NEO_STOPMOTION_CLOUD` | `0` / `1` | Disable / enable cloud upload |
| `NEO_STOPMOTION_DEBUG` | `1` | Enable DEBUG log level |

---

## Documents

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](DOC/ARCHITECTURE.md) | 4-layer architecture, SignalBus, Worker Thread, design tokens |
| [SYSTEM_GUIDE.md](DOC/SYSTEM_GUIDE.md) | Configuration, environment variables, deployment, customisation |
| [USER_GUIDE.md](DOC/USER_GUIDE.md) | Operator guide for running the station |
| [EXPERIENCE_GUIDE.md](DOC/EXPERIENCE_GUIDE.md) | 25–30 min facilitation script for educators |
| [IMPLEMENTATION_PLAN.md](DOC/IMPLEMENTATION_PLAN.md) | TDD task breakdown (30 tasks) |
| [firmware/thingbot_stopmotion/README.md](firmware/thingbot_stopmotion/README.md) | ThingBot wiring diagram and firmware flash guide |

---

## About & Contributing

### Philosophy

NeoStopMotion is built on three principles:

- **Constructionism (Papert, MIT)** — children learn by creating something personally meaningful, not by watching a demonstration. Each film is an *object to think with*.
- **Tinkering (Exploratorium)** — open-ended materials and an open environment let children self-direct. The facilitator asks questions; the environment teaches.
- **Bình Dân Học STEM** — Made in Vietnam, MIT-licensed, affordable. Vietnamese children deserve high-quality STEM tools built at home.

### Contributing

Issues and pull requests are welcome.

```bash
# Run tests and lint before opening a PR
make test     # must pass all 29 tests
make lint     # ruff + mypy (strict)
```

Please open an issue first for significant changes so we can discuss the approach.

### Authors

BBStopMotion is a fork of [NeoStopMotion](https://github.com/makerviet/NeoStopMotion) (MIT).
Original authors: Maker Việt, Dế Foundation, ThingEdu.

### License

MIT — open source, Made in Vietnam.

---

<div align="center">
  <em>"Give an 8-year-old the power to tell their own story with technology."</em>
  <br/>
  <strong>BBStopMotion — 2026</strong>
</div>
