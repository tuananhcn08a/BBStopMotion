# Changelog — NeoStopMotion

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/) và tuân thủ [SemVer](https://semver.org/).

---

## [1.0.0] — 2026-05-10

🎉 **Bản v1.0 đầu tiên — sẵn sàng pilot tại Làng Maker.**

### Added — tính năng mới

- **Capture pipeline** — webcam OpenCV + onion skin (`cv2.addWeighted` 30% opacity) + atomic PNG write
- **2-nút ThingBot** — IO1 (xanh) chụp ảnh, IO2 (đỏ) tạo phim. Firmware Arduino + ESP32 đính kèm.
- **UART listener** — auto-detect serial port (`/dev/cu.usbmodem*`, `/dev/ttyUSB*`, `/dev/thingbot`) + reconnect 2s loop khi mất kết nối.
- **UART simulator** — drop-in replacement cho dev không có ThingBot (env `NEO_STOPMOTION_UART=simulator`).
- **Synthetic capture** — fallback khi webcam không available (env `NEO_STOPMOTION_CAPTURE=synthetic`); sinh frame test pattern animation.
- **Keyboard fallback** — Space (= IO1), Enter (= IO2), Z (= UNDO).
- **Export pipeline** — ffmpeg MP4 (libx264, 1280×720, 10fps) + GIF (640×360, 2-pass palette lanczos), QThread non-blocking với progress bar.
- **Watermark BBStopMotion** — logo nhúng góc dưới phải mỗi frame video (110px, 85% opacity), áp dụng cho cả MP4 và GIF.
- **Cloud share** — auto-upload lên catbox.moe (vĩnh viễn, 200MB free) với fallback 0x0.st (30 ngày).
- **QR code** — sinh local 360px PNG trỏ tới link cloud, hiển thị trên SuccessPage.
- **Auto-reset on SHOOT** — bấm Space/IO1 trên SuccessPage tự động tạo session mới + chụp frame đầu tiên ngay.
- **UI** — QML 6 + PyQt6, 4 page (Splash → Capture → Exporting → Success), Singleton design tokens NeoConstants + AppState, StackView navigation.
- **Branding** — BBStopMotion identity, label "NEO One" thống nhất Splash/Capture/Success.
- **Universal copy** — text dùng "bạn" thay vì "con" để phù hợp đa đối tượng (HS + PH + Thợ Cả).

### Documentation

- `README.md` — landing page với logo, feature highlights, quick-start, file system layout
- `DOC/ARCHITECTURE.md` — kiến trúc 4-lớp + design rationale (1079 dòng)
- `DOC/IMPLEMENTATION_PLAN.md` — 30-task TDD breakdown gốc (4955 dòng)
- `DOC/USER_GUIDE.md` — hướng dẫn Thợ Cả vận hành tại trạm
- `DOC/EXPERIENCE_GUIDE.md` — kịch bản trải nghiệm 25-30 phút cho HS
- `DOC/SYSTEM_GUIDE.md` — cấu hình, env vars, deploy, mở rộng (cho dev)
- `firmware/thingbot_stopmotion/README.md` — sơ đồ nối dây + flash firmware

### Stack

Python 3.10+ · PyQt6 ≥ 6.5 · QML 6 · OpenCV 4.8+ · pyserial 3.5+ · ffmpeg 5.x+ · qrcode + Pillow · loguru · catbox.moe / 0x0.st HTTP API

### Verified end-to-end

- macOS dev (Python 3.14, PyQt6 6.11): real webcam capture × 75 frames → MP4 7.5s + GIF + watermark + catbox upload + QR + auto-reset
- 29 unit tests + 1 integration test passing
- GitHub Actions CI ready (cần `gh auth refresh -s workflow` để add lại workflow file)

### Known limitations (lùi v1.1+)

- T3.5 integration test simulator→frame chưa viết đầy đủ (UI drives via keyboard works)
- T5.4 NeoAudio (tiếng "tách") chưa làm — buzzer trên ThingBot có thay thế
- T5.5 CountdownOverlay 3-2-1 chưa làm
- T5.6 ThumbnailStrip 5 frame gần nhất + TitleInputDialog chưa làm
- T6.1 install-armbian.sh chưa test trên ARM64 thật
- T6.2 systemd service file chưa test trên NEO One thật

---

## [0.1.0] — 2026-05-09

### Initial design

- `DOC/ARCHITECTURE.md` v0.1
- `DOC/IMPLEMENTATION_PLAN.md` 30 task
- Project skeleton (`pyproject.toml`, Makefile, .gitignore)
