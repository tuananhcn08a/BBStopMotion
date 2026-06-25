# NeoStopMotion — Tài liệu Kiến trúc & Kế hoạch Triển khai

> **Phiên bản:** 0.1.0 (Design)
> **Tổ chức:** BBStopMotion contributors — BBStopMotion
> **Ngày soạn:** 2026-05-09
> **Áp dụng cho:** Trạm 6 (TN04a) — Trạm Làm Phim Hoạt Hình, Làng Maker @ FPT Shop
> **Tham chiếu spec:** `/Users/tuanln/Downloads/NEO_StopMotion_Tram6_Spec.md` v1.0
> **Tham chiếu kiến trúc:** NEOSTEM (Qt Quick/QML), NEO_CODE (PyQt6 + SignalBus)

---

## 1. Tổng quan sản phẩm

**NeoStopMotion** là ứng dụng làm phim stop-motion chạy trên **NEO One** (Linux Ubuntu 22.04, Allwinner ARM64, 2GB RAM), kết nối **ThingBot** (ESP32/Arduino) qua UART để nhận lệnh từ nút bấm vật lý. Học sinh 6-14 tuổi trong 25-30 phút có thể tạo ra một bộ phim hoạt hình ngắn 3-5 giây và mang về dưới dạng MP4 + GIF qua mã QR.

### Mục tiêu kỹ thuật v1.0

- 9 chức năng MUST (F-01 → F-09): live preview + onion skinning + UART capture/undo/export + MP4/GIF + QR + reset session
- 4 chức năng SHOULD (F-10 → F-13): tiếng "tách", đếm ngược 3-2-1, preview phim sơ bộ, tiêu đề phim
- Pilot tại 1 Làng Maker FPT Shop sau 3 tuần phát triển
- Mã nguồn mở MIT theo cam kết Bình Dân Học STEM

### Triết lý kiến trúc

- **Học từ NEOSTEM**: dùng QML cho UI (Singletons, StackView, Design tokens, ActivityBase pattern)
- **Học từ NEO_CODE**: dùng PyQt6 cho backend (SignalBus, Worker Thread, Hardware abstraction layer)
- **Tinh thần Bình Dân Học STEM**: stack đơn giản, dev nhanh, dễ chuyển giao cho sinh viên Maker

---

## 2. Technology Stack

| Lớp | Công nghệ | Phiên bản | Lý do chọn |
|---|---|---|---|
| OS target | Ubuntu 22.04 LTS / Armbian Bookworm | aarch64 | NEO One chuẩn |
| OS dev | macOS 14+ / Ubuntu 22.04 | x86_64 / arm64 | Cross-platform dev |
| Ngôn ngữ | Python | 3.10+ | Sinh viên Maker biết Python; ecosystem rich |
| GUI Framework | **PyQt6 + QML 6** | PyQt6 ≥ 6.5 | Học pattern NEOSTEM (QML) + NEOCode (PyQt6); fluid touch UI |
| Computer Vision | OpenCV (cv2) | 4.8+ | Onion skin = `cv2.addWeighted` 1 dòng, mature |
| Serial | pyserial | 3.5+ | Chuẩn cho UART Arduino/ESP32 |
| Video encoding | ffmpeg (subprocess) | 5.x | Mạnh, ổn định, sẵn trên Linux/macOS |
| QR generator | qrcode + Pillow | 7.4+ | Pure Python, không cần lib hệ thống |
| File server | http.server (built-in) | - | Đủ dùng cho LAN, không cần Flask/FastAPI |
| Config | tomllib (built-in 3.11+) hoặc tomli | - | TOML > JSON cho config user-facing |
| Audio | QtMultimedia (qua PyQt6) | - | Native Qt, tích hợp QML |
| Logging | logging (built-in) + loguru | - | Đủ + đẹp |
| Testing | pytest + pytest-qt | 7.4+ / 4.2+ | Chuẩn industry; test QML signals |
| Linting | ruff + mypy | latest | Strict typing |
| Build | PyInstaller hoặc nuitka | - | Standalone binary cho NEO One |
| Firmware | Arduino C++ | - | Theo spec §5.1 |

---

## 3. Kiến trúc tổng thể (4 lớp, kế thừa NEO_CODE)

```
+================================================================+
|                                                                |
|                    UI LAYER (QML 6)                            |
|                                                                |
|  MainWindow.qml (ApplicationWindow + StackView)                |
|    ├── SplashScreen.qml                                        |
|    ├── CapturePage.qml         ← màn hình chính                |
|    │     ├── LivePreview.qml   (frame webcam + onion blend)    |
|    │     ├── FrameCounter.qml                                  |
|    │     ├── ThumbnailStrip.qml (5 frame gần nhất)             |
|    │     ├── HintBar.qml                                       |
|    │     └── CountdownOverlay.qml (3-2-1)                      |
|    ├── ExportingPage.qml       (loading khi ghép video)        |
|    └── SuccessPage.qml         (QR + replay loop)              |
|                                                                |
|  Singletons (Global state, kế thừa pattern NEOSTEM):           |
|    ├── NeoConstants.qml  (design tokens — màu, font, anim)     |
|    ├── NeoAudio.qml      (tách.wav, undo.wav, success.wav)     |
|    └── AppState.qml      (frame_count, session_id, status)     |
|                                                                |
+============================+===================================+
                             | (Property Bindings + Signal/Slot)
+============================v===================================+
|                                                                |
|              APPLICATION LAYER (Python Services)               |
|                                                                |
|  AppController       SessionService      ExportService         |
|  (Root QObject       (Lifecycle:         (Async wrapper        |
|   exposed to QML;    create/reset        cho VideoExporter)    |
|   facade pattern)    sessions)                                 |
|                                                                |
+============================+===================================+
                             | SignalBus (pyqtSignal hub)
+============================v===================================+
|                                                                |
|              CORE PROCESSING LAYER                             |
|                                                                |
|  CaptureEngine      UARTListener       FrameManager            |
|  (cv2 webcam +      (pyserial +        (PNG file +             |
|   onion skin)        QThread)           project.json)          |
|                                                                |
|  VideoExporter      ShareServer                                |
|  (ffmpeg subproc    (qrcode +                                  |
|   QThread)           http.server                               |
|                       QThread)                                 |
|                                                                |
+============================+===================================+
                             |
+============================v===================================+
|                                                                |
|              HARDWARE / DATA LAYER                             |
|                                                                |
|  ThingBot Board       USB Webcam        File system            |
|  (ESP32 / Arduino,    (cv2 device 0,    /home/maker/projects/  |
|   nút bấm + LED,       720p autofocus)   session_YYYYMMDD/     |
|   UART 115200)                            ├ frames/*.png       |
|                                           ├ output.mp4         |
|                                           ├ output.gif         |
|                                           └ project.json       |
|                                                                |
+================================================================+
```

---

## 4. Cấu trúc thư mục

```
NeoStopMotion/
│
├── pyproject.toml              # Project metadata, deps, build config
├── requirements.txt            # Pinned runtime deps
├── requirements-dev.txt        # pytest, ruff, mypy, pyinstaller
├── README.md
├── LICENSE                     # MIT
├── Makefile                    # `make dev`, `make test`, `make build`
│
├── DOC/
│   ├── ARCHITECTURE.md         # Tài liệu này
│   ├── HARDWARE.md             # Sơ đồ ThingBot + nối dây + BOM
│   ├── DEPLOY_NEO_ONE.md       # Cài đặt + systemd + kiosk
│   ├── TEACHER_MANUAL.md       # Cheatsheet cho Thợ Cả vận hành
│   └── PROTOCOL.md             # UART protocol đặc tả chi tiết
│
├── src/
│   └── neo_stopmotion/
│       │
│       ├── __init__.py         # Version: 0.1.0
│       ├── __main__.py         # Entry: python -m neo_stopmotion
│       ├── app.py              # QApplication + QmlEngine init
│       │
│       ├── config/             # [Cấu hình]
│       │   ├── __init__.py
│       │   ├── settings.py     # TOML loader, dataclass
│       │   └── defaults.toml   # Giá trị mặc định
│       │
│       ├── core/               # [Xử lý lõi]
│       │   ├── __init__.py
│       │   ├── models.py       # Dataclasses: SessionMeta, FrameInfo, ExportResult
│       │   ├── capture_engine.py    # cv2 webcam + onion skin
│       │   ├── frame_manager.py     # PNG file + project.json
│       │   ├── video_exporter.py    # ffmpeg subprocess
│       │   └── share_server.py      # qrcode + http.server
│       │
│       ├── hardware/           # [Phần cứng — kế thừa pattern NEO_CODE]
│       │   ├── __init__.py
│       │   ├── uart_listener.py     # pyserial + QThread
│       │   ├── uart_protocol.py     # Parse SHOOT/UNDO/EXPORT/READY
│       │   └── uart_simulator.py    # Mock cho dev không có ThingBot
│       │
│       ├── services/           # [Application layer]
│       │   ├── __init__.py
│       │   ├── app_controller.py    # QObject exposed to QML — root facade
│       │   ├── session_service.py   # Manage session lifecycle
│       │   └── export_service.py    # Async wrapper for VideoExporter
│       │
│       ├── ui/                 # [Giao diện]
│       │   ├── __init__.py
│       │   ├── image_provider.py    # QQuickImageProvider for live preview
│       │   ├── qml_loader.py        # QQmlApplicationEngine wrapper
│       │   └── qml/
│       │       ├── MainWindow.qml
│       │       ├── pages/
│       │       │   ├── SplashScreen.qml
│       │       │   ├── CapturePage.qml
│       │       │   ├── ExportingPage.qml
│       │       │   └── SuccessPage.qml
│       │       ├── components/
│       │       │   ├── LivePreview.qml
│       │       │   ├── FrameCounter.qml
│       │       │   ├── ThumbnailStrip.qml
│       │       │   ├── HintBar.qml
│       │       │   ├── CountdownOverlay.qml
│       │       │   ├── QRDisplay.qml
│       │       │   ├── TitleInputDialog.qml
│       │       │   └── StatusBanner.qml
│       │       └── singletons/
│       │           ├── qmldir
│       │           ├── NeoConstants.qml   # design tokens (port từ NEOSTEM)
│       │           ├── NeoAudio.qml
│       │           └── AppState.qml
│       │
│       ├── utils/              # [Tiện ích]
│       │   ├── __init__.py
│       │   ├── signal_bus.py        # Centralized pyqtSignal hub
│       │   ├── cv_qt_bridge.py      # cv2 numpy ↔ QImage
│       │   ├── network.py           # Get local IP for share URL
│       │   └── logging_config.py
│       │
│       └── resources/          # [Tài nguyên]
│           ├── sounds/
│           │   ├── tach.wav
│           │   ├── undo.wav
│           │   └── success.wav
│           ├── fonts/
│           │   └── BeVietnamPro-Regular.ttf
│           └── images/
│               ├── logo.png
│               └── splash.png
│
├── firmware/                   # [Firmware ThingBot]
│   └── thingbot_stopmotion/
│       ├── thingbot_stopmotion.ino  # Arduino code — copy spec §5.1
│       ├── README.md                # Wiring diagram + flash guide
│       └── platformio.ini           # PlatformIO config (alt to Arduino IDE)
│
├── deployment/                 # [Triển khai NEO One]
│   ├── install-armbian.sh           # Cài deps trên Ubuntu/Armbian
│   ├── neostopmotion.service        # systemd unit cho kiosk mode
│   ├── requirements-arm64.txt       # Pinned deps cho ARM64
│   └── udev/
│       └── 99-thingbot.rules        # Stable /dev/thingbot symlink
│
├── tests/                      # [Bộ test]
│   ├── conftest.py                  # Fixtures (Qt app, mock webcam)
│   ├── unit/
│   │   ├── test_capture_engine.py
│   │   ├── test_frame_manager.py
│   │   ├── test_video_exporter.py
│   │   ├── test_share_server.py
│   │   └── test_uart_protocol.py
│   ├── integration/
│   │   ├── test_capture_to_export.py
│   │   └── test_uart_simulator.py
│   └── e2e/
│       └── test_full_session.py     # pytest-qt full flow
│
└── scripts/
    ├── run_dev.sh                   # macOS dev: python -m + simulator
    ├── run_neo_one.sh               # NEO One: + hardware thật
    └── flash_thingbot.sh            # Arduino CLI flash helper
```

---

## 5. Design patterns (kế thừa từ NEO_CODE và NEOSTEM)

### 5.1 SignalBus pattern (event-driven, từ NEO_CODE)

Các module giao tiếp qua một hub trung tâm tránh phụ thuộc trực tiếp.

```
UARTListener      --uart_command_received(str)--> SignalBus
                                                    │
                                                    ├── AppController.handle_uart_command()
                                                    └── NeoAudio.play("tach.wav")

CaptureEngine     --frame_ready(QImage)----------> SignalBus
                                                    └── PreviewImageProvider.update()

FrameManager      --frame_added(int, str)--------> SignalBus
                                                    ├── AppState.frame_count = N
                                                    └── ThumbnailStrip.refresh()

VideoExporter     --export_progress(float)-------> SignalBus
                                                    └── ExportingPage.progressBar.value

VideoExporter     --export_completed(dict)-------> SignalBus
                                                    └── SuccessPage.show(qr, urls)
```

**Danh sách Signals chính** (`utils/signal_bus.py`):

| Nhóm | Signal | Payload | Mục đích |
|---|---|---|---|
| UART | `uart_command_received` | `str` | Lệnh từ ThingBot |
| UART | `uart_disconnected` | - | Mất kết nối ThingBot |
| UART | `uart_reconnected` | - | Tái kết nối thành công |
| Capture | `webcam_ready` | - | Webcam mở thành công |
| Capture | `webcam_error` | `str` | Lỗi webcam |
| Capture | `frame_captured` | `int, str` | frame_number, filepath |
| Capture | `frame_undone` | `int` | new_count |
| Session | `session_reset` | - | Bắt đầu session mới |
| Export | `export_started` | - | Bắt đầu ghép video |
| Export | `export_progress` | `float` | 0.0 → 1.0 |
| Export | `export_completed` | `dict` | {mp4, gif, qr, url} |
| Export | `export_failed` | `str` | error message |
| Share | `share_url_ready` | `str, str` | url, qr_path |
| App | `status_message` | `str, str` | level, message |

### 5.2 Worker Thread pattern (từ NEO_CODE)

Tác vụ I/O hoặc nặng chạy trên `QThread` riêng để UI luôn ≥30fps:

| Worker | Vòng lặp | Output |
|---|---|---|
| **CaptureWorker** | Đọc webcam ~30fps | emit `frame_ready` |
| **UARTWorker** | `serial.readline()` blocking | emit `uart_command_received` |
| **ExportWorker** | `subprocess.run(ffmpeg)` | emit `export_progress` / `export_completed` |
| **ShareServerWorker** | `http.server.serve_forever()` | serve session files |

### 5.3 QML Image Provider pattern (PyQt6 → QML bridge)

Webcam frame (đã onion-skinned) đẩy lên QML qua `QQuickImageProvider`:

```python
# ui/image_provider.py
class PreviewImageProvider(QQuickImageProvider):
    def __init__(self, capture_engine):
        super().__init__(QQuickImageProvider.ImageType.Image)
        self.capture = capture_engine

    def requestImage(self, id, requestedSize):
        cv_frame = self.capture.get_live_preview()  # numpy with onion skin
        qimage = cv_to_qimage(cv_frame)
        return qimage, qimage.size()
```

QML side:
```qml
// LivePreview.qml
Image {
    id: preview
    source: "image://preview/" + AppState.previewCounter
    fillMode: Image.PreserveAspectFit
}
Timer {
    interval: 33  // ~30fps
    repeat: true
    running: true
    onTriggered: AppState.previewCounter++  // bust cache
}
```

### 5.4 Singleton pattern cho global state (từ NEOSTEM)

3 Singleton QML — phẳng, không chồng chéo, kế thừa NeoConstants/ProgressTracker từ NEOSTEM:

```qml
// AppState.qml (Singleton)
pragma Singleton
import QtQuick
QtObject {
    property int frameCount: 0
    property string sessionId: ""
    property string status: "idle"   // idle | capturing | exporting | completed
    property int previewCounter: 0    // for image cache invalidation
    property bool uartConnected: false
}
```

### 5.5 StackView navigation (từ NEOSTEM)

`MainWindow.qml` là `ApplicationWindow` chứa `StackView`:
```
SplashScreen → CapturePage ⇄ ExportingPage → SuccessPage → CapturePage (reset)
```

### 5.6 Hardware abstraction (từ NEO_CODE)

Tách `UARTListener` thành interface để swap với `UARTSimulator` cho dev macOS:

```python
class UARTSource(Protocol):
    def start(self) -> None: ...
    def stop(self) -> None: ...
    # emits via SignalBus

class UARTListener:    # real hardware, pyserial
    ...

class UARTSimulator:   # dev mode, listen to keyboard events
    # Space → SHOOT, Z → UNDO, Enter → EXPORT
    ...
```

App init đọc env `NEO_STOPMOTION_UART=simulator` để chọn.

---

## 6. Mô hình dữ liệu (`core/models.py`)

```python
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from enum import Enum

class UARTCommand(str, Enum):
    SHOOT = "SHOOT"
    UNDO = "UNDO"
    EXPORT = "EXPORT"
    READY = "READY"
    BAT_LOW = "BAT_LOW"

class SessionStatus(str, Enum):
    IDLE = "idle"
    CAPTURING = "capturing"
    EXPORTING = "exporting"
    COMPLETED = "completed"
    ERROR = "error"

@dataclass
class FrameInfo:
    frame_number: int          # 1-based
    filepath: Path
    captured_at: datetime
    width: int
    height: int

@dataclass
class SessionMeta:
    session_id: str            # YYYY_MM_DD_HHMMSS
    created_at: datetime
    frame_count: int = 0
    fps_playback: int = 10
    duration_seconds: float = 0.0
    title: str = ""
    creator_name: str = ""
    status: SessionStatus = SessionStatus.IDLE
    exported: bool = False
    mp4_path: Path | None = None
    gif_path: Path | None = None
    qr_path: Path | None = None
    download_url: str | None = None

@dataclass
class ExportResult:
    success: bool
    mp4_path: Path | None
    gif_path: Path | None
    qr_path: Path | None
    download_url: str | None
    elapsed_seconds: float
    error_message: str | None = None
```

### 6.1 File system layout

```
/home/maker/projects/
├── session_2026_05_09_143022/
│   ├── frames/
│   │   ├── frame_0001.png  (lossless PNG, 1280×720)
│   │   ├── frame_0002.png
│   │   └── ...
│   ├── output.mp4          (libx264, 10fps, 1280×720)
│   ├── output.gif          (lanczos, 640px width, palette)
│   ├── qr.png              (QR cho download URL)
│   ├── thumbnail.jpg       (frame 1, 320px)
│   └── project.json        (SessionMeta serialized)
├── session_2026_05_09_150515/
│   └── ...
└── _shared/                # Logo, sound effects, fallback assets
```

`project.json` schema khớp 100% spec §6.3.

---

## 7. Luồng dữ liệu chính

### 7.1 Khởi động ứng dụng

```
$ python -m neo_stopmotion
       │
       ▼
  app.py main()
       │
       ├─ QApplication(argv)
       ├─ Load defaults.toml
       ├─ Init logger (loguru → /var/log/neostopmotion/app.log)
       ├─ Init SignalBus (singleton)
       │
       ├─ Init core services:
       │    ├─ CaptureEngine.start()      → emit webcam_ready or webcam_error
       │    ├─ UARTListener.start()       → auto-detect port; ThingBot READY
       │    ├─ FrameManager()             → tạo session_YYYYMMDD_HHMMSS
       │    └─ ShareServer.start()        → http.server :8000 background
       │
       ├─ Init AppController (root QObject, exposed to QML)
       ├─ Register PreviewImageProvider("preview", capture_engine)
       │
       ├─ qml_engine.load("MainWindow.qml")
       └─ app.exec()  →  SplashScreen → CapturePage
```

### 7.2 Capture flow (SHOOT)

```
[HS bấm nút đỏ ThingBot]
       │
       ▼
ThingBot.loop() detects press → Serial.println("SHOOT")
       │
       ▼ USB-Serial 115200 baud
UARTWorker._listen_loop reads "SHOOT\n"
       │
       ▼ pyqtSignal
SignalBus.uart_command_received.emit("SHOOT")
       │
       ▼
AppController.handle_uart_command("SHOOT")
       │
       ├─ [F-11 optional] CountdownOverlay 3-2-1 (1s)
       │
       ├─ frame = CaptureEngine.capture_frame()
       │     ├─ ret, frame = cv2.VideoCapture.read()
       │     ├─ self.last_frame = frame.copy()  # cho onion skin frame sau
       │     └─ return frame  (KHÔNG có onion skin trong file thật!)
       │
       ├─ filepath = FrameManager.add_frame(frame)
       │     ├─ cv2.imwrite("frame_NNNN.png")
       │     ├─ session.frame_count += 1
       │     └─ _save_metadata()
       │
       ├─ NeoAudio.play("tach.wav")
       │
       ├─ UI flash white 100ms (overlay rectangle)
       │
       └─ SignalBus.frame_captured.emit(N, filepath)
              │
              ├─ AppState.frameCount = N (QML property binding)
              └─ ThumbnailStrip refresh (lấy 5 frame cuối)
```

### 7.3 Live preview (chạy nền liên tục)

```
QML Timer (33ms / ~30fps)
       │
       ▼
AppState.previewCounter++
       │
       ▼
Image.source = "image://preview/" + counter   (cache miss)
       │
       ▼
PreviewImageProvider.requestImage()
       │
       ▼
CaptureEngine.get_live_preview()
       │
       ├─ ret, current = cv2.VideoCapture.read()
       ├─ if last_frame is None: return current
       └─ blended = cv2.addWeighted(current, 0.7, last_frame, 0.3, 0)
              │
              ▼
cv_to_qimage(blended) → QImage RGB888
       │
       ▼
QML render → màn hình NEO One
```

### 7.4 Undo flow

```
ThingBot long press 1-3s → "UNDO\n"
       │
       ▼
AppController.handle_uart_command("UNDO")
       │
       ├─ if frame_count == 0: silent return
       │
       ├─ FrameManager.undo_last_frame()
       │     ├─ os.remove("frame_NNNN.png")
       │     ├─ frame_count -= 1
       │     └─ _save_metadata()
       │
       ├─ CaptureEngine.reload_last_frame_from_disk(N-1)
       │     # Để onion skin tiếp theo dùng đúng frame mới
       │
       ├─ NeoAudio.play("undo.wav")
       └─ SignalBus.frame_undone.emit(new_count)
```

### 7.5 Export flow

```
ThingBot very long press 3s+ → "EXPORT\n"
       │
       ▼
AppController.handle_export()
       │
       ├─ if frame_count < 5:
       │     status_message("warning", "Con chụp thêm vài tấm nữa nha!")
       │     return
       │
       ├─ [F-13 optional] TitleInputDialog
       │     session.title = user_input
       │
       ├─ AppState.status = "exporting"
       ├─ StackView.push(ExportingPage)
       │
       ├─ ExportWorker.start():    (QThread)
       │     ├─ progress(0.1) → "Ghép video..."
       │     ├─ VideoExporter.export_mp4(frames_dir, output_mp4)
       │     │     subprocess.run(["ffmpeg", "-framerate", "10",
       │     │       "-i", "frame_%04d.png", "-c:v", "libx264",
       │     │       "-pix_fmt", "yuv420p", output_mp4])
       │     │
       │     ├─ progress(0.5) → "Tạo GIF..."
       │     ├─ VideoExporter.export_gif(frames_dir, output_gif)
       │     │     # 2-pass: palettegen + paletteuse
       │     │
       │     ├─ progress(0.9) → "Tạo mã QR..."
       │     ├─ url = ShareServer.get_download_url(session_id)
       │     ├─ qr_path = ShareServer.generate_qr(url)
       │     │
       │     └─ progress(1.0) → emit export_completed(result)
       │
       ├─ AppState.status = "completed"
       └─ StackView.replace(SuccessPage)
              ├─ Video preview loop (MediaPlayer)
              ├─ QR code lớn (Image)
              ├─ Hướng dẫn: "PH quét QR bằng Zalo để tải phim"
              └─ Button "Quay lại làm phim mới" → reset session
```

---

## 8. UART Protocol đặc tả

### 8.1 Wire format

- Baud rate: **115200** 8N1
- Encoding: ASCII text + `\n` terminator
- Direction: ThingBot → NEO One (one-way trong v1.0)

### 8.2 Commands

| Lệnh | Hướng | Trigger | Hành động NEO One |
|---|---|---|---|
| `READY\n` | TB → N1 | Boot ThingBot | Status banner "Sẵn sàng" |
| `SHOOT\n` | TB → N1 | Single press <1s | Capture 1 frame |
| `UNDO\n` | TB → N1 | Long press 1-3s | Delete last frame |
| `EXPORT\n` | TB → N1 | Very long press 3s+ | Export MP4+GIF |
| `BAT_LOW\n` | TB → N1 | Voltage <3.4V | UI cảnh báo pin yếu |

### 8.3 Auto-detect & reconnect

```python
# uart_listener.py
COMMON_PORTS = ["/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/ttyACM0", "/dev/ttyACM1"]

def auto_detect_port() -> str | None:
    for port in COMMON_PORTS + glob("/dev/tty.usbserial-*"):
        try:
            s = serial.Serial(port, 115200, timeout=2)
            line = s.readline().decode().strip()
            if line == "READY":
                return port
        except (serial.SerialException, UnicodeDecodeError):
            continue
    return None
```

Reconnect loop chạy mỗi 2s khi `serial.SerialException`. UI hiển thị banner amber "Nút bấm tạm nghỉ — dùng phím Space" và bật keyboard fallback.

### 8.4 Keyboard fallback (test + emergency)

| Key | Command |
|---|---|
| `Space` | SHOOT |
| `Z` | UNDO |
| `Enter` | EXPORT |
| `R` | Reset session |
| `Esc` | Quit (admin only, cần Ctrl+Esc 3 lần) |

---

## 9. Design tokens (`NeoConstants.qml` — port từ NEOSTEM)

Copy `NeoConstants.qml` từ NEOSTEM (`/Users/tuanln/NEO_STEM/src/core/NeoConstants.qml`), override:

```qml
// Singleton — design tokens
pragma Singleton
import QtQuick

QtObject {
    // Brand colors — phim/animation theme
    readonly property color primary:    "#FF7043"   // Coral (bước 1 NEOSTEM)
    readonly property color secondary:  "#1565C0"   // Ocean Blue
    readonly property color accent:     "#FFD600"   // Sunshine (sao thành tích)
    readonly property color background: "#FFF8E1"   // Rice Paper
    readonly property color surface:    "#FFFFFF"
    readonly property color textPrimary: "#212121"
    readonly property color success:    "#2E7D32"
    readonly property color warning:    "#FF8F00"
    readonly property color error:      "#C62828"

    // Typography (Be Vietnam Pro)
    property bool largeTextMode: false
    readonly property real textScale:    largeTextMode ? 1.25 : 1.0
    readonly property int fontTitle:     Math.round(36 * textScale)
    readonly property int fontBody:      Math.round(24 * textScale)
    readonly property int fontButton:    Math.round(24 * textScale)
    readonly property int fontCaption:   Math.round(18 * textScale)
    readonly property int fontFrameCount: Math.round(72 * textScale)  // big & bold

    // Touch targets (trẻ em)
    readonly property int touchMin:      largeTextMode ? 60 : 52
    readonly property int buttonHeight:  largeTextMode ? 68 : 60
    readonly property int previewWidth:  1280
    readonly property int previewHeight: 720

    // Animation
    readonly property int animFast:    200
    readonly property int animNormal:  400
    readonly property int animSlow:    800

    // Stop-motion specific
    readonly property real onionOpacity: 0.30   // 30% blend
    readonly property int targetFps:     10     // playback fps
    readonly property int minFrames:     5
    readonly property int maxFrames:     100
}
```

---

## 10. Cấu hình hệ thống (`config/defaults.toml`)

```toml
[app]
name = "NeoStopMotion"
version = "1.0.0"
language = "vi"
debug = false

[capture]
webcam_index = 0
resolution_width = 1280
resolution_height = 720
preview_fps = 30
onion_opacity = 0.30
auto_retry_count = 3

[uart]
port = "auto"               # auto-detect; or "/dev/ttyUSB0", "simulator"
baudrate = 115200
reconnect_interval_seconds = 2
keyboard_fallback = true

[export]
playback_fps = 10
min_frames = 5
max_frames = 100
mp4_codec = "libx264"
mp4_pix_fmt = "yuv420p"
gif_scale_width = 640
ffmpeg_binary = "ffmpeg"

[storage]
projects_dir = "/home/maker/projects"
max_sessions = 50
auto_cleanup_threshold_mb = 100

[server]
http_port = 8000
qr_size = 400

[ui]
fullscreen = true
window_width = 1920
window_height = 1080
font_family = "Be Vietnam Pro"
sound_enabled = true
flash_on_capture = true
show_countdown = true       # F-11
show_thumbnail_strip = true # F-12
ask_title_before_export = true # F-13
```

User config override tại `~/.config/neostopmotion/config.toml`. Env variables override config (e.g. `NEO_STOPMOTION_UART_PORT=simulator`).

---

## 11. Edge cases & error handling

(Mở rộng từ Chương 7 spec)

| Tình huống | Layer | Chiến lược | UI |
|---|---|---|---|
| Webcam không mở được | CaptureEngine | Auto-retry 3 lần với delay 1s; nếu vẫn fail emit `webcam_error` | Banner đỏ: "Webcam đang ngủ — gọi Thợ Cả" |
| Webcam disconnect runtime | CaptureWorker | Bắt `cv2.error`, retry mở lại 3 lần | Banner amber + freeze last frame |
| ThingBot UART chưa cắm khi boot | UARTListener | auto_detect_port() returns None → start in keyboard mode | Banner amber: "Nút bấm chưa cắm — dùng phím Space" |
| ThingBot UART mất kết nối runtime | UARTWorker | Reconnect loop 2s + keyboard fallback bật | Banner amber tạm thời |
| Storage <100MB free | FrameManager | Auto delete `session_*` cũ nhất | Banner: "Sắp hết chỗ — đang dọn..." |
| HS bấm SHOOT quá nhanh | UARTListener | Debounce phía Python 200ms (defensive, ngoài 50ms firmware) | (im lặng) |
| HS bấm UNDO khi chưa có frame | AppController | Silent no-op | (im lặng) |
| HS bấm EXPORT khi <5 frames | AppController | Toast | "Con chụp thêm vài tấm nữa nha!" |
| ffmpeg fail (codec/perm) | ExportWorker | Log stderr, retry 1 lần, sau đó báo lỗi | "Đang gặp trục trặc — Thợ Cả đang xử lý" |
| Frame quá tối (histogram p50<30) | CaptureEngine | Emit `low_light_warning` (optional) | Hint: "Hơi tối — bật đèn nhé!" |
| Mất điện đột ngột | FrameManager | PNG đã ghi atomic vẫn còn; restart app sẽ tạo session mới | Sau khởi động lại |
| QR scan không tải được | ShareServer | Check WiFi same network; show SSID + password trên UI | "PH ơi, kết nối WiFi: Maker_Lang_FPT / pass: ..." |
| Disk write fail | FrameManager | Bubble up `IOError` | "Lỗi lưu file — gọi Thợ Cả" |

---

## 12. Quyết định thiết kế quan trọng

### 12.1 PyQt6 + QML thay vì Tkinter (override spec §4.3)

**Spec gốc đề xuất Tkinter**, nhưng chúng tôi override:
- **Lý do**: học pattern NEOSTEM (Singletons + StackView + design tokens), UI fluid touch, animation native, scale tốt cho các trạm tương lai.
- **Trade-off**: Tkinter đơn giản hơn (1 tuần xong), QML mất ~3 tuần nhưng đẹp + tái sử dụng được.

### 12.2 OpenCV cho onion skin (giữ theo spec)

`cv2.addWeighted(current, 0.7, last_frame, 0.3, 0)` — 1 dòng code, đáng tin cậy. Không tự implement bằng QImage manipulation vì sẽ chậm hơn 3-5×.

### 12.3 Onion skin CHỈ ở live preview, KHÔNG vào file frame thật

**Critical**: nhiều dev nhầm điểm này → phim bị motion blur giả. CaptureEngine có 2 method tách bạch:
- `get_live_preview()` → có onion skin (để hiển thị)
- `capture_frame()` → KHÔNG có onion skin (để lưu file)

### 12.4 SignalBus pattern thay vì callback chains

Scale tốt khi thêm features Phase 2 (voice-over, slow-motion, YouTube upload). Test dễ hơn (mock signals).

### 12.5 Worker Thread cho mọi I/O nặng

UI luôn responsive ≥30fps trên NEO One 2GB RAM. Không bao giờ chạy `cv2.read()` hoặc `subprocess.run(ffmpeg)` trên main thread.

### 12.6 UART Simulator cho dev macOS

Dev không cần ThingBot vật lý: env `NEO_STOPMOTION_UART=simulator` → bật keyboard listener mock SHOOT/UNDO/EXPORT. Tăng tốc dev cycle 5-10×.

### 12.7 Privacy-first, no cloud

Tất cả lưu local trên NEO One. QR chỉ accessible trong WiFi LAN. Không upload lên internet ở v1.0 (Phase 2 mới có YouTube auto-upload).

### 12.8 Mã nguồn mở MIT

Theo cam kết Bình Dân Học STEM. Public GitHub BBStopMotion.

### 12.9 Atomic write cho PNG

`cv2.imwrite(tmp_path)` rồi `os.rename(tmp_path, final_path)` để mất điện không corrupt frame.

### 12.10 Reuse pattern NEOSTEM cho tương lai

Nếu thành công Trạm 6, có thể fork ra Trạm 7/8/9 (game station, music station, AR station) với cùng `NeoConstants` + `StackView` + Singleton skeleton.

---

## 13. Phân tách công việc (Work Breakdown Structure)

Tuân theo **Phase 1 v0.1 → v1.0** trong spec Chương 10. Chia làm **6 epic, 28 task, 3 tuần** với team 1 backend + 1 UI + 1 firmware (đúng theo Chương 9 spec).

### Epic 1 — Foundation (3 ngày, 5 tasks)

Mục tiêu: khung chạy được, deploy local thành công.

| ID | Task | Owner | Output |
|---|---|---|---|
| T1.1 | Tạo project skeleton + `pyproject.toml` + `requirements.txt` | Backend | Repo init, `pip install -e .` work |
| T1.2 | PyQt6 + QML scaffold, `MainWindow.qml` fullscreen + StackView | UI | `python -m neo_stopmotion` hiện cửa sổ trắng |
| T1.3 | SignalBus singleton + Logging (loguru) + Config loader (TOML) | Backend | Unit test pass |
| T1.4 | NeoConstants.qml port từ NEOSTEM + custom palette | UI | Splash screen với màu Coral hiển thị |
| T1.5 | pytest + pytest-qt setup + GitHub Actions CI | Backend | Green CI badge |

**Demo criteria**: `python -m neo_stopmotion` hiện splash screen "Trạm 6 — Làm Phim", chuyển sang CapturePage (placeholder) sau 2s, màu Coral.

### Epic 2 — Capture Pipeline (4 ngày, 6 tasks)

Mục tiêu: live preview + onion skin + lưu PNG hoạt động trên macOS.

| ID | Task | Owner | Output |
|---|---|---|---|
| T2.1 | `CaptureEngine` cv2 webcam + resolution + retry logic | Backend | Unit test mở/đóng webcam |
| T2.2 | Onion skinning `cv2.addWeighted` + opacity config | Backend | Unit test compare pixel value |
| T2.3 | `PreviewImageProvider` (QQuickImageProvider) | Backend | LivePreview hiển thị webcam thật |
| T2.4 | `LivePreview.qml` + Timer 30fps + cache invalidation | UI | Smooth preview ≥30fps |
| T2.5 | `FrameManager`: PNG save atomic + project.json | Backend | Unit test add/undo/list |
| T2.6 | Keyboard fallback Space/Z/Enter cho test | Backend | Bấm Space → frame mới hiện onion skin |

**Demo criteria**: Bấm Space, frame mới được lưu vào `/tmp/session_*/frames/frame_0001.png`, thumbnail hiện ở góc, onion skin của frame trước hiển thị mờ.

### Epic 3 — UART & ThingBot (3 ngày, 5 tasks, song song với Epic 2)

Mục tiêu: nút bấm vật lý → frame captured.

| ID | Task | Owner | Output |
|---|---|---|---|
| T3.1 | Firmware Arduino `thingbot_stopmotion.ino` theo spec §5.1 | Firmware | 1 board mẫu flash xong |
| T3.2 | `UARTListener` pyserial + QThread + auto-detect | Backend | Mở port + đọc lệnh |
| T3.3 | `UARTSimulator` (dev macOS) + protocol parser | Backend | Env switch hoạt động |
| T3.4 | Reconnect loop 2s + StatusBanner.qml UI | Backend + UI | Disconnect → banner amber, reconnect → banner xanh |
| T3.5 | Integration test: simulator → frame_captured signal | Backend | pytest e2e pass |

**Demo criteria**: Cắm ThingBot vào NEO One, bấm nút đỏ vật lý → frame mới capture, LED nhấp nháy đồng thời UI flash trắng. Bấm giữ 1.5s → UNDO frame cuối. Bấm giữ 3.5s → trigger export.

### Epic 4 — Export Pipeline (3 ngày, 4 tasks)

Mục tiêu: ghép MP4 + GIF không block UI.

| ID | Task | Owner | Output |
|---|---|---|---|
| T4.1 | `VideoExporter.export_mp4` ffmpeg libx264 + unit test | Backend | MP4 hợp lệ phát được trên macOS Quick Look |
| T4.2 | `VideoExporter.export_gif` 2-pass palette + unit test | Backend | GIF mượt, kích thước <5MB cho 50 frames |
| T4.3 | `ExportWorker` QThread + progress signals | Backend | Progress bar 0→100% mượt |
| T4.4 | `ExportingPage.qml` với progress bar + animation | UI | Loading screen đẹp khi ghép |

**Demo criteria**: Sau khi capture 30 frames, bấm Enter (EXPORT), progress bar chạy ~5-10s, MP4 + GIF xuất hiện trong session folder, mở phát mượt 10fps.

### Epic 5 — Share & Polish (3 ngày, 6 tasks)

Mục tiêu: QR + UX polish + SHOULD-have features.

| ID | Task | Owner | Output |
|---|---|---|---|
| T5.1 | `ShareServer` http.server QThread + auto local IP | Backend | URL `http://192.168.x.x:8000/session_*/output.mp4` truy cập được |
| T5.2 | QR generator + `QRDisplay.qml` | Backend + UI | QR scan bằng Zalo → tải MP4 |
| T5.3 | `SuccessPage.qml` + replay loop (MediaPlayer) + reset button | UI | Click "Quay lại" → CapturePage session mới |
| T5.4 | `NeoAudio.qml` (tách/undo/success) + UI flash 100ms | UI | Tiếng "tách" rõ khi capture |
| T5.5 | F-11 CountdownOverlay 3-2-1 (configurable) | UI | Trước SHOOT 1s đếm ngược |
| T5.6 | F-12 ThumbnailStrip 5 frame cuối + F-13 TitleInputDialog | UI | Bàn phím ảo gõ tiêu đề |

**Demo criteria**: 1 session đầy đủ flow: 30 frames → bấm EXPORT → countdown → ghép video → SuccessPage → quét QR → tải MP4 + GIF thành công trên điện thoại.

### Epic 6 — Deploy & Pilot (2 ngày, 4 tasks)

Mục tiêu: chạy được trên NEO One thật, pilot 10 HS.

| ID | Task | Owner | Output |
|---|---|---|---|
| T6.1 | `install-armbian.sh` + dependencies cho NEO One | Backend | Script chạy 1 lệnh xong |
| T6.2 | `neostopmotion.service` systemd + auto-start kiosk eglfs | Backend | Boot NEO One → app fullscreen sau 30s |
| T6.3 | Deploy 1 NEO One thật, smoke test 10 session liên tục | Toàn team | Không crash sau 10 session |
| T6.4 | Pilot 10 HS thật, thu feedback, log bug | Toàn team + 10 HS | Báo cáo bug v1.1 |

**Demo criteria**: 10 HS thật từ 6-14 tuổi tự hoàn thành full flow (chụp ≥20 frames, export, quét QR, tải về), ≥80% nhận MP4 thành công, không crash app.

### Phụ thuộc DAG

```
Epic 1 (Foundation)
    │
    ├──→ Epic 2 (Capture Pipeline) ──┐
    │                                 ├──→ Epic 4 (Export) ──→ Epic 5 (Share + Polish) ──→ Epic 6 (Deploy)
    └──→ Epic 3 (UART & ThingBot) ───┘
```

Epic 2 & 3 chạy song song (1 backend + 1 firmware). Epic 4 cần Epic 2 done. Epic 5 cần Epic 4 done. Epic 6 là cuối cùng.

### Tổng timeline

| Tuần | Hoạt động | Deliverable |
|---|---|---|
| Tuần 1 | Epic 1 (3d) + Epic 2/3 song song (4d) | v0.2: capture + onion skin + UART hoạt động |
| Tuần 2 | Epic 4 (3d) + Epic 5 (3d) | v0.9: full flow MUST + SHOULD |
| Tuần 3 | Epic 6 (2d) + buffer 3d cho QA + bug fix pilot | **v1.0**: pilot xong tại 1 Làng Maker |

Khớp với Chương 9 spec (3 tuần kick-off → v1.0).

---

## 14. Sơ đồ component interaction

```
                +-------------------------+
                |     MainWindow.qml      |
                |   (StackView root)      |
                +-----------+-------------+
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
+-------▼--------+  +-------▼--------+  +-------▼--------+
|  CapturePage   |  | ExportingPage  |  |  SuccessPage   |
|                |  |                |  |                |
| LivePreview    |  | ProgressBar    |  | VideoPlayer    |
| FrameCounter   |  | StatusText     |  | QRDisplay      |
| ThumbStrip     |  |                |  | ResetButton    |
| HintBar        |  |                |  |                |
+-------+--------+  +-------+--------+  +-------+--------+
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                  +---------▼---------+
                  |  AppController    |
                  | (root QObject     |
                  |  exposed to QML)  |
                  +---------+---------+
                            │
                  +---------▼---------+
                  |    SignalBus      |
                  | (pyqtSignal hub)  |
                  +---------+---------+
                            │
        ┌───────────────────┼───────────────────┬─────────────────┐
        │                   │                   │                 │
+-------▼--------+  +-------▼--------+  +-------▼--------+  +-----▼------+
| CaptureEngine  |  | UARTListener   |  | FrameManager   |  | Export     |
| (cv2 + onion   |  | (pyserial +    |  | (PNG +         |  | Worker     |
|  skin)         |  |  QThread)      |  |  metadata)     |  | (ffmpeg)   |
+----------------+  +-------+--------+  +----------------+  +-----+------+
                            │                                     │
                +-----------▼----------+                +---------▼---------+
                |   ThingBot Board     |                | ShareServer       |
                | (ESP32 UART 115200)  |                | (http.server +    |
                | - Button             |                |  qrcode)          |
                | - LED feedback       |                |                   |
                | - Buzzer             |                +-------------------+
                +----------------------+
```

---

## 15. Tiêu chí thành công v1.0

| Metric | Ngưỡng |
|---|---|
| App boot time trên NEO One | <10s từ power-on |
| Live preview FPS | ≥25 fps trên NEO One 2GB |
| Onion skin latency | <100ms |
| Capture-to-PNG latency | <500ms |
| Export 30 frames → MP4 | <8s |
| Export 30 frames → GIF | <12s |
| Crash-free session | ≥99% (10/10 pilot HS) |
| HS hoàn thành flow trong 30 phút | ≥90% |
| PH tải MP4 về điện thoại | ≥80% |
| Bug count P0/P1 sau pilot | ≤3 |

---

## 16. Roadmap sau v1.0

### Phase 2 — Pilot mở rộng (Tuần 4-8)

- v1.1: bug fixes + UX cải tiến từ feedback pilot
- v1.2: thêm SHOULD-have còn thiếu nếu có
- Triển khai 3 Làng Maker pilot (HN — ĐN — SG)

### Phase 3 — Mở rộng 34 Làng (Tuần 9+)

- Phase 2 features (NICE-to-have spec §3.3):
  - F-14: Slow/fast motion (thay đổi playback fps)
  - F-15: Voice-over recording sau export
  - F-16: Auto-upload kênh YouTube Làng Maker
  - F-17: Showcase Wall tự động cập nhật phim mới
- Phase 4 (xa hơn): AI assistant gợi ý storyline, AR effects, multi-language

---

## 17. Tài liệu liên quan

- `DOC/HARDWARE.md` — Sơ đồ ThingBot + nối dây + BOM
- `DOC/DEPLOY_NEO_ONE.md` — Hướng dẫn cài đặt NEO One step-by-step
- `DOC/TEACHER_MANUAL.md` — Cheatsheet cho Thợ Cả vận hành tại trạm
- `DOC/PROTOCOL.md` — UART Protocol đặc tả chi tiết
- Spec gốc: `/Users/tuanln/Downloads/NEO_StopMotion_Tram6_Spec.md`
- Tham chiếu: `NEOSTEM/ARCHITECTURE.md`, `NEO_CODE/DOC/ARCHITECTURE.md`

---

## 18. License & Credits

- **Phát triển**: BBStopMotion contributors
- **Stack**: Python 3.10+ / PyQt6 / QML 6 / OpenCV / ffmpeg
- **License**: MIT (cam kết public sau pilot, theo tinh thần Bình Dân Học STEM)
- **Cảm ơn**: Tinkering Studio (Exploratorium) cho Animation Station nguyên bản

---

> *"Chúng ta không chỉ làm một ứng dụng làm phim. Chúng ta đang trao cho một đứa trẻ 8 tuổi quyền lực kể câu chuyện của riêng mình bằng công nghệ — và đó chính là Constructionism."*
> — BBStopMotion contributors, 05/2026

**HẾT TÀI LIỆU KIẾN TRÚC v0.1 (Design)**
