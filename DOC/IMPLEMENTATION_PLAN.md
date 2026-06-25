# NeoStopMotion v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng app stop-motion v1.0 cho Trạm 6 Làng Maker — chạy trên NEO One (ARM64, 2GB RAM, Ubuntu 22.04), kết nối ThingBot qua UART, chụp frame webcam có onion skin, xuất MP4+GIF, share qua QR code.

**Architecture:** 4 lớp (UI QML / Application Service / Core / Hardware-Data), kế thừa SignalBus + Worker Thread từ NEO_CODE và Singleton + StackView design tokens từ NEOSTEM. Stack thống nhất Python 3.10+ / PyQt6 / QML 6.

**Tech Stack:** Python 3.10+, PyQt6 ≥6.5, QML 6, OpenCV 4.8+, pyserial 3.5+, ffmpeg (subprocess), qrcode + Pillow, pytest + pytest-qt, ruff + mypy, Arduino IDE/PlatformIO.

**Reference docs:** `DOC/ARCHITECTURE.md` (design), `/Users/tuanln/Downloads/NEO_StopMotion_Tram6_Spec.md` (spec gốc).

---

## File structure (28 tasks → ~50 files)

```
src/neo_stopmotion/
├── __init__.py                       T1.1
├── __main__.py                       T1.2
├── app.py                            T1.2
├── config/
│   ├── __init__.py                   T1.3
│   ├── settings.py                   T1.3
│   └── defaults.toml                 T1.3
├── utils/
│   ├── __init__.py                   T1.3
│   ├── signal_bus.py                 T1.3
│   ├── logging_config.py             T1.3
│   ├── cv_qt_bridge.py               T2.3
│   └── network.py                    T5.1
├── core/
│   ├── __init__.py                   T2.1
│   ├── models.py                     T2.5
│   ├── capture_engine.py             T2.1, T2.2
│   ├── frame_manager.py              T2.5
│   ├── video_exporter.py             T4.1, T4.2
│   └── share_server.py               T5.1
├── hardware/
│   ├── __init__.py                   T3.2
│   ├── uart_protocol.py              T3.2
│   ├── uart_listener.py              T3.2, T3.4
│   └── uart_simulator.py             T3.3
├── services/
│   ├── __init__.py                   T2.6
│   ├── app_controller.py             T2.6, T3.5, T4.3, T5.3
│   ├── session_service.py            T2.5
│   └── export_service.py             T4.3
├── ui/
│   ├── __init__.py                   T1.2
│   ├── image_provider.py             T2.3
│   ├── qml_loader.py                 T1.2
│   └── qml/
│       ├── MainWindow.qml            T1.2
│       ├── pages/
│       │   ├── SplashScreen.qml      T1.4
│       │   ├── CapturePage.qml       T2.4, T5.4..T5.6
│       │   ├── ExportingPage.qml     T4.4
│       │   └── SuccessPage.qml       T5.3
│       ├── components/
│       │   ├── LivePreview.qml       T2.4
│       │   ├── FrameCounter.qml      T2.4
│       │   ├── ThumbnailStrip.qml    T5.6
│       │   ├── HintBar.qml           T2.4
│       │   ├── CountdownOverlay.qml  T5.5
│       │   ├── QRDisplay.qml         T5.2
│       │   ├── TitleInputDialog.qml  T5.6
│       │   └── StatusBanner.qml      T3.4
│       └── singletons/
│           ├── qmldir                T1.4
│           ├── NeoConstants.qml      T1.4
│           ├── NeoAudio.qml          T5.4
│           └── AppState.qml          T1.4
└── resources/                         T5.4
    ├── sounds/{tach,undo,success}.wav
    ├── fonts/BeVietnamPro-Regular.ttf
    └── images/{logo,splash}.png

firmware/thingbot_stopmotion/
└── thingbot_stopmotion.ino           T3.1

deployment/
├── install-armbian.sh                T6.1
├── neostopmotion.service             T6.2
├── requirements-arm64.txt            T6.1
└── udev/99-thingbot.rules            T6.2

tests/
├── conftest.py                       T1.5
├── unit/
│   ├── test_signal_bus.py            T1.3
│   ├── test_settings.py              T1.3
│   ├── test_capture_engine.py        T2.1, T2.2
│   ├── test_frame_manager.py         T2.5
│   ├── test_video_exporter.py        T4.1, T4.2
│   ├── test_share_server.py          T5.1
│   └── test_uart_protocol.py         T3.2
├── integration/
│   ├── test_capture_to_export.py     T4.3
│   └── test_uart_simulator.py        T3.5
└── e2e/
    └── test_full_session.py          T6.3

pyproject.toml                        T1.1
requirements.txt                      T1.1
requirements-dev.txt                  T1.5
.gitignore                            T1.1
.github/workflows/ci.yml              T1.5
Makefile                              T1.1
README.md                             T1.1
```

---

# Epic 1 — Foundation (3 ngày, 5 tasks)

## Task T1.1: Project Skeleton

**Files:**
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/pyproject.toml`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/requirements.txt`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/.gitignore`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/Makefile`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/README.md`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/src/neo_stopmotion/__init__.py`

- [ ] **Step 1: Tạo pyproject.toml**

```toml
[project]
name = "neo-stopmotion"
version = "0.1.0"
description = "Stop-motion studio cho Trạm 6 Làng Maker @ FPT Shop"
authors = [{name = "BBStopMotion contributors"}]
license = {text = "MIT"}
readme = "README.md"
requires-python = ">=3.10"
dependencies = [
    "PyQt6>=6.5.0",
    "opencv-python-headless>=4.8.0",
    "numpy>=1.24.0",
    "pyserial>=3.5",
    "qrcode[pil]>=7.4",
    "Pillow>=10.0.0",
    "loguru>=0.7.0",
    "tomli>=2.0.1; python_version<'3.11'",
]

[project.scripts]
neo-stopmotion = "neo_stopmotion.__main__:main"

[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]

[tool.setuptools.package-data]
neo_stopmotion = ["ui/qml/**/*.qml", "ui/qml/**/qmldir", "config/*.toml", "resources/**/*"]

[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "N"]
ignore = ["E501"]

[tool.mypy]
python_version = "3.10"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

- [ ] **Step 2: Tạo requirements.txt** (pinned cho reproducibility)

```
PyQt6==6.6.1
PyQt6-Qt6==6.6.1
opencv-python-headless==4.8.1.78
numpy==1.26.2
pyserial==3.5
qrcode[pil]==7.4.2
Pillow==10.1.0
loguru==0.7.2
tomli==2.0.1; python_version<"3.11"
```

- [ ] **Step 3: Tạo .gitignore**

```
__pycache__/
*.py[cod]
*.egg-info/
.eggs/
dist/
build/
.venv/
venv/
.env
.coverage
htmlcov/
.pytest_cache/
.mypy_cache/
.ruff_cache/
.DS_Store
*.log
/home/maker/projects/
*.qmlc
*.jsc
```

- [ ] **Step 4: Tạo Makefile**

```makefile
.PHONY: install dev test lint format build clean

install:
	pip install -e .

dev:
	pip install -e ".[dev]" || pip install -e .
	pip install -r requirements-dev.txt

test:
	pytest -v --cov=neo_stopmotion --cov-report=term-missing

lint:
	ruff check src tests
	mypy src

format:
	ruff format src tests
	ruff check --fix src tests

run:
	python -m neo_stopmotion

run-sim:
	NEO_STOPMOTION_UART=simulator python -m neo_stopmotion

build:
	python -m build

clean:
	rm -rf build dist *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
```

- [ ] **Step 5: Tạo README.md tối thiểu**

```markdown
# NeoStopMotion

Stop-motion studio cho Trạm 6 Làng Maker @ FPT Shop. Chạy trên NEO One.

## Quick start (dev)

```bash
make dev
make run-sim   # macOS dev với UART simulator
```

## Docs

- [Kiến trúc](DOC/ARCHITECTURE.md)
- [Implementation plan](DOC/IMPLEMENTATION_PLAN.md)
```

- [ ] **Step 6: Tạo `src/neo_stopmotion/__init__.py`**

```python
"""NeoStopMotion — Stop-motion studio for Trạm 6 Làng Maker."""

__version__ = "0.1.0"
```

- [ ] **Step 7: Verify install + commit**

```bash
cd /Users/tuanln/Ai-Code/NeoStopMotion
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -c "import neo_stopmotion; print(neo_stopmotion.__version__)"
```

Expected output: `0.1.0`

```bash
git add pyproject.toml requirements.txt .gitignore Makefile README.md src/neo_stopmotion/__init__.py
git commit -m "chore: project skeleton + pyproject + basic README"
```

---

## Task T1.2: PyQt6 + QML Scaffold (Hello Window)

**Files:**
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/src/neo_stopmotion/__main__.py`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/src/neo_stopmotion/app.py`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/src/neo_stopmotion/ui/__init__.py`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/src/neo_stopmotion/ui/qml_loader.py`
- Create: `/Users/tuanln/Ai-Code/NeoStopMotion/src/neo_stopmotion/ui/qml/MainWindow.qml`

- [ ] **Step 1: Viết test scaffold cho qml_loader**

`tests/unit/test_qml_loader.py`:
```python
from PyQt6.QtCore import QCoreApplication
from neo_stopmotion.ui.qml_loader import find_qml_root


def test_find_qml_root_returns_existing_path():
    path = find_qml_root()
    assert path.exists()
    assert (path / "MainWindow.qml").exists()
```

- [ ] **Step 2: Run test — expect FAIL (module chưa tồn tại)**

```bash
pytest tests/unit/test_qml_loader.py -v
```
Expected: `ModuleNotFoundError: No module named 'neo_stopmotion.ui.qml_loader'`

- [ ] **Step 3: Tạo `src/neo_stopmotion/ui/__init__.py` (empty)**

```python
"""UI layer — QML loader, image provider, QML files."""
```

- [ ] **Step 4: Tạo `src/neo_stopmotion/ui/qml_loader.py`**

```python
from pathlib import Path


def find_qml_root() -> Path:
    """Return absolute path to the QML files directory."""
    return Path(__file__).parent / "qml"


def main_qml_path() -> Path:
    """Return absolute path to the MainWindow.qml entry."""
    return find_qml_root() / "MainWindow.qml"
```

- [ ] **Step 5: Tạo `src/neo_stopmotion/ui/qml/MainWindow.qml`**

```qml
import QtQuick
import QtQuick.Controls
import QtQuick.Window

ApplicationWindow {
    id: root
    width: 1280
    height: 720
    visible: true
    title: "NeoStopMotion — Trạm 6"

    Rectangle {
        anchors.fill: parent
        color: "#FFF8E1"

        Text {
            anchors.centerIn: parent
            text: "Chào Trạm 6 — Làm Phim Hoạt Hình"
            font.pixelSize: 36
            color: "#FF7043"
        }
    }
}
```

- [ ] **Step 6: Run test → PASS**

```bash
pytest tests/unit/test_qml_loader.py -v
```
Expected: `1 passed`

- [ ] **Step 7: Tạo `src/neo_stopmotion/app.py`**

```python
import sys
from PyQt6.QtCore import QUrl
from PyQt6.QtGui import QGuiApplication
from PyQt6.QtQml import QQmlApplicationEngine

from neo_stopmotion.ui.qml_loader import main_qml_path


def run() -> int:
    """Application entry — launch the QML UI."""
    app = QGuiApplication(sys.argv)
    app.setApplicationName("NeoStopMotion")
    app.setOrganizationName("MakerViet")

    engine = QQmlApplicationEngine()
    engine.load(QUrl.fromLocalFile(str(main_qml_path())))

    if not engine.rootObjects():
        print("Failed to load QML", file=sys.stderr)
        return 1

    return app.exec()
```

- [ ] **Step 8: Tạo `src/neo_stopmotion/__main__.py`**

```python
import sys
from neo_stopmotion.app import run


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
```

- [ ] **Step 9: Smoke test bằng tay**

```bash
python -m neo_stopmotion
```
Expected: cửa sổ 1280×720 nền `#FFF8E1`, chữ "Chào Trạm 6 — Làm Phim Hoạt Hình" giữa màn hình. Đóng bằng Cmd+Q.

- [ ] **Step 10: Commit**

```bash
git add src/neo_stopmotion/__main__.py src/neo_stopmotion/app.py src/neo_stopmotion/ui/ tests/unit/test_qml_loader.py
git commit -m "feat(ui): PyQt6 + QML scaffold with MainWindow placeholder"
```

---

## Task T1.3: SignalBus + Logging + Config

**Files:**
- Create: `src/neo_stopmotion/utils/__init__.py`
- Create: `src/neo_stopmotion/utils/signal_bus.py`
- Create: `src/neo_stopmotion/utils/logging_config.py`
- Create: `src/neo_stopmotion/config/__init__.py`
- Create: `src/neo_stopmotion/config/settings.py`
- Create: `src/neo_stopmotion/config/defaults.toml`
- Create: `tests/unit/test_signal_bus.py`
- Create: `tests/unit/test_settings.py`

- [ ] **Step 1: Test SignalBus emit/connect**

`tests/unit/test_signal_bus.py`:
```python
from neo_stopmotion.utils.signal_bus import SignalBus


def test_signal_bus_singleton():
    a = SignalBus.instance()
    b = SignalBus.instance()
    assert a is b


def test_signal_bus_uart_command_received(qtbot):
    bus = SignalBus.instance()
    received = []
    bus.uart_command_received.connect(lambda cmd: received.append(cmd))
    bus.uart_command_received.emit("SHOOT")
    assert received == ["SHOOT"]


def test_signal_bus_frame_captured(qtbot):
    bus = SignalBus.instance()
    received = []
    bus.frame_captured.connect(lambda n, p: received.append((n, p)))
    bus.frame_captured.emit(1, "/tmp/frame_0001.png")
    assert received == [(1, "/tmp/frame_0001.png")]
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pytest tests/unit/test_signal_bus.py -v
```
Expected: `ModuleNotFoundError`

- [ ] **Step 3: Tạo `src/neo_stopmotion/utils/__init__.py`**

```python
"""Utility modules — signal bus, logging, bridges."""
```

- [ ] **Step 4: Tạo `src/neo_stopmotion/utils/signal_bus.py`**

```python
from __future__ import annotations
from PyQt6.QtCore import QObject, pyqtSignal


class SignalBus(QObject):
    """Centralized event hub. Modules emit/listen via this singleton."""

    # UART
    uart_command_received = pyqtSignal(str)
    uart_disconnected = pyqtSignal()
    uart_reconnected = pyqtSignal()

    # Capture
    webcam_ready = pyqtSignal()
    webcam_error = pyqtSignal(str)
    frame_captured = pyqtSignal(int, str)
    frame_undone = pyqtSignal(int)

    # Session
    session_reset = pyqtSignal()

    # Export
    export_started = pyqtSignal()
    export_progress = pyqtSignal(float)
    export_completed = pyqtSignal(dict)
    export_failed = pyqtSignal(str)

    # Share
    share_url_ready = pyqtSignal(str, str)

    # App
    status_message = pyqtSignal(str, str)  # level, message

    _instance: "SignalBus | None" = None

    @classmethod
    def instance(cls) -> "SignalBus":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
```

- [ ] **Step 5: Run test → PASS**

```bash
pytest tests/unit/test_signal_bus.py -v
```
Expected: `3 passed`

- [ ] **Step 6: Tạo `src/neo_stopmotion/utils/logging_config.py`**

```python
import sys
from pathlib import Path
from loguru import logger


def configure_logging(log_dir: Path | None = None, debug: bool = False) -> None:
    """Configure loguru logger. Console + optional file."""
    logger.remove()
    level = "DEBUG" if debug else "INFO"
    logger.add(sys.stderr, level=level, format="<green>{time:HH:mm:ss}</green> <level>{level: <8}</level> <cyan>{name}</cyan> | {message}")

    if log_dir is not None:
        log_dir.mkdir(parents=True, exist_ok=True)
        logger.add(
            log_dir / "neostopmotion_{time:YYYY-MM-DD}.log",
            rotation="10 MB",
            retention="7 days",
            level=level,
        )
```

- [ ] **Step 7: Tạo `src/neo_stopmotion/config/__init__.py`** (empty)

```python
"""Configuration — TOML loader + defaults."""
```

- [ ] **Step 8: Tạo `src/neo_stopmotion/config/defaults.toml`**

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
port = "auto"
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
fullscreen = false
window_width = 1920
window_height = 1080
font_family = "Be Vietnam Pro"
sound_enabled = true
flash_on_capture = true
show_countdown = true
show_thumbnail_strip = true
ask_title_before_export = true
```

- [ ] **Step 9: Test settings loader**

`tests/unit/test_settings.py`:
```python
from pathlib import Path
from neo_stopmotion.config.settings import load_settings, AppSettings


def test_load_defaults():
    s = load_settings()
    assert isinstance(s, AppSettings)
    assert s.app.name == "NeoStopMotion"
    assert s.capture.resolution_width == 1280
    assert s.uart.baudrate == 115200
    assert s.export.playback_fps == 10


def test_load_with_user_override(tmp_path):
    user = tmp_path / "config.toml"
    user.write_text('[capture]\nwebcam_index = 1\n')
    s = load_settings(user_config_path=user)
    assert s.capture.webcam_index == 1
    assert s.capture.resolution_width == 1280  # default kept


def test_env_override(monkeypatch):
    monkeypatch.setenv("NEO_STOPMOTION_UART_PORT", "/dev/ttyACM0")
    s = load_settings()
    assert s.uart.port == "/dev/ttyACM0"
```

- [ ] **Step 10: Run test — FAIL**

```bash
pytest tests/unit/test_settings.py -v
```
Expected: ImportError

- [ ] **Step 11: Tạo `src/neo_stopmotion/config/settings.py`**

```python
from __future__ import annotations
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib


DEFAULTS_PATH = Path(__file__).parent / "defaults.toml"


@dataclass
class AppCfg:
    name: str = "NeoStopMotion"
    version: str = "1.0.0"
    language: str = "vi"
    debug: bool = False


@dataclass
class CaptureCfg:
    webcam_index: int = 0
    resolution_width: int = 1280
    resolution_height: int = 720
    preview_fps: int = 30
    onion_opacity: float = 0.30
    auto_retry_count: int = 3


@dataclass
class UartCfg:
    port: str = "auto"
    baudrate: int = 115200
    reconnect_interval_seconds: int = 2
    keyboard_fallback: bool = True


@dataclass
class ExportCfg:
    playback_fps: int = 10
    min_frames: int = 5
    max_frames: int = 100
    mp4_codec: str = "libx264"
    mp4_pix_fmt: str = "yuv420p"
    gif_scale_width: int = 640
    ffmpeg_binary: str = "ffmpeg"


@dataclass
class StorageCfg:
    projects_dir: str = "/home/maker/projects"
    max_sessions: int = 50
    auto_cleanup_threshold_mb: int = 100


@dataclass
class ServerCfg:
    http_port: int = 8000
    qr_size: int = 400


@dataclass
class UiCfg:
    fullscreen: bool = False
    window_width: int = 1920
    window_height: int = 1080
    font_family: str = "Be Vietnam Pro"
    sound_enabled: bool = True
    flash_on_capture: bool = True
    show_countdown: bool = True
    show_thumbnail_strip: bool = True
    ask_title_before_export: bool = True


@dataclass
class AppSettings:
    app: AppCfg = field(default_factory=AppCfg)
    capture: CaptureCfg = field(default_factory=CaptureCfg)
    uart: UartCfg = field(default_factory=UartCfg)
    export: ExportCfg = field(default_factory=ExportCfg)
    storage: StorageCfg = field(default_factory=StorageCfg)
    server: ServerCfg = field(default_factory=ServerCfg)
    ui: UiCfg = field(default_factory=UiCfg)


def _read_toml(path: Path) -> dict[str, Any]:
    with path.open("rb") as f:
        return tomllib.load(f)


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


_ENV_MAP = {
    "NEO_STOPMOTION_UART_PORT": ("uart", "port"),
    "NEO_STOPMOTION_UART": ("uart", "port"),
    "NEO_STOPMOTION_WEBCAM_INDEX": ("capture", "webcam_index", int),
    "NEO_STOPMOTION_DEBUG": ("app", "debug", lambda s: s.lower() in ("1", "true", "yes")),
    "NEO_STOPMOTION_PROJECTS_DIR": ("storage", "projects_dir"),
}


def _apply_env(data: dict[str, Any]) -> dict[str, Any]:
    for env, target in _ENV_MAP.items():
        if env not in os.environ:
            continue
        section, key, *rest = target
        cast = rest[0] if rest else str
        data.setdefault(section, {})[key] = cast(os.environ[env])
    return data


def load_settings(user_config_path: Path | None = None) -> AppSettings:
    data = _read_toml(DEFAULTS_PATH)
    if user_config_path is not None and user_config_path.exists():
        data = _merge(data, _read_toml(user_config_path))
    elif user_config_path is None:
        default_user = Path.home() / ".config" / "neostopmotion" / "config.toml"
        if default_user.exists():
            data = _merge(data, _read_toml(default_user))
    data = _apply_env(data)
    return AppSettings(
        app=AppCfg(**data.get("app", {})),
        capture=CaptureCfg(**data.get("capture", {})),
        uart=UartCfg(**data.get("uart", {})),
        export=ExportCfg(**data.get("export", {})),
        storage=StorageCfg(**data.get("storage", {})),
        server=ServerCfg(**data.get("server", {})),
        ui=UiCfg(**data.get("ui", {})),
    )
```

- [ ] **Step 12: Run test → PASS**

```bash
pytest tests/unit/test_settings.py -v
```
Expected: `3 passed`

- [ ] **Step 13: Wire vào app.py**

Edit `src/neo_stopmotion/app.py`:
```python
import sys
from pathlib import Path
from PyQt6.QtCore import QUrl
from PyQt6.QtGui import QGuiApplication
from PyQt6.QtQml import QQmlApplicationEngine
from loguru import logger

from neo_stopmotion.config.settings import load_settings
from neo_stopmotion.ui.qml_loader import main_qml_path
from neo_stopmotion.utils.logging_config import configure_logging
from neo_stopmotion.utils.signal_bus import SignalBus


def run() -> int:
    settings = load_settings()
    log_dir = Path.home() / ".local" / "share" / "neostopmotion" / "logs"
    configure_logging(log_dir=log_dir, debug=settings.app.debug)
    logger.info(f"Starting NeoStopMotion v{settings.app.version}")

    app = QGuiApplication(sys.argv)
    app.setApplicationName("NeoStopMotion")
    app.setOrganizationName("MakerViet")

    SignalBus.instance()  # init early

    engine = QQmlApplicationEngine()
    engine.load(QUrl.fromLocalFile(str(main_qml_path())))

    if not engine.rootObjects():
        logger.error("Failed to load QML")
        return 1

    return app.exec()
```

- [ ] **Step 14: Smoke test + commit**

```bash
python -m neo_stopmotion
```
Expected: console log "Starting NeoStopMotion v1.0.0", cửa sổ vẫn hiện.

```bash
git add src/neo_stopmotion/utils/ src/neo_stopmotion/config/ src/neo_stopmotion/app.py tests/unit/test_signal_bus.py tests/unit/test_settings.py
git commit -m "feat(core): SignalBus + loguru + TOML settings loader"
```

---

## Task T1.4: NeoConstants.qml + AppState Singletons (port từ NEOSTEM)

**Files:**
- Create: `src/neo_stopmotion/ui/qml/singletons/qmldir`
- Create: `src/neo_stopmotion/ui/qml/singletons/NeoConstants.qml`
- Create: `src/neo_stopmotion/ui/qml/singletons/AppState.qml`
- Create: `src/neo_stopmotion/ui/qml/pages/SplashScreen.qml`
- Modify: `src/neo_stopmotion/ui/qml/MainWindow.qml`

- [ ] **Step 1: Tạo `singletons/qmldir`**

```
module NeoSingletons
singleton NeoConstants 1.0 NeoConstants.qml
singleton AppState 1.0 AppState.qml
```

- [ ] **Step 2: Tạo `singletons/NeoConstants.qml`**

```qml
pragma Singleton
import QtQuick

QtObject {
    // Brand colors (animation theme)
    readonly property color primary:    "#FF7043"
    readonly property color secondary:  "#1565C0"
    readonly property color accent:     "#FFD600"
    readonly property color background: "#FFF8E1"
    readonly property color surface:    "#FFFFFF"
    readonly property color textPrimary: "#212121"
    readonly property color textSecondary: "#616161"
    readonly property color success:    "#2E7D32"
    readonly property color warning:    "#FF8F00"
    readonly property color error:      "#C62828"

    // Typography
    property bool largeTextMode: false
    readonly property real textScale:    largeTextMode ? 1.25 : 1.0
    readonly property int fontTitle:     Math.round(36 * textScale)
    readonly property int fontBody:      Math.round(24 * textScale)
    readonly property int fontButton:    Math.round(24 * textScale)
    readonly property int fontCaption:   Math.round(18 * textScale)
    readonly property int fontFrameCount: Math.round(72 * textScale)

    // Touch targets
    readonly property int touchMin:      largeTextMode ? 60 : 52
    readonly property int buttonHeight:  largeTextMode ? 68 : 60
    readonly property int previewWidth:  1280
    readonly property int previewHeight: 720

    // Animation
    readonly property int animFast:    200
    readonly property int animNormal:  400
    readonly property int animSlow:    800

    // Stop-motion specific
    readonly property real onionOpacity: 0.30
    readonly property int targetFps:     10
    readonly property int minFrames:     5
    readonly property int maxFrames:     100

    // Spacing
    readonly property int spacingS: 8
    readonly property int spacingM: 16
    readonly property int spacingL: 24
    readonly property int spacingXL: 40
}
```

- [ ] **Step 3: Tạo `singletons/AppState.qml`**

```qml
pragma Singleton
import QtQuick

QtObject {
    property int frameCount: 0
    property string sessionId: ""
    property string status: "idle"  // idle | capturing | exporting | completed | error
    property int previewCounter: 0
    property bool uartConnected: false
    property bool webcamReady: false
    property string currentTitle: ""
    property string warningBanner: ""
    property string errorBanner: ""

    // Computed
    readonly property real durationSeconds: frameCount / 10.0
    readonly property string durationDisplay: durationSeconds.toFixed(1) + "s"
}
```

- [ ] **Step 4: Tạo `pages/SplashScreen.qml`**

```qml
import QtQuick
import QtQuick.Controls
import "../singletons" as N

Item {
    id: root
    signal finished()

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.background

        Column {
            anchors.centerIn: parent
            spacing: N.NeoConstants.spacingL

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "🎬"
                font.pixelSize: 120
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Trạm Làm Phim Hoạt Hình"
                font.pixelSize: N.NeoConstants.fontTitle
                font.bold: true
                color: N.NeoConstants.primary
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Làng Maker @ FPT Shop"
                font.pixelSize: N.NeoConstants.fontBody
                color: N.NeoConstants.textSecondary
            }
        }
    }

    Timer {
        interval: 2000
        running: true
        onTriggered: root.finished()
    }
}
```

- [ ] **Step 5: Update `MainWindow.qml` — StackView + Splash**

```qml
import QtQuick
import QtQuick.Controls
import QtQuick.Window
import "singletons" as N
import "pages" as Pages

ApplicationWindow {
    id: root
    width: 1280
    height: 720
    visible: true
    visibility: Window.Windowed
    title: "NeoStopMotion — Trạm 6"
    color: N.NeoConstants.background

    StackView {
        id: stack
        anchors.fill: parent
        initialItem: splashComponent
    }

    Component {
        id: splashComponent
        Pages.SplashScreen {
            onFinished: {
                stack.replace(capturePlaceholder)
            }
        }
    }

    Component {
        id: capturePlaceholder
        Item {
            Rectangle {
                anchors.fill: parent
                color: N.NeoConstants.background
                Text {
                    anchors.centerIn: parent
                    text: "CapturePage (placeholder)"
                    font.pixelSize: N.NeoConstants.fontTitle
                    color: N.NeoConstants.primary
                }
            }
        }
    }
}
```

- [ ] **Step 6: Smoke test**

```bash
python -m neo_stopmotion
```
Expected: 2s splash với emoji 🎬 + chữ "Trạm Làm Phim Hoạt Hình" → tự chuyển sang "CapturePage (placeholder)".

- [ ] **Step 7: Commit**

```bash
git add src/neo_stopmotion/ui/qml/
git commit -m "feat(ui): NeoConstants + AppState singletons + Splash + StackView"
```

---

## Task T1.5: Pytest infrastructure + GitHub Actions CI

**Files:**
- Create: `requirements-dev.txt`
- Create: `tests/conftest.py`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Tạo `requirements-dev.txt`**

```
pytest==7.4.3
pytest-qt==4.2.0
pytest-cov==4.1.0
pytest-mock==3.12.0
ruff==0.1.6
mypy==1.7.0
build==1.0.3
```

- [ ] **Step 2: Tạo `tests/conftest.py`**

```python
import sys
from pathlib import Path

# Make src importable for tests
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import pytest
from PyQt6.QtCore import QCoreApplication


@pytest.fixture(autouse=True)
def reset_signal_bus():
    """Reset SignalBus singleton between tests."""
    from neo_stopmotion.utils.signal_bus import SignalBus
    SignalBus._instance = None
    yield
    SignalBus._instance = None


@pytest.fixture
def tmp_projects_dir(tmp_path, monkeypatch):
    d = tmp_path / "projects"
    d.mkdir()
    monkeypatch.setenv("NEO_STOPMOTION_PROJECTS_DIR", str(d))
    return d
```

- [ ] **Step 3: Tạo `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-22.04
    strategy:
      matrix:
        python: ["3.10", "3.11"]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python }}
          cache: pip

      - name: Install system deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libegl1 libxkbcommon-x11-0 libxcb-cursor0 ffmpeg

      - name: Install Python deps
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
          pip install -e .

      - name: Lint
        run: |
          ruff check src tests
          mypy src

      - name: Test
        env:
          QT_QPA_PLATFORM: offscreen
        run: |
          xvfb-run -a pytest -v --cov=neo_stopmotion --cov-report=term-missing
```

- [ ] **Step 4: Run test suite local**

```bash
make dev
make test
```
Expected: tất cả test hiện tại pass; coverage report in ra.

- [ ] **Step 5: Commit**

```bash
git add requirements-dev.txt tests/conftest.py .github/workflows/ci.yml
git commit -m "chore(ci): pytest infrastructure + GitHub Actions workflow"
```

**Epic 1 demo criteria**: `python -m neo_stopmotion` boot trong <3s, splash 2s → CapturePage placeholder, không crash, log file ghi vào `~/.local/share/neostopmotion/logs/`.

---

# Epic 2 — Capture Pipeline (4 ngày, 6 tasks)

## Task T2.1: CaptureEngine — cv2 webcam + retry

**Files:**
- Create: `src/neo_stopmotion/core/__init__.py`
- Create: `src/neo_stopmotion/core/capture_engine.py`
- Create: `tests/unit/test_capture_engine.py`

- [ ] **Step 1: Test với fake VideoCapture**

`tests/unit/test_capture_engine.py`:
```python
import numpy as np
import pytest
from unittest.mock import MagicMock, patch
from neo_stopmotion.core.capture_engine import CaptureEngine, CaptureError


@pytest.fixture
def fake_frame():
    return np.full((720, 1280, 3), 128, dtype=np.uint8)


def test_open_success(fake_frame):
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    fake_cap.read.return_value = (True, fake_frame)
    with patch("cv2.VideoCapture", return_value=fake_cap):
        eng = CaptureEngine(webcam_index=0, resolution=(1280, 720))
        eng.open()
        assert eng.is_open is True


def test_open_retry_then_fail():
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = False
    with patch("cv2.VideoCapture", return_value=fake_cap):
        eng = CaptureEngine(webcam_index=99, retry_count=2)
        with pytest.raises(CaptureError, match="webcam"):
            eng.open()


def test_capture_frame_returns_numpy(fake_frame):
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    fake_cap.read.return_value = (True, fake_frame)
    with patch("cv2.VideoCapture", return_value=fake_cap):
        eng = CaptureEngine()
        eng.open()
        frame = eng.capture_frame()
        assert frame.shape == (720, 1280, 3)
```

- [ ] **Step 2: Run test — FAIL**

```bash
pytest tests/unit/test_capture_engine.py -v
```
Expected: `ModuleNotFoundError: neo_stopmotion.core.capture_engine`

- [ ] **Step 3: Tạo `src/neo_stopmotion/core/__init__.py`**

```python
"""Core processing — capture, frames, video, share."""
```

- [ ] **Step 4: Tạo `src/neo_stopmotion/core/capture_engine.py`** (without onion skin yet)

```python
from __future__ import annotations
import time
import cv2
import numpy as np
from loguru import logger


class CaptureError(RuntimeError):
    pass


class CaptureEngine:
    """Read frames from a USB webcam via OpenCV."""

    def __init__(
        self,
        webcam_index: int = 0,
        resolution: tuple[int, int] = (1280, 720),
        retry_count: int = 3,
        retry_delay_seconds: float = 1.0,
    ) -> None:
        self.webcam_index = webcam_index
        self.resolution = resolution
        self.retry_count = retry_count
        self.retry_delay_seconds = retry_delay_seconds
        self._cap: cv2.VideoCapture | None = None
        self._last_frame: np.ndarray | None = None

    @property
    def is_open(self) -> bool:
        return self._cap is not None and self._cap.isOpened()

    def open(self) -> None:
        last_err: Exception | None = None
        for attempt in range(1, self.retry_count + 1):
            try:
                cap = cv2.VideoCapture(self.webcam_index)
                if not cap.isOpened():
                    raise CaptureError(f"Cannot open webcam index {self.webcam_index}")
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.resolution[0])
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resolution[1])
                self._cap = cap
                logger.info(f"Webcam opened (index={self.webcam_index}, attempt={attempt})")
                return
            except Exception as e:
                last_err = e
                logger.warning(f"Webcam open attempt {attempt} failed: {e}")
                time.sleep(self.retry_delay_seconds)
        raise CaptureError(f"Failed to open webcam after {self.retry_count} retries") from last_err

    def capture_frame(self) -> np.ndarray:
        if self._cap is None:
            raise CaptureError("Webcam not opened")
        ret, frame = self._cap.read()
        if not ret or frame is None:
            raise CaptureError("Failed to read frame from webcam")
        self._last_frame = frame.copy()
        return frame

    def get_live_preview(self) -> np.ndarray | None:
        """Read a frame for preview. Onion skin added in T2.2."""
        if self._cap is None:
            return None
        ret, frame = self._cap.read()
        if not ret or frame is None:
            return None
        return frame

    def reset(self) -> None:
        self._last_frame = None

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
```

- [ ] **Step 5: Run test → PASS**

```bash
pytest tests/unit/test_capture_engine.py -v
```
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add src/neo_stopmotion/core/__init__.py src/neo_stopmotion/core/capture_engine.py tests/unit/test_capture_engine.py
git commit -m "feat(core): CaptureEngine with cv2 webcam + retry logic"
```

---

## Task T2.2: Onion skinning

**Files:**
- Modify: `src/neo_stopmotion/core/capture_engine.py`
- Modify: `tests/unit/test_capture_engine.py`

- [ ] **Step 1: Test onion skin behavior**

Append to `tests/unit/test_capture_engine.py`:
```python
def test_get_live_preview_no_blend_when_no_last_frame():
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    fake_cap.read.return_value = (True, np.full((720, 1280, 3), 100, dtype=np.uint8))
    with patch("cv2.VideoCapture", return_value=fake_cap):
        eng = CaptureEngine(onion_opacity=0.3)
        eng.open()
        preview = eng.get_live_preview()
        assert preview[0, 0, 0] == 100  # no blending


def test_get_live_preview_blends_with_last_frame():
    current = np.full((720, 1280, 3), 200, dtype=np.uint8)
    last = np.full((720, 1280, 3), 0, dtype=np.uint8)
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    fake_cap.read.return_value = (True, current.copy())
    with patch("cv2.VideoCapture", return_value=fake_cap):
        eng = CaptureEngine(onion_opacity=0.3)
        eng.open()
        eng._last_frame = last
        preview = eng.get_live_preview()
        # 200*0.7 + 0*0.3 = 140
        assert 138 <= preview[0, 0, 0] <= 142


def test_capture_frame_does_not_blend(fake_frame):
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    fake_cap.read.return_value = (True, fake_frame.copy())
    with patch("cv2.VideoCapture", return_value=fake_cap):
        eng = CaptureEngine(onion_opacity=0.3)
        eng.open()
        eng._last_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        frame = eng.capture_frame()
        # captured frame must be raw (NOT blended)
        assert frame[0, 0, 0] == 128
```

- [ ] **Step 2: Run test — FAIL**

```bash
pytest tests/unit/test_capture_engine.py -v
```
Expected: 2-3 fails (onion blend not implemented).

- [ ] **Step 3: Update `capture_engine.py`** — add onion opacity + blend in `get_live_preview`

Replace the class:
```python
class CaptureEngine:
    def __init__(
        self,
        webcam_index: int = 0,
        resolution: tuple[int, int] = (1280, 720),
        retry_count: int = 3,
        retry_delay_seconds: float = 1.0,
        onion_opacity: float = 0.30,
    ) -> None:
        self.webcam_index = webcam_index
        self.resolution = resolution
        self.retry_count = retry_count
        self.retry_delay_seconds = retry_delay_seconds
        self.onion_opacity = onion_opacity
        self._cap: cv2.VideoCapture | None = None
        self._last_frame: np.ndarray | None = None

    # ... open() / is_open unchanged ...

    def capture_frame(self) -> np.ndarray:
        if self._cap is None:
            raise CaptureError("Webcam not opened")
        ret, frame = self._cap.read()
        if not ret or frame is None:
            raise CaptureError("Failed to read frame from webcam")
        # IMPORTANT: store a RAW copy as last_frame for next onion skin,
        # but return the RAW frame (no blending) for saving to disk.
        self._last_frame = frame.copy()
        return frame

    def get_live_preview(self) -> np.ndarray | None:
        if self._cap is None:
            return None
        ret, current = self._cap.read()
        if not ret or current is None:
            return None
        if self._last_frame is None:
            return current
        return cv2.addWeighted(
            current, 1.0 - self.onion_opacity,
            self._last_frame, self.onion_opacity,
            0.0,
        )

    def set_last_frame(self, frame: np.ndarray | None) -> None:
        """Used after UNDO to reset onion skin source to the previous saved frame."""
        self._last_frame = frame.copy() if frame is not None else None
```

(Keep `reset()` and `release()` unchanged.)

- [ ] **Step 4: Run test → PASS**

```bash
pytest tests/unit/test_capture_engine.py -v
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/neo_stopmotion/core/capture_engine.py tests/unit/test_capture_engine.py
git commit -m "feat(capture): onion skinning via cv2.addWeighted"
```

---

## Task T2.3: PreviewImageProvider + cv↔Qt bridge

**Files:**
- Create: `src/neo_stopmotion/utils/cv_qt_bridge.py`
- Create: `src/neo_stopmotion/ui/image_provider.py`

- [ ] **Step 1: Test bridge cv2 → QImage**

`tests/unit/test_cv_qt_bridge.py`:
```python
import numpy as np
from PyQt6.QtGui import QImage
from neo_stopmotion.utils.cv_qt_bridge import cv_to_qimage


def test_cv_to_qimage_shape():
    bgr = np.full((480, 640, 3), 200, dtype=np.uint8)
    qimg = cv_to_qimage(bgr)
    assert isinstance(qimg, QImage)
    assert qimg.width() == 640
    assert qimg.height() == 480


def test_cv_to_qimage_handles_none():
    qimg = cv_to_qimage(None)
    assert qimg.isNull()
```

- [ ] **Step 2: Run test — FAIL** (module missing)

- [ ] **Step 3: Tạo `src/neo_stopmotion/utils/cv_qt_bridge.py`**

```python
from __future__ import annotations
import cv2
import numpy as np
from PyQt6.QtGui import QImage


def cv_to_qimage(bgr: np.ndarray | None) -> QImage:
    """Convert a BGR numpy array to QImage (RGB888). Returns null QImage on None."""
    if bgr is None:
        return QImage()
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w, _ = rgb.shape
    bytes_per_line = 3 * w
    img = QImage(rgb.data, w, h, bytes_per_line, QImage.Format.Format_RGB888).copy()
    return img
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Tạo `src/neo_stopmotion/ui/image_provider.py`**

```python
from __future__ import annotations
from PyQt6.QtCore import QSize
from PyQt6.QtGui import QImage
from PyQt6.QtQuick import QQuickImageProvider

from neo_stopmotion.core.capture_engine import CaptureEngine
from neo_stopmotion.utils.cv_qt_bridge import cv_to_qimage


class PreviewImageProvider(QQuickImageProvider):
    """Provide live (onion-skinned) preview frames to QML."""

    def __init__(self, capture_engine: CaptureEngine) -> None:
        super().__init__(QQuickImageProvider.ImageType.Image)
        self._capture = capture_engine

    def requestImage(self, id: str, requestedSize: QSize, size: QSize) -> tuple[QImage, QSize]:
        frame = self._capture.get_live_preview()
        qimg = cv_to_qimage(frame)
        return qimg, qimg.size()
```

- [ ] **Step 6: Commit**

```bash
git add src/neo_stopmotion/utils/cv_qt_bridge.py src/neo_stopmotion/ui/image_provider.py tests/unit/test_cv_qt_bridge.py
git commit -m "feat(ui): cv2↔QImage bridge + PreviewImageProvider"
```

---

## Task T2.4: LivePreview.qml + CapturePage shell

**Files:**
- Create: `src/neo_stopmotion/ui/qml/components/LivePreview.qml`
- Create: `src/neo_stopmotion/ui/qml/components/FrameCounter.qml`
- Create: `src/neo_stopmotion/ui/qml/components/HintBar.qml`
- Create: `src/neo_stopmotion/ui/qml/pages/CapturePage.qml`
- Modify: `src/neo_stopmotion/app.py` (register provider)
- Modify: `src/neo_stopmotion/ui/qml/MainWindow.qml`

- [ ] **Step 1: Tạo `components/LivePreview.qml`**

```qml
import QtQuick
import "../singletons" as N

Item {
    id: root

    Image {
        id: preview
        anchors.fill: parent
        fillMode: Image.PreserveAspectFit
        cache: false
        source: "image://preview/" + N.AppState.previewCounter
    }

    Timer {
        interval: 33  // ~30fps
        repeat: true
        running: N.AppState.webcamReady
        onTriggered: N.AppState.previewCounter++
    }

    Rectangle {
        id: flashOverlay
        anchors.fill: parent
        color: "white"
        opacity: 0
        Behavior on opacity { NumberAnimation { duration: 100 } }
    }

    function flash() {
        flashOverlay.opacity = 0.8
        flashTimer.restart()
    }

    Timer {
        id: flashTimer
        interval: 100
        onTriggered: flashOverlay.opacity = 0
    }
}
```

- [ ] **Step 2: Tạo `components/FrameCounter.qml`**

```qml
import QtQuick
import QtQuick.Layouts
import "../singletons" as N

Rectangle {
    radius: 16
    color: N.NeoConstants.surface
    border.color: N.NeoConstants.primary
    border.width: 2

    ColumnLayout {
        anchors.centerIn: parent
        spacing: N.NeoConstants.spacingS

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "FRAME"
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.textSecondary
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: N.AppState.frameCount
            font.pixelSize: N.NeoConstants.fontFrameCount
            font.bold: true
            color: N.NeoConstants.primary
        }
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "Thời lượng: " + N.AppState.durationDisplay
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.textPrimary
        }
    }
}
```

- [ ] **Step 3: Tạo `components/HintBar.qml`**

```qml
import QtQuick
import QtQuick.Layouts
import "../singletons" as N

Rectangle {
    color: "transparent"

    RowLayout {
        anchors.fill: parent
        anchors.margins: N.NeoConstants.spacingM
        spacing: N.NeoConstants.spacingL

        Text {
            text: "🔴 Bấm: chụp 1 frame"
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.textPrimary
        }
        Text {
            text: "⏱️ Giữ 1s: xóa frame cuối"
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.textPrimary
        }
        Text {
            text: "🎬 Giữ 3s: tạo phim"
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.textPrimary
        }
    }
}
```

- [ ] **Step 4: Tạo `pages/CapturePage.qml`**

```qml
import QtQuick
import QtQuick.Layouts
import "../singletons" as N
import "../components"

Item {
    id: root

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.background
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: N.NeoConstants.spacingL
        spacing: N.NeoConstants.spacingM

        // Header
        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "TRẠM LÀM PHIM HOẠT HÌNH"
            font.pixelSize: N.NeoConstants.fontTitle
            font.bold: true
            color: N.NeoConstants.primary
        }

        // Preview + Counter row
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: N.NeoConstants.spacingL

            LivePreview {
                id: preview
                Layout.fillWidth: true
                Layout.preferredHeight: 720
            }

            FrameCounter {
                Layout.preferredWidth: 240
                Layout.preferredHeight: 320
            }
        }

        HintBar {
            Layout.fillWidth: true
            Layout.preferredHeight: 60
        }
    }

    function flashCapture() { preview.flash() }
}
```

- [ ] **Step 5: Update MainWindow.qml — replace placeholder**

Replace `capturePlaceholder` Component:
```qml
    Component {
        id: capturePageComponent
        Pages.CapturePage { }
    }
```

And update splash transition:
```qml
            onFinished: {
                stack.replace(capturePageComponent)
            }
```

- [ ] **Step 6: Update `app.py` to register provider + start capture**

Edit `src/neo_stopmotion/app.py`:
```python
import sys
from pathlib import Path
from PyQt6.QtCore import QUrl
from PyQt6.QtGui import QGuiApplication
from PyQt6.QtQml import QQmlApplicationEngine
from loguru import logger

from neo_stopmotion.config.settings import load_settings
from neo_stopmotion.core.capture_engine import CaptureEngine, CaptureError
from neo_stopmotion.ui.image_provider import PreviewImageProvider
from neo_stopmotion.ui.qml_loader import find_qml_root, main_qml_path
from neo_stopmotion.utils.logging_config import configure_logging
from neo_stopmotion.utils.signal_bus import SignalBus


def run() -> int:
    settings = load_settings()
    log_dir = Path.home() / ".local" / "share" / "neostopmotion" / "logs"
    configure_logging(log_dir=log_dir, debug=settings.app.debug)
    logger.info(f"Starting NeoStopMotion v{settings.app.version}")

    app = QGuiApplication(sys.argv)
    app.setApplicationName("NeoStopMotion")
    app.setOrganizationName("MakerViet")

    bus = SignalBus.instance()

    capture = CaptureEngine(
        webcam_index=settings.capture.webcam_index,
        resolution=(settings.capture.resolution_width, settings.capture.resolution_height),
        onion_opacity=settings.capture.onion_opacity,
        retry_count=settings.capture.auto_retry_count,
    )
    try:
        capture.open()
        bus.webcam_ready.emit()
    except CaptureError as e:
        logger.error(f"Webcam init failed: {e}")
        bus.webcam_error.emit(str(e))

    engine = QQmlApplicationEngine()
    engine.addImageProvider("preview", PreviewImageProvider(capture))
    engine.addImportPath(str(find_qml_root()))
    engine.load(QUrl.fromLocalFile(str(main_qml_path())))

    if not engine.rootObjects():
        logger.error("Failed to load QML")
        return 1

    # Wire bus → AppState QML singleton
    root = engine.rootObjects()[0]
    app_state = engine.singletonInstance(engine.rootContext(), "NeoSingletons", "AppState")
    if app_state is not None:
        bus.webcam_ready.connect(lambda: app_state.setProperty("webcamReady", True))
        bus.webcam_error.connect(lambda msg: app_state.setProperty("errorBanner", msg))

    code = app.exec()
    capture.release()
    return code
```

Note: the `engine.singletonInstance(...)` call may need adjustment based on PyQt6 API; if it doesn't exist in this version, we set webcamReady from QML side via a connection in MainWindow.qml. (See alternative below.)

Alternative wiring via QML side — add to `MainWindow.qml` after StackView:
```qml
    Connections {
        target: appController  // exposed in T2.6
        function onWebcamReady() { N.AppState.webcamReady = true }
    }
```

For now, in T2.4 we hardcode `N.AppState.webcamReady = true` in CapturePage onCompleted to allow preview to start:

In `CapturePage.qml` add:
```qml
    Component.onCompleted: N.AppState.webcamReady = true
```

- [ ] **Step 7: Smoke test với webcam thật (macOS)**

```bash
python -m neo_stopmotion
```
Expected: splash 2s → CapturePage hiển thị live preview từ webcam laptop, counter "FRAME 0", duration "0.0s", hint bar dưới.

(Nếu macOS hỏi quyền camera, cấp quyền và chạy lại.)

- [ ] **Step 8: Commit**

```bash
git add src/neo_stopmotion/ui/qml/components/ src/neo_stopmotion/ui/qml/pages/CapturePage.qml src/neo_stopmotion/ui/qml/MainWindow.qml src/neo_stopmotion/app.py
git commit -m "feat(ui): LivePreview + FrameCounter + HintBar + CapturePage"
```

---

## Task T2.5: FrameManager — PNG save + project.json + models

**Files:**
- Create: `src/neo_stopmotion/core/models.py`
- Create: `src/neo_stopmotion/core/frame_manager.py`
- Create: `src/neo_stopmotion/services/__init__.py`
- Create: `src/neo_stopmotion/services/session_service.py`
- Create: `tests/unit/test_frame_manager.py`

- [ ] **Step 1: Tạo `core/models.py`**

```python
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path


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
    frame_number: int
    filepath: Path
    captured_at: datetime
    width: int
    height: int


@dataclass
class SessionMeta:
    session_id: str
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

    def to_dict(self) -> dict:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        d["status"] = self.status.value
        for k in ("mp4_path", "gif_path", "qr_path"):
            if d[k] is not None:
                d[k] = str(d[k])
        return d


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

- [ ] **Step 2: Test FrameManager**

`tests/unit/test_frame_manager.py`:
```python
import numpy as np
import pytest
from pathlib import Path
from neo_stopmotion.core.frame_manager import FrameManager


@pytest.fixture
def fm(tmp_path):
    return FrameManager(projects_dir=tmp_path)


@pytest.fixture
def frame():
    return np.full((720, 1280, 3), 100, dtype=np.uint8)


def test_create_session(fm):
    assert fm.frame_count == 0
    assert fm.session_dir.exists()
    assert (fm.session_dir / "frames").exists()
    assert (fm.session_dir / "project.json").exists()


def test_add_frame_writes_png(fm, frame):
    path = fm.add_frame(frame)
    assert path.exists()
    assert path.name == "frame_0001.png"
    assert fm.frame_count == 1
    meta = fm.metadata
    assert meta.frame_count == 1
    assert meta.duration_seconds == pytest.approx(0.1)


def test_add_multiple_frames(fm, frame):
    fm.add_frame(frame)
    fm.add_frame(frame)
    fm.add_frame(frame)
    assert fm.frame_count == 3
    assert (fm.session_dir / "frames" / "frame_0003.png").exists()


def test_undo_last_frame(fm, frame):
    fm.add_frame(frame)
    fm.add_frame(frame)
    ok = fm.undo_last_frame()
    assert ok is True
    assert fm.frame_count == 1
    assert not (fm.session_dir / "frames" / "frame_0002.png").exists()


def test_undo_when_empty(fm):
    assert fm.undo_last_frame() is False


def test_get_all_frames_sorted(fm, frame):
    for _ in range(3):
        fm.add_frame(frame)
    frames = fm.get_all_frames()
    assert [f.name for f in frames] == ["frame_0001.png", "frame_0002.png", "frame_0003.png"]


def test_set_title_persists(fm):
    fm.set_title("Robot bay vũ trụ", "Minh, 9 tuổi")
    assert fm.metadata.title == "Robot bay vũ trụ"
    assert fm.metadata.creator_name == "Minh, 9 tuổi"
    fm._save_metadata()
    import json
    data = json.loads((fm.session_dir / "project.json").read_text())
    assert data["title"] == "Robot bay vũ trụ"


def test_load_last_frame(fm, frame):
    fm.add_frame(frame)
    loaded = fm.load_frame(1)
    assert loaded is not None
    assert loaded.shape == frame.shape
```

- [ ] **Step 3: Run test — FAIL** (module missing)

- [ ] **Step 4: Tạo `core/frame_manager.py`**

```python
from __future__ import annotations
import json
import os
from datetime import datetime
from pathlib import Path
import cv2
import numpy as np
from loguru import logger

from neo_stopmotion.core.models import SessionMeta, SessionStatus


class FrameManager:
    """Persist frames as PNG + project.json metadata."""

    def __init__(self, projects_dir: Path, fps_playback: int = 10) -> None:
        self.projects_dir = Path(projects_dir)
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        session_id = datetime.now().strftime("%Y_%m_%d_%H%M%S")
        self.session_dir = self.projects_dir / f"session_{session_id}"
        self.frames_dir = self.session_dir / "frames"
        self.frames_dir.mkdir(parents=True, exist_ok=True)
        self.metadata = SessionMeta(
            session_id=session_id,
            created_at=datetime.now(),
            fps_playback=fps_playback,
        )
        self._save_metadata()
        logger.info(f"Session created: {self.session_dir}")

    @property
    def frame_count(self) -> int:
        return self.metadata.frame_count

    def add_frame(self, frame: np.ndarray) -> Path:
        next_num = self.frame_count + 1
        filename = f"frame_{next_num:04d}.png"
        final_path = self.frames_dir / filename
        # Atomic write: tmp then rename
        tmp_path = final_path.with_suffix(".png.tmp")
        cv2.imwrite(str(tmp_path), frame)
        os.replace(tmp_path, final_path)
        self.metadata.frame_count = next_num
        self.metadata.duration_seconds = next_num / self.metadata.fps_playback
        self._save_metadata()
        logger.debug(f"Frame saved: {final_path}")
        return final_path

    def undo_last_frame(self) -> bool:
        if self.frame_count == 0:
            return False
        filename = f"frame_{self.frame_count:04d}.png"
        path = self.frames_dir / filename
        if not path.exists():
            return False
        path.unlink()
        self.metadata.frame_count -= 1
        self.metadata.duration_seconds = self.metadata.frame_count / self.metadata.fps_playback
        self._save_metadata()
        logger.info(f"Frame undone: {filename}")
        return True

    def get_all_frames(self) -> list[Path]:
        return sorted(self.frames_dir.glob("frame_*.png"))

    def load_frame(self, frame_number: int) -> np.ndarray | None:
        path = self.frames_dir / f"frame_{frame_number:04d}.png"
        if not path.exists():
            return None
        img = cv2.imread(str(path))
        return img

    def set_title(self, title: str, creator_name: str = "") -> None:
        self.metadata.title = title
        self.metadata.creator_name = creator_name
        self._save_metadata()

    def _save_metadata(self) -> None:
        path = self.session_dir / "project.json"
        with path.open("w", encoding="utf-8") as f:
            json.dump(self.metadata.to_dict(), f, indent=2, ensure_ascii=False)
```

- [ ] **Step 5: Run test → PASS**

```bash
pytest tests/unit/test_frame_manager.py -v
```
Expected: `8 passed`

- [ ] **Step 6: Tạo `services/__init__.py` + `services/session_service.py`** (minimal wrapper)

`services/__init__.py`:
```python
"""Application services exposed to QML."""
```

`services/session_service.py`:
```python
from __future__ import annotations
from pathlib import Path
from PyQt6.QtCore import QObject, pyqtSlot
from loguru import logger

from neo_stopmotion.core.frame_manager import FrameManager


class SessionService(QObject):
    def __init__(self, projects_dir: Path, fps_playback: int = 10) -> None:
        super().__init__()
        self._projects_dir = projects_dir
        self._fps_playback = fps_playback
        self.frame_manager = FrameManager(projects_dir, fps_playback)

    @pyqtSlot()
    def reset(self) -> None:
        """Start a new session."""
        logger.info("Session reset")
        self.frame_manager = FrameManager(self._projects_dir, self._fps_playback)
```

- [ ] **Step 7: Commit**

```bash
git add src/neo_stopmotion/core/models.py src/neo_stopmotion/core/frame_manager.py src/neo_stopmotion/services/ tests/unit/test_frame_manager.py
git commit -m "feat(core): SessionMeta + FrameManager with atomic PNG writes"
```

---

## Task T2.6: AppController + Keyboard fallback

**Files:**
- Create: `src/neo_stopmotion/services/app_controller.py`
- Modify: `src/neo_stopmotion/app.py`
- Modify: `src/neo_stopmotion/ui/qml/MainWindow.qml`
- Create: `tests/unit/test_app_controller.py`

- [ ] **Step 1: Test AppController**

`tests/unit/test_app_controller.py`:
```python
from unittest.mock import MagicMock
import numpy as np
import pytest
from neo_stopmotion.services.app_controller import AppController
from neo_stopmotion.utils.signal_bus import SignalBus


@pytest.fixture
def mock_capture():
    cap = MagicMock()
    cap.capture_frame.return_value = np.full((720, 1280, 3), 100, dtype=np.uint8)
    return cap


@pytest.fixture
def mock_session(tmp_path):
    from neo_stopmotion.services.session_service import SessionService
    return SessionService(projects_dir=tmp_path, fps_playback=10)


def test_handle_shoot_captures_and_saves(mock_capture, mock_session):
    ctrl = AppController(capture=mock_capture, session=mock_session)
    bus = SignalBus.instance()
    received = []
    bus.frame_captured.connect(lambda n, p: received.append(n))
    ctrl.handle_uart_command("SHOOT")
    assert mock_capture.capture_frame.called
    assert mock_session.frame_manager.frame_count == 1
    assert received == [1]


def test_handle_undo_removes_frame(mock_capture, mock_session):
    ctrl = AppController(capture=mock_capture, session=mock_session)
    ctrl.handle_uart_command("SHOOT")
    ctrl.handle_uart_command("SHOOT")
    assert mock_session.frame_manager.frame_count == 2
    ctrl.handle_uart_command("UNDO")
    assert mock_session.frame_manager.frame_count == 1


def test_undo_when_empty_is_silent(mock_capture, mock_session):
    ctrl = AppController(capture=mock_capture, session=mock_session)
    ctrl.handle_uart_command("UNDO")
    assert mock_session.frame_manager.frame_count == 0


def test_unknown_command_logged(mock_capture, mock_session):
    ctrl = AppController(capture=mock_capture, session=mock_session)
    ctrl.handle_uart_command("XYZ")  # should not raise
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Tạo `services/app_controller.py`**

```python
from __future__ import annotations
from PyQt6.QtCore import QObject, pyqtSlot, pyqtProperty, pyqtSignal
from loguru import logger

from neo_stopmotion.core.capture_engine import CaptureEngine, CaptureError
from neo_stopmotion.services.session_service import SessionService
from neo_stopmotion.utils.signal_bus import SignalBus


class AppController(QObject):
    """Root QObject exposed to QML — facade over capture+session."""

    frameCountChanged = pyqtSignal(int)

    def __init__(self, capture: CaptureEngine, session: SessionService) -> None:
        super().__init__()
        self._capture = capture
        self._session = session
        self._bus = SignalBus.instance()
        self._frame_count = 0
        self._bus.uart_command_received.connect(self.handle_uart_command)

    @pyqtProperty(int, notify=frameCountChanged)
    def frameCount(self) -> int:
        return self._frame_count

    @pyqtSlot(str)
    def handle_uart_command(self, cmd: str) -> None:
        cmd = cmd.strip().upper()
        logger.debug(f"UART cmd: {cmd}")
        if cmd == "SHOOT":
            self._do_shoot()
        elif cmd == "UNDO":
            self._do_undo()
        elif cmd == "EXPORT":
            self._do_export()
        elif cmd == "READY":
            logger.info("ThingBot READY")
        elif cmd == "BAT_LOW":
            self._bus.status_message.emit("warning", "Pin ThingBot yếu")
        else:
            logger.warning(f"Unknown UART cmd: {cmd}")

    def _do_shoot(self) -> None:
        try:
            frame = self._capture.capture_frame()
        except CaptureError as e:
            logger.error(f"Capture failed: {e}")
            self._bus.webcam_error.emit(str(e))
            return
        path = self._session.frame_manager.add_frame(frame)
        self._frame_count = self._session.frame_manager.frame_count
        self.frameCountChanged.emit(self._frame_count)
        self._bus.frame_captured.emit(self._frame_count, str(path))

    def _do_undo(self) -> None:
        ok = self._session.frame_manager.undo_last_frame()
        if not ok:
            return
        # Reload the new "last frame" so onion skin uses the correct source
        new_count = self._session.frame_manager.frame_count
        prev = self._session.frame_manager.load_frame(new_count) if new_count > 0 else None
        self._capture.set_last_frame(prev)
        self._frame_count = new_count
        self.frameCountChanged.emit(self._frame_count)
        self._bus.frame_undone.emit(new_count)

    def _do_export(self) -> None:
        # Filled in T4.3
        logger.info("Export requested (stub)")
        self._bus.export_started.emit()
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Wire AppController + keyboard listener vào `app.py`**

Replace `app.py` `run()`:
```python
def run() -> int:
    settings = load_settings()
    log_dir = Path.home() / ".local" / "share" / "neostopmotion" / "logs"
    configure_logging(log_dir=log_dir, debug=settings.app.debug)
    logger.info(f"Starting NeoStopMotion v{settings.app.version}")

    app = QGuiApplication(sys.argv)
    app.setApplicationName("NeoStopMotion")
    app.setOrganizationName("MakerViet")

    bus = SignalBus.instance()

    capture = CaptureEngine(
        webcam_index=settings.capture.webcam_index,
        resolution=(settings.capture.resolution_width, settings.capture.resolution_height),
        onion_opacity=settings.capture.onion_opacity,
        retry_count=settings.capture.auto_retry_count,
    )
    try:
        capture.open()
        bus.webcam_ready.emit()
    except CaptureError as e:
        logger.error(f"Webcam init failed: {e}")
        bus.webcam_error.emit(str(e))

    from neo_stopmotion.services.session_service import SessionService
    from neo_stopmotion.services.app_controller import AppController
    session = SessionService(
        projects_dir=Path(settings.storage.projects_dir).expanduser()
        if settings.storage.projects_dir.startswith("/")
        else Path.home() / "neostopmotion_sessions",
        fps_playback=settings.export.playback_fps,
    )
    controller = AppController(capture=capture, session=session)

    engine = QQmlApplicationEngine()
    engine.addImageProvider("preview", PreviewImageProvider(capture))
    engine.addImportPath(str(find_qml_root()))
    engine.rootContext().setContextProperty("appController", controller)
    engine.load(QUrl.fromLocalFile(str(main_qml_path())))

    if not engine.rootObjects():
        logger.error("Failed to load QML")
        return 1

    code = app.exec()
    capture.release()
    return code
```

- [ ] **Step 6: Add keyboard fallback in MainWindow.qml**

```qml
import QtQuick
import QtQuick.Controls
import QtQuick.Window
import "singletons" as N
import "pages" as Pages

ApplicationWindow {
    id: root
    width: 1280
    height: 720
    visible: true
    title: "NeoStopMotion — Trạm 6"
    color: N.NeoConstants.background

    StackView {
        id: stack
        anchors.fill: parent
        initialItem: splashComponent
        focus: true

        Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Space) {
                appController.handle_uart_command("SHOOT")
                event.accepted = true
            } else if (event.key === Qt.Key_Z) {
                appController.handle_uart_command("UNDO")
                event.accepted = true
            } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                appController.handle_uart_command("EXPORT")
                event.accepted = true
            }
        }
    }

    Component {
        id: splashComponent
        Pages.SplashScreen {
            onFinished: stack.replace(capturePageComponent)
        }
    }

    Component {
        id: capturePageComponent
        Pages.CapturePage { }
    }

    Connections {
        target: appController
        function onFrameCountChanged(n) {
            N.AppState.frameCount = n
        }
    }
}
```

- [ ] **Step 7: Smoke test**

```bash
python -m neo_stopmotion
```
Expected: live preview, bấm Space → frame counter tăng 0→1→2..., onion skin của frame trước hiện mờ chồng lên live preview, PNG ghi vào `~/neostopmotion_sessions/session_*/frames/`. Bấm Z → counter giảm.

- [ ] **Step 8: Commit**

```bash
git add src/neo_stopmotion/services/app_controller.py src/neo_stopmotion/app.py src/neo_stopmotion/ui/qml/MainWindow.qml tests/unit/test_app_controller.py
git commit -m "feat(services): AppController facade + keyboard fallback (Space/Z/Enter)"
```

**Epic 2 demo criteria**: Bấm Space chụp frame, frame counter tăng, onion skin hiện đúng, PNG được ghi atomic vào session folder, bấm Z undo. Live preview mượt ≥25fps trên macOS.

---

# Epic 3 — UART & ThingBot (3 ngày, 5 tasks, song song với Epic 2)

## Task T3.1: ThingBot firmware

**Files:**
- Create: `firmware/thingbot_stopmotion/thingbot_stopmotion.ino`
- Create: `firmware/thingbot_stopmotion/README.md`
- Create: `firmware/thingbot_stopmotion/platformio.ini`

- [ ] **Step 1: Tạo `firmware/thingbot_stopmotion/thingbot_stopmotion.ino`**

(Sao spec §5.1 + thêm START_BANNER + battery monitor optional)

```cpp
// NeoStopMotion ThingBot firmware
// Reads a single arcade button and sends UART commands to NEO One.
// Short press (<1s):  SHOOT
// Long press (1-3s):  UNDO
// Very long (>3s):    EXPORT
// On boot:            READY

#define BUTTON_PIN 4
#define LED_PIN 5
#define BUZZER_PIN 6
#define BAUD_RATE 115200
#define DEBOUNCE_MS 50
#define LONG_PRESS_MS 1000
#define VERY_LONG_PRESS_MS 3000

bool isPressed = false;
unsigned long pressStart = 0;

void setup() {
  Serial.begin(BAUD_RATE);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  delay(100);
  Serial.println("READY");
}

void feedbackBlink(int times, int duration) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(duration / 2);
    digitalWrite(LED_PIN, HIGH);
    delay(duration / 2);
  }
}

void loop() {
  bool buttonDown = (digitalRead(BUTTON_PIN) == LOW);

  if (buttonDown && !isPressed) {
    delay(DEBOUNCE_MS);
    if (digitalRead(BUTTON_PIN) == LOW) {
      isPressed = true;
      pressStart = millis();
    }
  } else if (!buttonDown && isPressed) {
    unsigned long duration = millis() - pressStart;
    isPressed = false;

    if (duration >= VERY_LONG_PRESS_MS) {
      Serial.println("EXPORT");
      feedbackBlink(3, 500);
    } else if (duration >= LONG_PRESS_MS) {
      Serial.println("UNDO");
      feedbackBlink(2, 200);
    } else {
      Serial.println("SHOOT");
      feedbackBlink(1, 100);
      tone(BUZZER_PIN, 1000, 50);
    }
  }
}
```

- [ ] **Step 2: Tạo `firmware/thingbot_stopmotion/platformio.ini`**

```ini
[env:uno]
platform = atmelavr
board = uno
framework = arduino
monitor_speed = 115200
upload_speed = 115200

[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
upload_speed = 921600
```

- [ ] **Step 3: Tạo `firmware/thingbot_stopmotion/README.md`**

```markdown
# NeoStopMotion ThingBot Firmware

## Hardware
- Arduino Uno (or ESP32 DevKit) + USB cable
- Arcade button (30mm, NO contact) → BUTTON_PIN (D4)
- LED (with 220Ω resistor) → LED_PIN (D5)
- Buzzer (passive) → BUZZER_PIN (D6)

## Wiring (Uno)
```
Arduino     Component
-------     ---------
GND ────────┬──── Button NC pin
            └──── Buzzer GND
            └──── LED cathode
D4 ─────────────── Button NO pin (INPUT_PULLUP)
D5 ──[220Ω]─────── LED anode
D6 ─────────────── Buzzer signal
5V ─── (powered via USB)
```

## Flash with PlatformIO
```bash
pio run -e uno -t upload
pio device monitor
# Press button → "SHOOT" appears
```

## Flash with Arduino IDE
1. Open `thingbot_stopmotion.ino`
2. Tools → Board → Arduino Uno (hoặc ESP32 Dev Module)
3. Tools → Port → /dev/cu.usbmodemXXXX
4. Sketch → Upload

## Test
```bash
screen /dev/cu.usbmodem* 115200
# (or `pio device monitor`)
# Should print "READY" on boot.
# Press button: SHOOT
# Hold 1.5s: UNDO
# Hold 3.5s: EXPORT
```
```

- [ ] **Step 4: Commit**

```bash
git add firmware/thingbot_stopmotion/
git commit -m "feat(firmware): ThingBot UART firmware with debounced button"
```

---

## Task T3.2: UARTListener + protocol parser

**Files:**
- Create: `src/neo_stopmotion/hardware/__init__.py`
- Create: `src/neo_stopmotion/hardware/uart_protocol.py`
- Create: `src/neo_stopmotion/hardware/uart_listener.py`
- Create: `tests/unit/test_uart_protocol.py`

- [ ] **Step 1: Test protocol parser**

`tests/unit/test_uart_protocol.py`:
```python
from neo_stopmotion.hardware.uart_protocol import parse_line, VALID_COMMANDS


def test_parse_valid_commands():
    for cmd in VALID_COMMANDS:
        assert parse_line(cmd) == cmd
        assert parse_line(cmd + "\n") == cmd
        assert parse_line(cmd + "\r\n") == cmd
        assert parse_line("  " + cmd + "  ") == cmd
        assert parse_line(cmd.lower()) == cmd  # case-insensitive


def test_parse_invalid_returns_none():
    assert parse_line("FOO") is None
    assert parse_line("") is None
    assert parse_line("   ") is None
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Tạo `hardware/__init__.py`** (empty doc)

```python
"""Hardware layer — UART listener + simulator."""
```

- [ ] **Step 4: Tạo `hardware/uart_protocol.py`**

```python
from __future__ import annotations

VALID_COMMANDS = frozenset({"SHOOT", "UNDO", "EXPORT", "READY", "BAT_LOW"})


def parse_line(line: str) -> str | None:
    """Strip + uppercase + validate. Return canonical command or None."""
    if line is None:
        return None
    cleaned = line.strip().upper()
    if cleaned in VALID_COMMANDS:
        return cleaned
    return None
```

- [ ] **Step 5: Run test → PASS**

- [ ] **Step 6: Tạo `hardware/uart_listener.py`**

```python
from __future__ import annotations
import glob
import time
from typing import Iterable

import serial
from PyQt6.QtCore import QObject, QThread, pyqtSignal
from loguru import logger

from neo_stopmotion.hardware.uart_protocol import parse_line
from neo_stopmotion.utils.signal_bus import SignalBus


COMMON_PORTS: tuple[str, ...] = (
    "/dev/ttyUSB0", "/dev/ttyUSB1",
    "/dev/ttyACM0", "/dev/ttyACM1",
)


def candidate_ports() -> list[str]:
    found = list(COMMON_PORTS)
    found.extend(glob.glob("/dev/tty.usbserial*"))
    found.extend(glob.glob("/dev/tty.usbmodem*"))
    found.extend(glob.glob("/dev/cu.usbmodem*"))
    found.extend(glob.glob("/dev/cu.usbserial*"))
    return found


def auto_detect_port(baudrate: int = 115200, timeout: float = 2.0) -> str | None:
    for port in candidate_ports():
        try:
            s = serial.Serial(port, baudrate, timeout=timeout)
            line = s.readline().decode(errors="ignore").strip()
            s.close()
            if line == "READY":
                logger.info(f"ThingBot detected on {port}")
                return port
        except (serial.SerialException, OSError, UnicodeDecodeError):
            continue
    return None


class _UARTWorker(QObject):
    line_received = pyqtSignal(str)
    disconnected = pyqtSignal()

    def __init__(self, port: str, baudrate: int) -> None:
        super().__init__()
        self.port = port
        self.baudrate = baudrate
        self._running = False
        self._serial: serial.Serial | None = None

    def stop(self) -> None:
        self._running = False
        if self._serial is not None:
            try:
                self._serial.close()
            except Exception:
                pass

    def run(self) -> None:
        try:
            self._serial = serial.Serial(self.port, self.baudrate, timeout=1.0)
        except serial.SerialException as e:
            logger.error(f"Serial open failed on {self.port}: {e}")
            self.disconnected.emit()
            return
        self._running = True
        logger.info(f"UART listening on {self.port} @ {self.baudrate}")
        while self._running:
            try:
                raw = self._serial.readline()
                if not raw:
                    continue
                line = raw.decode(errors="ignore")
                self.line_received.emit(line)
            except (serial.SerialException, OSError) as e:
                logger.warning(f"Serial read error: {e}")
                self.disconnected.emit()
                break


class UARTListener(QObject):
    """Listen to ThingBot UART and emit commands via SignalBus."""

    def __init__(
        self,
        port: str | None = None,
        baudrate: int = 115200,
        reconnect_interval: int = 2,
        debounce_ms: int = 200,
    ) -> None:
        super().__init__()
        self.port = port
        self.baudrate = baudrate
        self.reconnect_interval = reconnect_interval
        self.debounce_ms = debounce_ms
        self._bus = SignalBus.instance()
        self._thread: QThread | None = None
        self._worker: _UARTWorker | None = None
        self._last_emit_ms: float = 0.0

    def start(self) -> None:
        if self.port is None or self.port == "auto":
            self.port = auto_detect_port(self.baudrate)
        if self.port is None:
            logger.warning("No ThingBot detected; UART disabled")
            self._bus.uart_disconnected.emit()
            return
        self._spawn_worker()

    def _spawn_worker(self) -> None:
        self._thread = QThread()
        self._worker = _UARTWorker(self.port, self.baudrate)
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.line_received.connect(self._on_line)
        self._worker.disconnected.connect(self._on_disconnect)
        self._thread.start()
        self._bus.uart_reconnected.emit()

    def _on_line(self, line: str) -> None:
        cmd = parse_line(line)
        if cmd is None:
            return
        # Defensive debounce
        now = time.monotonic() * 1000.0
        if now - self._last_emit_ms < self.debounce_ms and cmd == "SHOOT":
            return
        self._last_emit_ms = now
        self._bus.uart_command_received.emit(cmd)

    def _on_disconnect(self) -> None:
        self._bus.uart_disconnected.emit()
        self.stop()

    def stop(self) -> None:
        if self._worker is not None:
            self._worker.stop()
        if self._thread is not None:
            self._thread.quit()
            self._thread.wait(2000)
        self._worker = None
        self._thread = None
```

- [ ] **Step 7: Commit**

```bash
git add src/neo_stopmotion/hardware/ tests/unit/test_uart_protocol.py
git commit -m "feat(hardware): UARTListener with auto-detect + protocol parser"
```

---

## Task T3.3: UARTSimulator (dev macOS)

**Files:**
- Create: `src/neo_stopmotion/hardware/uart_simulator.py`
- Create: `tests/integration/test_uart_simulator.py`

- [ ] **Step 1: Test simulator emits via SignalBus**

`tests/integration/__init__.py`: empty file.

`tests/integration/test_uart_simulator.py`:
```python
from neo_stopmotion.hardware.uart_simulator import UARTSimulator
from neo_stopmotion.utils.signal_bus import SignalBus


def test_simulator_emit_shoot():
    bus = SignalBus.instance()
    received = []
    bus.uart_command_received.connect(lambda cmd: received.append(cmd))
    sim = UARTSimulator()
    sim.start()
    sim.emit_command("SHOOT")
    assert received == ["SHOOT"]


def test_simulator_emit_invalid_ignored():
    bus = SignalBus.instance()
    received = []
    bus.uart_command_received.connect(lambda cmd: received.append(cmd))
    sim = UARTSimulator()
    sim.start()
    sim.emit_command("FOO")
    assert received == []
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Tạo `hardware/uart_simulator.py`**

```python
from __future__ import annotations
from PyQt6.QtCore import QObject
from loguru import logger

from neo_stopmotion.hardware.uart_protocol import parse_line
from neo_stopmotion.utils.signal_bus import SignalBus


class UARTSimulator(QObject):
    """Drop-in replacement for UARTListener used in dev/test.

    Does NOT open a serial port. Commands are injected via emit_command()
    or via keyboard fallback in MainWindow.qml.
    """

    def __init__(self) -> None:
        super().__init__()
        self._bus = SignalBus.instance()
        self._running = False

    def start(self) -> None:
        self._running = True
        logger.info("UARTSimulator started — use Space/Z/Enter or AppController.handle_uart_command()")
        self._bus.uart_reconnected.emit()

    def stop(self) -> None:
        self._running = False

    def emit_command(self, cmd: str) -> None:
        if not self._running:
            return
        canonical = parse_line(cmd)
        if canonical is None:
            logger.warning(f"Sim ignoring invalid cmd: {cmd}")
            return
        self._bus.uart_command_received.emit(canonical)
```

- [ ] **Step 4: Wire simulator vào `app.py` based on env**

Replace UART init block in `run()`:
```python
    uart_mode = settings.uart.port
    if uart_mode == "simulator":
        from neo_stopmotion.hardware.uart_simulator import UARTSimulator
        uart = UARTSimulator()
        uart.start()
        logger.info("UART: simulator mode")
    else:
        from neo_stopmotion.hardware.uart_listener import UARTListener
        uart = UARTListener(
            port=None if uart_mode == "auto" else uart_mode,
            baudrate=settings.uart.baudrate,
            reconnect_interval=settings.uart.reconnect_interval_seconds,
        )
        uart.start()
```

Add to bottom of `run()` before `app.exec()`:
```python
    app.aboutToQuit.connect(uart.stop)
```

- [ ] **Step 5: Run test → PASS**

```bash
pytest tests/integration/test_uart_simulator.py -v
```

- [ ] **Step 6: Smoke test simulator mode**

```bash
NEO_STOPMOTION_UART=simulator python -m neo_stopmotion
```
Expected: log "UART: simulator mode", bấm Space vẫn hoạt động (qua keyboard fallback).

- [ ] **Step 7: Commit**

```bash
git add src/neo_stopmotion/hardware/uart_simulator.py src/neo_stopmotion/app.py tests/integration/
git commit -m "feat(hardware): UARTSimulator for dev mode"
```

---

## Task T3.4: Reconnect loop + StatusBanner.qml

**Files:**
- Modify: `src/neo_stopmotion/hardware/uart_listener.py`
- Create: `src/neo_stopmotion/ui/qml/components/StatusBanner.qml`
- Modify: `src/neo_stopmotion/ui/qml/MainWindow.qml`
- Modify: `src/neo_stopmotion/ui/qml/singletons/AppState.qml`

- [ ] **Step 1: Add reconnect loop to UARTListener**

In `uart_listener.py`, add to `UARTListener`:
```python
from PyQt6.QtCore import QTimer

class UARTListener(QObject):
    def __init__(self, ...):
        # existing init ...
        self._reconnect_timer = QTimer()
        self._reconnect_timer.setInterval(self.reconnect_interval * 1000)
        self._reconnect_timer.timeout.connect(self._try_reconnect)

    def _on_disconnect(self) -> None:
        self._bus.uart_disconnected.emit()
        if self._worker is not None:
            self._worker.stop()
        self._reconnect_timer.start()

    def _try_reconnect(self) -> None:
        port = auto_detect_port(self.baudrate)
        if port is None:
            return
        self.port = port
        self._reconnect_timer.stop()
        self._spawn_worker()
        logger.info(f"UART reconnected on {port}")

    def stop(self) -> None:
        self._reconnect_timer.stop()
        # ... existing stop ...
```

- [ ] **Step 2: Tạo `components/StatusBanner.qml`**

```qml
import QtQuick
import "../singletons" as N

Rectangle {
    id: banner
    height: visible ? 48 : 0
    visible: text !== ""
    color: level === "warning" ? N.NeoConstants.warning :
           level === "error" ? N.NeoConstants.error :
           N.NeoConstants.success

    property string text: ""
    property string level: "info"  // info | warning | error

    Behavior on height { NumberAnimation { duration: 200 } }

    Text {
        anchors.centerIn: parent
        text: banner.text
        font.pixelSize: N.NeoConstants.fontBody
        color: "white"
    }
}
```

- [ ] **Step 3: Update `singletons/AppState.qml` thêm property**

```qml
    property string bannerText: ""
    property string bannerLevel: "info"
```

- [ ] **Step 4: Wire banner trong `MainWindow.qml`**

Add at top of `ApplicationWindow`:
```qml
    header: Components.StatusBanner {
        text: N.AppState.bannerText
        level: N.AppState.bannerLevel
    }
```

Add import:
```qml
import "components" as Components
```

Update `Connections` block:
```qml
    Connections {
        target: appController
        function onFrameCountChanged(n) { N.AppState.frameCount = n }
    }
    Connections {
        target: signalBusBridge
        function onUartConnected() {
            N.AppState.uartConnected = true
            N.AppState.bannerText = "Nút bấm sẵn sàng"
            N.AppState.bannerLevel = "info"
            bannerHideTimer.restart()
        }
        function onUartDisconnected() {
            N.AppState.uartConnected = false
            N.AppState.bannerText = "Nút bấm tạm nghỉ — dùng phím Space"
            N.AppState.bannerLevel = "warning"
        }
        function onWebcamError(msg) {
            N.AppState.bannerText = "Webcam đang ngủ — gọi Thợ Cả"
            N.AppState.bannerLevel = "error"
        }
    }
    Timer {
        id: bannerHideTimer
        interval: 3000
        onTriggered: N.AppState.bannerText = ""
    }
```

- [ ] **Step 5: Tạo `signalBusBridge` QObject in app.py**

In `app.py`, add a small bridge so QML can `Connections { target: signalBusBridge }`:

```python
from PyQt6.QtCore import QObject, pyqtSignal


class _SignalBusBridge(QObject):
    uartConnected = pyqtSignal()
    uartDisconnected = pyqtSignal()
    webcamReady = pyqtSignal()
    webcamError = pyqtSignal(str)

    def __init__(self, bus: SignalBus) -> None:
        super().__init__()
        bus.uart_reconnected.connect(self.uartConnected)
        bus.uart_disconnected.connect(self.uartDisconnected)
        bus.webcam_ready.connect(self.webcamReady)
        bus.webcam_error.connect(self.webcamError)
```

In `run()`:
```python
    bridge = _SignalBusBridge(bus)
    engine.rootContext().setContextProperty("signalBusBridge", bridge)
```

- [ ] **Step 6: Smoke test (no ThingBot)**

```bash
python -m neo_stopmotion
```
Expected: amber banner "Nút bấm tạm nghỉ — dùng phím Space" hiện ngay.

```bash
# Cắm ThingBot vào USB → banner xanh "Nút bấm sẵn sàng" trong 2-4s, rồi tự ẩn
```

- [ ] **Step 7: Commit**

```bash
git add src/neo_stopmotion/hardware/uart_listener.py src/neo_stopmotion/ui/qml/ src/neo_stopmotion/app.py
git commit -m "feat(hardware): UART reconnect loop + StatusBanner UI"
```

---

## Task T3.5: Integration test full flow simulator → frame

**Files:**
- Modify: `tests/integration/test_uart_simulator.py`

- [ ] **Step 1: Add e2e-ish test**

Append to `tests/integration/test_uart_simulator.py`:
```python
import numpy as np
from unittest.mock import MagicMock, patch

from neo_stopmotion.core.capture_engine import CaptureEngine
from neo_stopmotion.services.session_service import SessionService
from neo_stopmotion.services.app_controller import AppController
from neo_stopmotion.hardware.uart_simulator import UARTSimulator


def test_simulator_to_frame_save(tmp_path, qtbot):
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    fake_cap.read.return_value = (True, np.full((720, 1280, 3), 100, dtype=np.uint8))
    with patch("cv2.VideoCapture", return_value=fake_cap):
        capture = CaptureEngine()
        capture.open()
        session = SessionService(projects_dir=tmp_path, fps_playback=10)
        controller = AppController(capture=capture, session=session)
        sim = UARTSimulator()
        sim.start()

        sim.emit_command("SHOOT")
        sim.emit_command("SHOOT")
        sim.emit_command("SHOOT")

        assert session.frame_manager.frame_count == 3
        files = session.frame_manager.get_all_frames()
        assert len(files) == 3
        assert all(f.exists() for f in files)
```

- [ ] **Step 2: Run test → PASS**

```bash
pytest tests/integration/test_uart_simulator.py -v
```

- [ ] **Step 3: Manual test trên NEO One với ThingBot thật** (deferred to Epic 6)

- [ ] **Step 4: Commit**

```bash
git add tests/integration/test_uart_simulator.py
git commit -m "test(integration): UARTSimulator → AppController → FrameManager flow"
```

**Epic 3 demo criteria**: ThingBot vật lý → bấm nút → frame mới capture, LED nhấp nháy, banner xanh "Nút bấm sẵn sàng". Rút USB → banner amber + keyboard fallback.

---

# Epic 4 — Export Pipeline (3 ngày, 4 tasks)

## Task T4.1: VideoExporter MP4 (ffmpeg)

**Files:**
- Create: `src/neo_stopmotion/core/video_exporter.py`
- Create: `tests/unit/test_video_exporter.py`

- [ ] **Step 1: Test MP4 export uses ffmpeg**

`tests/unit/test_video_exporter.py`:
```python
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from neo_stopmotion.core.video_exporter import VideoExporter, ExportError


@pytest.fixture
def exporter():
    return VideoExporter(fps=10, ffmpeg="ffmpeg")


def test_export_mp4_calls_ffmpeg(tmp_path, exporter):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    (frames_dir / "frame_0001.png").write_bytes(b"fake")
    (frames_dir / "frame_0002.png").write_bytes(b"fake")
    output = tmp_path / "out.mp4"

    fake_result = MagicMock()
    fake_result.returncode = 0
    with patch("subprocess.run", return_value=fake_result) as run:
        exporter.export_mp4(frames_dir, output)
        run.assert_called_once()
        args = run.call_args[0][0]
        assert "ffmpeg" in args
        assert "-framerate" in args
        assert "10" in args
        assert "libx264" in args
        assert str(output) in args


def test_export_mp4_raises_on_ffmpeg_failure(tmp_path, exporter):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    (frames_dir / "frame_0001.png").write_bytes(b"fake")
    output = tmp_path / "out.mp4"

    fake_result = MagicMock()
    fake_result.returncode = 1
    fake_result.stderr = b"oops"
    with patch("subprocess.run", return_value=fake_result):
        with pytest.raises(ExportError, match="ffmpeg"):
            exporter.export_mp4(frames_dir, output)
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Tạo `core/video_exporter.py`**

```python
from __future__ import annotations
import subprocess
from pathlib import Path
from loguru import logger


class ExportError(RuntimeError):
    pass


class VideoExporter:
    def __init__(
        self,
        fps: int = 10,
        ffmpeg: str = "ffmpeg",
        codec: str = "libx264",
        pix_fmt: str = "yuv420p",
        gif_scale_width: int = 640,
    ) -> None:
        self.fps = fps
        self.ffmpeg = ffmpeg
        self.codec = codec
        self.pix_fmt = pix_fmt
        self.gif_scale_width = gif_scale_width

    def export_mp4(self, frames_dir: Path, output_path: Path) -> Path:
        cmd = [
            self.ffmpeg, "-y",
            "-framerate", str(self.fps),
            "-i", str(frames_dir / "frame_%04d.png"),
            "-c:v", self.codec,
            "-pix_fmt", self.pix_fmt,
            "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
            str(output_path),
        ]
        logger.info(f"ffmpeg MP4: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode != 0:
            raise ExportError(f"ffmpeg MP4 failed: {result.stderr.decode(errors='ignore')[:500]}")
        return output_path
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Manual smoke test với frames thật**

```bash
mkdir -p /tmp/frames_smoke
# Sinh 5 PNG đỏ-xanh-vàng đơn giản
python -c "
import cv2, numpy as np
for i, c in enumerate([(0,0,255),(0,255,0),(0,255,255),(255,0,0),(255,255,255)], 1):
    f = np.full((720,1280,3), c, dtype=np.uint8)
    cv2.imwrite(f'/tmp/frames_smoke/frame_{i:04d}.png', f)
"
python -c "
from pathlib import Path
from neo_stopmotion.core.video_exporter import VideoExporter
VideoExporter(fps=10).export_mp4(Path('/tmp/frames_smoke'), Path('/tmp/out.mp4'))
print('OK')
"
open /tmp/out.mp4   # macOS — Quick Look should play 0.5s clip
```

- [ ] **Step 6: Commit**

```bash
git add src/neo_stopmotion/core/video_exporter.py tests/unit/test_video_exporter.py
git commit -m "feat(export): VideoExporter MP4 via ffmpeg libx264"
```

---

## Task T4.2: VideoExporter GIF (2-pass palette)

**Files:**
- Modify: `src/neo_stopmotion/core/video_exporter.py`
- Modify: `tests/unit/test_video_exporter.py`

- [ ] **Step 1: Add GIF test**

Append to test:
```python
def test_export_gif_calls_ffmpeg_twice(tmp_path, exporter):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    (frames_dir / "frame_0001.png").write_bytes(b"fake")
    output = tmp_path / "out.gif"

    fake = MagicMock()
    fake.returncode = 0
    with patch("subprocess.run", return_value=fake) as run:
        exporter.export_gif(frames_dir, output)
        # palettegen + paletteuse → 2 calls
        assert run.call_count == 2
        first = run.call_args_list[0][0][0]
        second = run.call_args_list[1][0][0]
        assert "palettegen" in " ".join(first)
        assert "paletteuse" in " ".join(second)
```

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Add `export_gif` method**

Append to `VideoExporter`:
```python
    def export_gif(self, frames_dir: Path, output_path: Path) -> Path:
        palette = output_path.parent / "_palette.png"
        try:
            cmd1 = [
                self.ffmpeg, "-y",
                "-framerate", str(self.fps),
                "-i", str(frames_dir / "frame_%04d.png"),
                "-vf", f"scale={self.gif_scale_width}:-1:flags=lanczos,palettegen",
                str(palette),
            ]
            r1 = subprocess.run(cmd1, capture_output=True)
            if r1.returncode != 0:
                raise ExportError(f"ffmpeg palettegen failed: {r1.stderr.decode(errors='ignore')[:500]}")
            cmd2 = [
                self.ffmpeg, "-y",
                "-framerate", str(self.fps),
                "-i", str(frames_dir / "frame_%04d.png"),
                "-i", str(palette),
                "-filter_complex",
                f"scale={self.gif_scale_width}:-1:flags=lanczos[x];[x][1:v]paletteuse",
                str(output_path),
            ]
            r2 = subprocess.run(cmd2, capture_output=True)
            if r2.returncode != 0:
                raise ExportError(f"ffmpeg paletteuse failed: {r2.stderr.decode(errors='ignore')[:500]}")
            return output_path
        finally:
            if palette.exists():
                palette.unlink()
```

- [ ] **Step 4: Run test → PASS** + manual smoke test

```bash
python -c "
from pathlib import Path
from neo_stopmotion.core.video_exporter import VideoExporter
VideoExporter(fps=10).export_gif(Path('/tmp/frames_smoke'), Path('/tmp/out.gif'))
"
open /tmp/out.gif
```

- [ ] **Step 5: Commit**

```bash
git add src/neo_stopmotion/core/video_exporter.py tests/unit/test_video_exporter.py
git commit -m "feat(export): VideoExporter GIF with 2-pass palette"
```

---

## Task T4.3: ExportWorker QThread + ExportService

**Files:**
- Create: `src/neo_stopmotion/services/export_service.py`
- Modify: `src/neo_stopmotion/services/app_controller.py`
- Create: `tests/integration/test_capture_to_export.py`

- [ ] **Step 1: Tạo `services/export_service.py`**

```python
from __future__ import annotations
import time
from pathlib import Path
from PyQt6.QtCore import QObject, QThread, pyqtSignal
from loguru import logger

from neo_stopmotion.core.frame_manager import FrameManager
from neo_stopmotion.core.video_exporter import VideoExporter, ExportError
from neo_stopmotion.utils.signal_bus import SignalBus


class _ExportWorker(QObject):
    progress = pyqtSignal(float)
    completed = pyqtSignal(dict)
    failed = pyqtSignal(str)

    def __init__(self, fm: FrameManager, exporter: VideoExporter) -> None:
        super().__init__()
        self.fm = fm
        self.exporter = exporter

    def run(self) -> None:
        start = time.monotonic()
        try:
            self.progress.emit(0.1)
            mp4 = self.fm.session_dir / "output.mp4"
            self.exporter.export_mp4(self.fm.frames_dir, mp4)
            self.progress.emit(0.6)
            gif = self.fm.session_dir / "output.gif"
            self.exporter.export_gif(self.fm.frames_dir, gif)
            self.progress.emit(0.95)
            elapsed = time.monotonic() - start
            self.fm.metadata.exported = True
            self.fm.metadata.mp4_path = mp4
            self.fm.metadata.gif_path = gif
            self.fm._save_metadata()
            self.progress.emit(1.0)
            self.completed.emit({
                "mp4_path": str(mp4),
                "gif_path": str(gif),
                "elapsed_seconds": elapsed,
            })
        except ExportError as e:
            logger.error(f"Export failed: {e}")
            self.failed.emit(str(e))


class ExportService(QObject):
    def __init__(self, exporter: VideoExporter) -> None:
        super().__init__()
        self._exporter = exporter
        self._bus = SignalBus.instance()
        self._thread: QThread | None = None
        self._worker: _ExportWorker | None = None

    def start_export(self, fm: FrameManager) -> None:
        if self._thread is not None and self._thread.isRunning():
            logger.warning("Export already in progress")
            return
        self._thread = QThread()
        self._worker = _ExportWorker(fm, self._exporter)
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.progress.connect(self._bus.export_progress)
        self._worker.completed.connect(self._on_completed)
        self._worker.failed.connect(self._on_failed)
        self._bus.export_started.emit()
        self._thread.start()

    def _on_completed(self, payload: dict) -> None:
        self._bus.export_completed.emit(payload)
        self._cleanup()

    def _on_failed(self, msg: str) -> None:
        self._bus.export_failed.emit(msg)
        self._cleanup()

    def _cleanup(self) -> None:
        if self._thread is not None:
            self._thread.quit()
            self._thread.wait(2000)
        self._thread = None
        self._worker = None
```

- [ ] **Step 2: Wire AppController._do_export**

Modify `services/app_controller.py`:
```python
from neo_stopmotion.services.export_service import ExportService

class AppController(QObject):
    def __init__(self, capture, session, export_service: ExportService, min_frames: int = 5) -> None:
        super().__init__()
        # ... existing ...
        self._export_service = export_service
        self._min_frames = min_frames

    def _do_export(self) -> None:
        fm = self._session.frame_manager
        if fm.frame_count < self._min_frames:
            self._bus.status_message.emit("warning", f"Cần ít nhất {self._min_frames} frame!")
            return
        self._export_service.start_export(fm)
```

- [ ] **Step 3: Update `app.py` to instantiate ExportService**

```python
from neo_stopmotion.core.video_exporter import VideoExporter
from neo_stopmotion.services.export_service import ExportService

# in run():
exporter = VideoExporter(
    fps=settings.export.playback_fps,
    ffmpeg=settings.export.ffmpeg_binary,
    codec=settings.export.mp4_codec,
    pix_fmt=settings.export.mp4_pix_fmt,
    gif_scale_width=settings.export.gif_scale_width,
)
export_service = ExportService(exporter)
controller = AppController(
    capture=capture,
    session=session,
    export_service=export_service,
    min_frames=settings.export.min_frames,
)
```

- [ ] **Step 4: Integration test**

`tests/integration/test_capture_to_export.py`:
```python
import shutil
import subprocess
from pathlib import Path
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from neo_stopmotion.core.capture_engine import CaptureEngine
from neo_stopmotion.core.video_exporter import VideoExporter
from neo_stopmotion.services.session_service import SessionService


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_capture_5_frames_then_export_mp4(tmp_path):
    fake_cap = MagicMock()
    fake_cap.isOpened.return_value = True
    # generate distinct grey-shade frames
    counter = {"i": 0}
    def fake_read():
        counter["i"] += 1
        return (True, np.full((720, 1280, 3), counter["i"] * 30, dtype=np.uint8))
    fake_cap.read = fake_read
    with patch("cv2.VideoCapture", return_value=fake_cap):
        cap = CaptureEngine()
        cap.open()
        sess = SessionService(projects_dir=tmp_path, fps_playback=10)
        for _ in range(5):
            f = cap.capture_frame()
            sess.frame_manager.add_frame(f)
        out = tmp_path / "out.mp4"
        VideoExporter(fps=10).export_mp4(sess.frame_manager.frames_dir, out)
        assert out.exists()
        assert out.stat().st_size > 1000
```

- [ ] **Step 5: Run test → PASS**

- [ ] **Step 6: Commit**

```bash
git add src/neo_stopmotion/services/ tests/integration/test_capture_to_export.py src/neo_stopmotion/app.py
git commit -m "feat(export): ExportService with QThread worker"
```

---

## Task T4.4: ExportingPage.qml + progress UI

**Files:**
- Create: `src/neo_stopmotion/ui/qml/pages/ExportingPage.qml`
- Modify: `src/neo_stopmotion/ui/qml/MainWindow.qml`
- Modify: `src/neo_stopmotion/app.py` (extend SignalBusBridge)

- [ ] **Step 1: Tạo `pages/ExportingPage.qml`**

```qml
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N

Item {
    id: root
    property real progress: 0.0
    property string statusText: "Đang ghép phim..."

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.background
    }

    ColumnLayout {
        anchors.centerIn: parent
        spacing: N.NeoConstants.spacingXL
        width: parent.width * 0.6

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "🎬"
            font.pixelSize: 96
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: root.statusText
            font.pixelSize: N.NeoConstants.fontTitle
            color: N.NeoConstants.primary
        }

        ProgressBar {
            Layout.fillWidth: true
            from: 0.0
            to: 1.0
            value: root.progress
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: Math.round(root.progress * 100) + "%"
            font.pixelSize: N.NeoConstants.fontBody
            color: N.NeoConstants.textSecondary
        }
    }
}
```

- [ ] **Step 2: Extend `_SignalBusBridge` in `app.py`**

```python
class _SignalBusBridge(QObject):
    uartConnected = pyqtSignal()
    uartDisconnected = pyqtSignal()
    webcamReady = pyqtSignal()
    webcamError = pyqtSignal(str)
    exportStarted = pyqtSignal()
    exportProgress = pyqtSignal(float)
    exportCompleted = pyqtSignal('QVariant')
    exportFailed = pyqtSignal(str)
    statusMessage = pyqtSignal(str, str)

    def __init__(self, bus: SignalBus) -> None:
        super().__init__()
        bus.uart_reconnected.connect(self.uartConnected)
        bus.uart_disconnected.connect(self.uartDisconnected)
        bus.webcam_ready.connect(self.webcamReady)
        bus.webcam_error.connect(self.webcamError)
        bus.export_started.connect(self.exportStarted)
        bus.export_progress.connect(self.exportProgress)
        bus.export_completed.connect(self.exportCompleted)
        bus.export_failed.connect(self.exportFailed)
        bus.status_message.connect(self.statusMessage)
```

- [ ] **Step 3: Wire transitions in MainWindow.qml**

Add inside `Connections { target: signalBusBridge }`:
```qml
        function onExportStarted() {
            stack.replace(exportingPageComponent)
        }
        function onExportProgress(p) {
            if (stack.currentItem && stack.currentItem.progress !== undefined) {
                stack.currentItem.progress = p
            }
        }
        function onExportFailed(msg) {
            N.AppState.bannerText = "Đang gặp trục trặc — Thợ Cả đang xử lý"
            N.AppState.bannerLevel = "error"
            stack.replace(capturePageComponent)
        }
```

Add component:
```qml
    Component {
        id: exportingPageComponent
        Pages.ExportingPage { }
    }
```

- [ ] **Step 4: Smoke test full flow**

```bash
NEO_STOPMOTION_UART=simulator python -m neo_stopmotion
# Bấm Space 5 lần → 5 frames captured
# Bấm Enter → ExportingPage hiển thị progress 10% → 60% → 95% → 100%
# Sau ~3-5s, export completed (chuyển sang capture lại; SuccessPage chưa làm — T5.3)
ls ~/neostopmotion_sessions/session_*/output.mp4
```

- [ ] **Step 5: Commit**

```bash
git add src/neo_stopmotion/ui/qml/pages/ExportingPage.qml src/neo_stopmotion/ui/qml/MainWindow.qml src/neo_stopmotion/app.py
git commit -m "feat(ui): ExportingPage with progress bar wired to bus"
```

**Epic 4 demo criteria**: 30 frames → bấm EXPORT → progress bar mượt → MP4 + GIF tạo trong session folder, mở phát được trên Quick Look. Không block UI.

---

# Epic 5 — Share & Polish (3 ngày, 6 tasks)

## Task T5.1: ShareServer (http.server + local IP)

**Files:**
- Create: `src/neo_stopmotion/utils/network.py`
- Create: `src/neo_stopmotion/core/share_server.py`
- Create: `tests/unit/test_share_server.py`

- [ ] **Step 1: Tạo `utils/network.py`**

```python
from __future__ import annotations
import socket


def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip
```

- [ ] **Step 2: Test ShareServer**

`tests/unit/test_share_server.py`:
```python
import urllib.request
import time
import pytest
from pathlib import Path
from neo_stopmotion.core.share_server import ShareServer


def test_serves_files(tmp_path):
    (tmp_path / "hello.txt").write_text("world")
    srv = ShareServer(serve_dir=tmp_path, port=18001)
    srv.start()
    time.sleep(0.5)
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:18001/hello.txt", timeout=2) as r:
            assert r.read() == b"world"
    finally:
        srv.stop()


def test_qr_generated(tmp_path):
    srv = ShareServer(serve_dir=tmp_path, port=18002)
    qr_path = srv.generate_qr("http://example.com/test", tmp_path / "qr.png")
    assert qr_path.exists()
    assert qr_path.stat().st_size > 100


def test_get_download_url(tmp_path, monkeypatch):
    monkeypatch.setattr("neo_stopmotion.core.share_server.get_local_ip", lambda: "192.168.1.42")
    srv = ShareServer(serve_dir=tmp_path, port=18003)
    url = srv.get_download_url("session_x/output.mp4")
    assert url == "http://192.168.1.42:18003/session_x/output.mp4"
```

- [ ] **Step 3: Run test — FAIL**

- [ ] **Step 4: Tạo `core/share_server.py`**

```python
from __future__ import annotations
import http.server
import socketserver
import threading
from pathlib import Path
import qrcode
from loguru import logger

from neo_stopmotion.utils.network import get_local_ip


class _ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


class ShareServer:
    def __init__(self, serve_dir: Path, port: int = 8000, qr_size: int = 400) -> None:
        self.serve_dir = Path(serve_dir)
        self.port = port
        self.qr_size = qr_size
        self._server: _ThreadingTCPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._server is not None:
            return
        serve_dir = self.serve_dir

        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *a, **kw):
                super().__init__(*a, directory=str(serve_dir), **kw)
            def log_message(self, fmt, *args):
                logger.debug(f"http {self.address_string()} {fmt % args}")

        self._server = _ThreadingTCPServer(("", self.port), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        logger.info(f"ShareServer listening on http://{get_local_ip()}:{self.port}")

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
        self._server = None

    def get_download_url(self, relative_path: str) -> str:
        return f"http://{get_local_ip()}:{self.port}/{relative_path.lstrip('/')}"

    def generate_qr(self, url: str, output_path: Path) -> Path:
        img = qrcode.make(url)
        img = img.resize((self.qr_size, self.qr_size))
        img.save(str(output_path))
        return output_path
```

- [ ] **Step 5: Run test → PASS**

- [ ] **Step 6: Commit**

```bash
git add src/neo_stopmotion/core/share_server.py src/neo_stopmotion/utils/network.py tests/unit/test_share_server.py
git commit -m "feat(share): ShareServer http + QR generator"
```

---

## Task T5.2: Wire ShareServer + QRDisplay.qml

**Files:**
- Modify: `src/neo_stopmotion/services/export_service.py`
- Modify: `src/neo_stopmotion/app.py`
- Create: `src/neo_stopmotion/ui/qml/components/QRDisplay.qml`

- [ ] **Step 1: ExportService also generates QR**

Modify `_ExportWorker.run` in `services/export_service.py`:
```python
class _ExportWorker(QObject):
    progress = pyqtSignal(float)
    completed = pyqtSignal(dict)
    failed = pyqtSignal(str)

    def __init__(self, fm, exporter, share_server) -> None:
        super().__init__()
        self.fm = fm
        self.exporter = exporter
        self.share_server = share_server

    def run(self) -> None:
        start = time.monotonic()
        try:
            self.progress.emit(0.1)
            mp4 = self.fm.session_dir / "output.mp4"
            self.exporter.export_mp4(self.fm.frames_dir, mp4)
            self.progress.emit(0.55)
            gif = self.fm.session_dir / "output.gif"
            self.exporter.export_gif(self.fm.frames_dir, gif)
            self.progress.emit(0.85)
            relative = f"{self.fm.session_dir.name}/output.mp4"
            url = self.share_server.get_download_url(relative)
            qr = self.share_server.generate_qr(url, self.fm.session_dir / "qr.png")
            self.progress.emit(0.98)
            elapsed = time.monotonic() - start
            self.fm.metadata.exported = True
            self.fm.metadata.mp4_path = mp4
            self.fm.metadata.gif_path = gif
            self.fm.metadata.qr_path = qr
            self.fm.metadata.download_url = url
            self.fm._save_metadata()
            self.progress.emit(1.0)
            self.completed.emit({
                "mp4_path": str(mp4),
                "gif_path": str(gif),
                "qr_path": str(qr),
                "download_url": url,
                "elapsed_seconds": elapsed,
            })
        except Exception as e:
            logger.error(f"Export failed: {e}")
            self.failed.emit(str(e))


class ExportService(QObject):
    def __init__(self, exporter, share_server) -> None:
        super().__init__()
        self._exporter = exporter
        self._share_server = share_server
        # ... rest unchanged ...

    def start_export(self, fm: FrameManager) -> None:
        # ... unchanged init code, but pass share_server:
        self._worker = _ExportWorker(fm, self._exporter, self._share_server)
        # ... rest unchanged ...
```

- [ ] **Step 2: Wire ShareServer trong app.py**

```python
from neo_stopmotion.core.share_server import ShareServer

share_server = ShareServer(
    serve_dir=Path(settings.storage.projects_dir).expanduser(),
    port=settings.server.http_port,
    qr_size=settings.server.qr_size,
)
share_server.start()
export_service = ExportService(exporter, share_server)
# ... wire to controller ...

app.aboutToQuit.connect(share_server.stop)
```

- [ ] **Step 3: Tạo `components/QRDisplay.qml`**

```qml
import QtQuick
import QtQuick.Layouts
import "../singletons" as N

Item {
    id: root
    property string qrPath: ""
    property string url: ""

    ColumnLayout {
        anchors.centerIn: parent
        spacing: N.NeoConstants.spacingM

        Image {
            Layout.alignment: Qt.AlignHCenter
            source: root.qrPath !== "" ? "file:" + root.qrPath : ""
            sourceSize.width: 400
            sourceSize.height: 400
            cache: false
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "PH ơi, quét mã bằng Zalo để tải phim"
            font.pixelSize: N.NeoConstants.fontBody
            color: N.NeoConstants.textPrimary
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: root.url
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.textSecondary
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/neo_stopmotion/services/export_service.py src/neo_stopmotion/app.py src/neo_stopmotion/ui/qml/components/QRDisplay.qml
git commit -m "feat(share): ExportService generates QR via ShareServer"
```

---

## Task T5.3: SuccessPage + reset session

**Files:**
- Create: `src/neo_stopmotion/ui/qml/pages/SuccessPage.qml`
- Modify: `src/neo_stopmotion/ui/qml/MainWindow.qml`
- Modify: `src/neo_stopmotion/services/app_controller.py`

- [ ] **Step 1: Tạo `pages/SuccessPage.qml`**

```qml
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtMultimedia
import "../singletons" as N
import "../components"

Item {
    id: root
    property string mp4Path: ""
    property string qrPath: ""
    property string downloadUrl: ""

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.background
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: N.NeoConstants.spacingL
        spacing: N.NeoConstants.spacingXL

        // Left: video preview
        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: parent.width * 0.5
            color: "black"
            radius: 12

            MediaPlayer {
                id: player
                source: root.mp4Path !== "" ? "file:" + root.mp4Path : ""
                videoOutput: vo
                loops: MediaPlayer.Infinite
                Component.onCompleted: play()
            }
            VideoOutput {
                id: vo
                anchors.fill: parent
                anchors.margins: 8
            }
        }

        // Right: QR + reset
        ColumnLayout {
            Layout.fillHeight: true
            Layout.fillWidth: true
            spacing: N.NeoConstants.spacingL

            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "🎉 Phim của con đã xong!"
                font.pixelSize: N.NeoConstants.fontTitle
                font.bold: true
                color: N.NeoConstants.success
            }

            QRDisplay {
                Layout.fillWidth: true
                Layout.fillHeight: true
                qrPath: root.qrPath
                url: root.downloadUrl
            }

            Button {
                Layout.alignment: Qt.AlignHCenter
                Layout.preferredHeight: N.NeoConstants.buttonHeight
                Layout.preferredWidth: 320
                text: "Quay lại làm phim mới"
                font.pixelSize: N.NeoConstants.fontButton
                onClicked: appController.reset_session()
            }
        }
    }
}
```

- [ ] **Step 2: Add `reset_session` slot to AppController**

```python
@pyqtSlot()
def reset_session(self) -> None:
    self._session.reset()
    self._capture.reset()
    self._frame_count = 0
    self.frameCountChanged.emit(0)
    self._bus.session_reset.emit()
```

- [ ] **Step 3: MainWindow.qml — wire SuccessPage**

```qml
    Component {
        id: successPageComponent
        Pages.SuccessPage { }
    }
```

In `Connections { target: signalBusBridge }`:
```qml
        function onExportCompleted(payload) {
            stack.replace(successPageComponent, {
                mp4Path: payload.mp4_path,
                qrPath: payload.qr_path,
                downloadUrl: payload.download_url,
            })
        }
        function onSessionReset() {
            stack.replace(capturePageComponent)
        }
```

Add bus signal `sessionReset`:
```python
class _SignalBusBridge(QObject):
    # ... existing ...
    sessionReset = pyqtSignal()

    def __init__(self, bus: SignalBus) -> None:
        # ... existing ...
        bus.session_reset.connect(self.sessionReset)
```

- [ ] **Step 4: Smoke test full happy path**

```bash
NEO_STOPMOTION_UART=simulator python -m neo_stopmotion
# Bấm Space 10 lần → bấm Enter → 3-5s loading → SuccessPage với video loop + QR
# Quét QR bằng iPhone Camera (cùng WiFi) → tải MP4 thành công
# Bấm "Quay lại" → CapturePage session mới (frame_count = 0)
```

- [ ] **Step 5: Commit**

```bash
git add src/neo_stopmotion/ui/qml/pages/SuccessPage.qml src/neo_stopmotion/ui/qml/MainWindow.qml src/neo_stopmotion/services/app_controller.py src/neo_stopmotion/app.py
git commit -m "feat(ui): SuccessPage with video preview + QR + reset"
```

---

## Task T5.4: NeoAudio singleton + sound effects

**Files:**
- Create: `src/neo_stopmotion/ui/qml/singletons/NeoAudio.qml`
- Modify: `src/neo_stopmotion/ui/qml/singletons/qmldir`
- Add: `src/neo_stopmotion/resources/sounds/{tach,undo,success}.wav`
- Modify: `src/neo_stopmotion/ui/qml/MainWindow.qml`

- [ ] **Step 1: Generate or source 3 short WAV files**

Use `sox` or download CC0 from freesound.org, or generate stubs:
```bash
mkdir -p src/neo_stopmotion/resources/sounds
# Synth 3 distinct beeps (requires sox)
sox -n -r 44100 src/neo_stopmotion/resources/sounds/tach.wav synth 0.05 sine 800
sox -n -r 44100 src/neo_stopmotion/resources/sounds/undo.wav synth 0.1 sine 400
sox -n -r 44100 src/neo_stopmotion/resources/sounds/success.wav synth 0.5 sine 600 sine 800 sine 1000
```

If `sox` unavailable, place 3 silent placeholders (any 0.1s WAV).

- [ ] **Step 2: Tạo `singletons/NeoAudio.qml`**

```qml
pragma Singleton
import QtQuick
import QtMultimedia

QtObject {
    property url soundsDir: "../../resources/sounds/"

    property SoundEffect tach: SoundEffect {
        source: Qt.resolvedUrl(soundsDir + "tach.wav")
        volume: 0.8
    }
    property SoundEffect undo: SoundEffect {
        source: Qt.resolvedUrl(soundsDir + "undo.wav")
        volume: 0.7
    }
    property SoundEffect success: SoundEffect {
        source: Qt.resolvedUrl(soundsDir + "success.wav")
        volume: 0.9
    }

    function playTach() { tach.play() }
    function playUndo() { undo.play() }
    function playSuccess() { success.play() }
}
```

- [ ] **Step 3: Update `singletons/qmldir`**

```
module NeoSingletons
singleton NeoConstants 1.0 NeoConstants.qml
singleton AppState 1.0 AppState.qml
singleton NeoAudio 1.0 NeoAudio.qml
```

- [ ] **Step 4: Wire in MainWindow.qml — play on bus signals**

In `Connections { target: signalBusBridge }`:
```qml
        function onFrameCaptured(n, p) {
            N.NeoAudio.playTach()
            if (stack.currentItem && stack.currentItem.flashCapture) {
                stack.currentItem.flashCapture()
            }
        }
        function onFrameUndone(n) {
            N.NeoAudio.playUndo()
        }
        function onExportCompleted(payload) {
            N.NeoAudio.playSuccess()
            stack.replace(successPageComponent, payload)
        }
```

Add bridge signals:
```python
    frameCaptured = pyqtSignal(int, str)
    frameUndone = pyqtSignal(int)

    def __init__(self, bus):
        # ... existing ...
        bus.frame_captured.connect(self.frameCaptured)
        bus.frame_undone.connect(self.frameUndone)
```

- [ ] **Step 5: Smoke test**

```bash
NEO_STOPMOTION_UART=simulator python -m neo_stopmotion
# Bấm Space → tiếng "tách"
# Bấm Z → tiếng "undo"
# Bấm Enter sau 5+ frames → loading → tiếng "success"
```

- [ ] **Step 6: Commit**

```bash
git add src/neo_stopmotion/resources/ src/neo_stopmotion/ui/qml/singletons/ src/neo_stopmotion/ui/qml/MainWindow.qml src/neo_stopmotion/app.py
git commit -m "feat(ui): NeoAudio singleton + tách/undo/success WAV"
```

---

## Task T5.5: CountdownOverlay (F-11)

**Files:**
- Create: `src/neo_stopmotion/ui/qml/components/CountdownOverlay.qml`
- Modify: `src/neo_stopmotion/ui/qml/pages/CapturePage.qml`
- Modify: `src/neo_stopmotion/services/app_controller.py`

- [ ] **Step 1: Tạo `components/CountdownOverlay.qml`**

```qml
import QtQuick
import "../singletons" as N

Item {
    id: root
    visible: false
    property int seconds: 3
    signal finished()

    Rectangle {
        anchors.fill: parent
        color: "#80000000"
    }

    Text {
        anchors.centerIn: parent
        text: root.seconds
        font.pixelSize: 240
        font.bold: true
        color: N.NeoConstants.accent

        SequentialAnimation on scale {
            running: root.visible
            loops: Animation.Infinite
            NumberAnimation { from: 0.5; to: 1.5; duration: 800; easing.type: Easing.OutQuad }
            NumberAnimation { from: 1.5; to: 0.5; duration: 0 }
        }
    }

    Timer {
        id: ticker
        interval: 1000
        running: root.visible
        repeat: true
        onTriggered: {
            if (root.seconds <= 1) {
                root.visible = false
                root.finished()
                root.seconds = 3  // reset
            } else {
                root.seconds--
            }
        }
    }

    function start() {
        seconds = 3
        visible = true
    }
}
```

- [ ] **Step 2: Add Countdown to CapturePage**

In `pages/CapturePage.qml`, add inside the root Item:
```qml
    Components.CountdownOverlay {
        id: countdown
        anchors.fill: parent
        z: 100
        onFinished: appController.shoot_now()
    }

    function startCountdown() {
        countdown.start()
    }
```

(`Components` import ở đầu page: `import "../components" as Components`)

- [ ] **Step 3: AppController split _do_shoot**

```python
@pyqtSlot()
def shoot_now(self) -> None:
    """Actual capture, called after countdown (or directly)."""
    try:
        frame = self._capture.capture_frame()
    except CaptureError as e:
        logger.error(f"Capture failed: {e}")
        self._bus.webcam_error.emit(str(e))
        return
    path = self._session.frame_manager.add_frame(frame)
    self._frame_count = self._session.frame_manager.frame_count
    self.frameCountChanged.emit(self._frame_count)
    self._bus.frame_captured.emit(self._frame_count, str(path))

requestCountdown = pyqtSignal()

def _do_shoot(self) -> None:
    if self._show_countdown:
        self.requestCountdown.emit()
    else:
        self.shoot_now()
```

Add `_show_countdown` from settings constructor.

- [ ] **Step 4: Wire in MainWindow.qml**

```qml
    Connections {
        target: appController
        function onRequestCountdown() {
            if (stack.currentItem && stack.currentItem.startCountdown) {
                stack.currentItem.startCountdown()
            } else {
                appController.shoot_now()
            }
        }
    }
```

- [ ] **Step 5: Smoke test**

Set `[ui] show_countdown = true`, bấm Space → 3-2-1 đếm ngược 3s → frame mới capture với tiếng "tách".

- [ ] **Step 6: Commit**

```bash
git add src/neo_stopmotion/ui/qml/components/CountdownOverlay.qml src/neo_stopmotion/ui/qml/pages/CapturePage.qml src/neo_stopmotion/services/app_controller.py src/neo_stopmotion/ui/qml/MainWindow.qml
git commit -m "feat(ui): F-11 CountdownOverlay 3-2-1 before capture"
```

---

## Task T5.6: ThumbnailStrip (F-12) + TitleInputDialog (F-13)

**Files:**
- Create: `src/neo_stopmotion/ui/qml/components/ThumbnailStrip.qml`
- Create: `src/neo_stopmotion/ui/qml/components/TitleInputDialog.qml`
- Modify: `src/neo_stopmotion/ui/qml/pages/CapturePage.qml`
- Modify: `src/neo_stopmotion/services/app_controller.py`

- [ ] **Step 1: Add `latestFramePath` model to AppController**

```python
latestFramesChanged = pyqtSignal('QStringList')

@pyqtProperty('QStringList', notify=latestFramesChanged)
def latestFrames(self) -> list[str]:
    fm = self._session.frame_manager
    paths = fm.get_all_frames()[-5:]
    return [str(p) for p in paths]
```

In `shoot_now` after `add_frame`:
```python
    self.latestFramesChanged.emit(self.latestFrames)
```

In `_do_undo` after undo:
```python
    self.latestFramesChanged.emit(self.latestFrames)
```

- [ ] **Step 2: Tạo `components/ThumbnailStrip.qml`**

```qml
import QtQuick
import QtQuick.Layouts
import "../singletons" as N

Rectangle {
    color: "transparent"
    radius: 8

    property var frames: appController ? appController.latestFrames : []

    RowLayout {
        anchors.fill: parent
        anchors.margins: N.NeoConstants.spacingS
        spacing: N.NeoConstants.spacingS

        Repeater {
            model: 5
            delegate: Rectangle {
                Layout.fillHeight: true
                Layout.preferredWidth: 120
                color: N.NeoConstants.surface
                border.color: N.NeoConstants.primary
                border.width: index < frames.length ? 2 : 1
                opacity: index < frames.length ? 1.0 : 0.3
                radius: 6

                Image {
                    anchors.fill: parent
                    anchors.margins: 4
                    source: index < frames.length ? "file:" + frames[index] : ""
                    fillMode: Image.PreserveAspectCrop
                    cache: false
                }

                Text {
                    anchors.bottom: parent.bottom
                    anchors.right: parent.right
                    anchors.margins: 4
                    text: index < frames.length ? "F" + (frames.length - 5 + index + 1).toString() : ""
                    color: "white"
                    font.pixelSize: 14
                    style: Text.Outline
                    styleColor: "black"
                }
            }
        }
    }

    Connections {
        target: appController
        function onLatestFramesChanged(f) { frames = f }
    }
}
```

- [ ] **Step 3: Add ThumbnailStrip to CapturePage**

In `pages/CapturePage.qml`, after HintBar:
```qml
        Components.ThumbnailStrip {
            Layout.fillWidth: true
            Layout.preferredHeight: 100
        }
```

- [ ] **Step 4: Tạo `components/TitleInputDialog.qml`**

```qml
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N

Popup {
    id: root
    modal: true
    closePolicy: Popup.NoAutoClose
    width: 600
    height: 320
    anchors.centerIn: Overlay.overlay

    signal accepted(string title)

    background: Rectangle {
        color: N.NeoConstants.surface
        border.color: N.NeoConstants.primary
        border.width: 3
        radius: 16
    }

    contentItem: ColumnLayout {
        spacing: N.NeoConstants.spacingL

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: "Đặt tên cho phim của con!"
            font.pixelSize: N.NeoConstants.fontTitle
            color: N.NeoConstants.primary
        }

        TextField {
            id: input
            Layout.fillWidth: true
            Layout.preferredHeight: 60
            font.pixelSize: N.NeoConstants.fontBody
            placeholderText: "VD: Robot bay vào vũ trụ"
            inputMethodHints: Qt.ImhNoPredictiveText
        }

        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: N.NeoConstants.spacingM

            Button {
                Layout.preferredHeight: N.NeoConstants.buttonHeight
                Layout.preferredWidth: 160
                text: "Bỏ qua"
                onClicked: { root.accepted(""); root.close() }
            }
            Button {
                Layout.preferredHeight: N.NeoConstants.buttonHeight
                Layout.preferredWidth: 160
                text: "Tạo phim!"
                highlighted: true
                onClicked: { root.accepted(input.text); root.close() }
            }
        }
    }
}
```

- [ ] **Step 5: Wire title before export in CapturePage**

```qml
    Components.TitleInputDialog {
        id: titleDialog
        onAccepted: function(title) {
            appController.set_title(title)
            appController.start_export_now()
        }
    }

    function askTitleAndExport() {
        titleDialog.open()
    }
```

- [ ] **Step 6: AppController — split EXPORT flow**

```python
@pyqtSlot(str)
def set_title(self, title: str) -> None:
    self._session.frame_manager.set_title(title)

@pyqtSlot()
def start_export_now(self) -> None:
    self._export_service.start_export(self._session.frame_manager)

requestTitleInput = pyqtSignal()

def _do_export(self) -> None:
    fm = self._session.frame_manager
    if fm.frame_count < self._min_frames:
        self._bus.status_message.emit("warning", f"Cần ít nhất {self._min_frames} frame!")
        return
    if self._ask_title:
        self.requestTitleInput.emit()
    else:
        self.start_export_now()
```

Init `_ask_title` from settings.

- [ ] **Step 7: Wire `requestTitleInput` in MainWindow.qml**

```qml
    Connections {
        target: appController
        function onRequestTitleInput() {
            if (stack.currentItem && stack.currentItem.askTitleAndExport) {
                stack.currentItem.askTitleAndExport()
            } else {
                appController.start_export_now()
            }
        }
    }
```

- [ ] **Step 8: Smoke test full v1.0 flow**

```bash
NEO_STOPMOTION_UART=simulator python -m neo_stopmotion
# Splash → Capture → Space×8 (countdown 3s + tách) → ThumbnailStrip hiện 5 frame cuối
# Z → undo → strip update
# Enter → TitleInputDialog → gõ "Robot bay" → Tạo phim
# ExportingPage progress → SuccessPage video loop + QR
# Quét QR → tải MP4
# "Quay lại" → CapturePage frame=0
```

- [ ] **Step 9: Commit**

```bash
git add src/neo_stopmotion/ui/qml/components/ThumbnailStrip.qml src/neo_stopmotion/ui/qml/components/TitleInputDialog.qml src/neo_stopmotion/ui/qml/pages/CapturePage.qml src/neo_stopmotion/services/app_controller.py src/neo_stopmotion/ui/qml/MainWindow.qml
git commit -m "feat(ui): F-12 ThumbnailStrip + F-13 TitleInputDialog"
```

**Epic 5 demo criteria**: full flow MUST + SHOULD chạy mượt trên macOS, audio + thumbnail + countdown + title input đều hoạt động, QR scan tải MP4 thành công.

---

# Epic 6 — Deploy & Pilot (2 ngày, 4 tasks)

## Task T6.1: install-armbian.sh + ARM deps

**Files:**
- Create: `deployment/install-armbian.sh`
- Create: `deployment/requirements-arm64.txt`

- [ ] **Step 1: Tạo `deployment/install-armbian.sh`** (đơn giản hóa từ NEOSTEM install-armbian.sh)

```bash
#!/usr/bin/env bash
# Install NeoStopMotion on Armbian/Ubuntu ARM64 (NEO One)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/neostopmotion}"
USER_NAME="${USER_NAME:-maker}"
PROJECTS_DIR="/home/${USER_NAME}/projects"

echo "==> Updating apt"
sudo apt-get update

echo "==> Installing system dependencies"
sudo apt-get install -y \
    python3.10 python3.10-venv python3-pip \
    libopencv-dev python3-opencv \
    ffmpeg \
    qt6-base-dev qt6-declarative-dev qt6-multimedia-dev \
    qml6-module-qtquick qml6-module-qtquick-controls \
    qml6-module-qtquick-layouts qml6-module-qtquick-window \
    qml6-module-qtmultimedia \
    libqt6sql6-sqlite \
    fonts-noto-color-emoji \
    git

echo "==> Cloning repository to ${INSTALL_DIR}"
sudo mkdir -p "${INSTALL_DIR}"
sudo chown "${USER_NAME}:${USER_NAME}" "${INSTALL_DIR}"
if [ ! -d "${INSTALL_DIR}/.git" ]; then
    git clone https://github.com/makerviet/neostopmotion.git "${INSTALL_DIR}"
else
    cd "${INSTALL_DIR}" && git pull
fi

echo "==> Setting up Python venv"
cd "${INSTALL_DIR}"
python3.10 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r deployment/requirements-arm64.txt
.venv/bin/pip install -e .

echo "==> Creating projects directory"
sudo mkdir -p "${PROJECTS_DIR}"
sudo chown "${USER_NAME}:${USER_NAME}" "${PROJECTS_DIR}"

echo "==> Configuring user config"
sudo -u "${USER_NAME}" mkdir -p "/home/${USER_NAME}/.config/neostopmotion"
cat <<EOF | sudo tee "/home/${USER_NAME}/.config/neostopmotion/config.toml"
[storage]
projects_dir = "${PROJECTS_DIR}"

[ui]
fullscreen = true
EOF
sudo chown "${USER_NAME}:${USER_NAME}" "/home/${USER_NAME}/.config/neostopmotion/config.toml"

echo "==> Done. Run with: ${INSTALL_DIR}/.venv/bin/python -m neo_stopmotion"
```

- [ ] **Step 2: Tạo `deployment/requirements-arm64.txt`**

```
PyQt6==6.6.1
PyQt6-Qt6==6.6.1
opencv-python-headless==4.8.1.78
numpy==1.26.2
pyserial==3.5
qrcode[pil]==7.4.2
Pillow==10.1.0
loguru==0.7.2
tomli==2.0.1
```

- [ ] **Step 3: Make executable + commit**

```bash
chmod +x deployment/install-armbian.sh
git add deployment/install-armbian.sh deployment/requirements-arm64.txt
git commit -m "deploy: install-armbian.sh + ARM64 requirements"
```

---

## Task T6.2: systemd service + udev rule + kiosk mode

**Files:**
- Create: `deployment/neostopmotion.service`
- Create: `deployment/udev/99-thingbot.rules`

- [ ] **Step 1: Tạo `deployment/neostopmotion.service`**

```ini
[Unit]
Description=NeoStopMotion Kiosk
After=multi-user.target

[Service]
Type=simple
User=maker
Environment="QT_QPA_PLATFORM=eglfs"
Environment="QSG_RENDER_LOOP=basic"
Environment="QT_QUICK_BACKEND=software"
WorkingDirectory=/opt/neostopmotion
ExecStart=/opt/neostopmotion/.venv/bin/python -m neo_stopmotion
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Tạo `deployment/udev/99-thingbot.rules`**

```
# ThingBot — Arduino Uno (CH340 hoặc FTDI)
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", SYMLINK+="thingbot", MODE="0666"
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6001", SYMLINK+="thingbot", MODE="0666"
# ESP32 — Silicon Labs CP210x
SUBSYSTEM=="tty", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", SYMLINK+="thingbot", MODE="0666"
```

- [ ] **Step 3: Update install script — append**

Append to `install-armbian.sh`:
```bash
echo "==> Installing systemd service"
sudo cp deployment/neostopmotion.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable neostopmotion.service

echo "==> Installing udev rule for ThingBot"
sudo cp deployment/udev/99-thingbot.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo usermod -aG dialout "${USER_NAME}"

echo "==> All done. Reboot and the app will start at boot."
echo "    Manual start: sudo systemctl start neostopmotion"
echo "    Logs:         journalctl -u neostopmotion -f"
```

- [ ] **Step 4: Update default UART port to use /dev/thingbot**

Add to `defaults.toml` comment:
```toml
[uart]
# Recommended: udev creates /dev/thingbot symlink (see deployment/udev/)
# port = "/dev/thingbot"
port = "auto"
```

- [ ] **Step 5: Commit**

```bash
git add deployment/
git commit -m "deploy: systemd service + udev /dev/thingbot symlink"
```

---

## Task T6.3: Smoke test on real NEO One

This is a manual ops task — no new code, but it validates the deploy.

- [ ] **Step 1: Provision NEO One (1× device)**

```bash
# On NEO One (ssh from laptop)
ssh maker@neo-one.local
git clone https://github.com/makerviet/neostopmotion.git /tmp/neo-clone
cd /tmp/neo-clone
sudo bash deployment/install-armbian.sh
sudo reboot
```

- [ ] **Step 2: After reboot, app must auto-start fullscreen**

```bash
ssh maker@neo-one.local
journalctl -u neostopmotion -n 100 --no-pager
# Look for: "Starting NeoStopMotion v1.0.0", "Webcam opened", "ThingBot detected on /dev/thingbot"
```

- [ ] **Step 3: Run e2e test 10 sessions back-to-back**

`tests/e2e/test_full_session.py` (run on dev machine pointed at NEO One via SSH manually, or scripted):
```python
# This test is manual/checklist-style — use the following procedure:
#
# For i in 1..10:
#   1. Press button 20 times → expect frame counter 20
#   2. Hold 1.5s → counter 19
#   3. Hold 3.5s → ExportingPage → SuccessPage within 12s
#   4. Verify ~/projects/session_*/output.mp4 exists and plays
#   5. Click "Quay lại" → CapturePage with frame=0
#
# Pass criteria: 10/10 complete without crash, < 12s export each.
```

- [ ] **Step 4: Performance check**

```bash
# On NEO One
top -p $(pgrep -f neo_stopmotion)
# Expected: ~25-40% CPU during preview, < 200MB RAM
```

- [ ] **Step 5: Document findings in `DOC/SMOKE_TEST_REPORT.md`**

Tạo file mới với template:
```markdown
# Smoke Test Report — Tuần 3

| Metric | Target | Actual | Pass? |
|---|---|---|---|
| Boot time | <10s | ___s | ☐ |
| Preview FPS | ≥25 | ___ | ☐ |
| Export 30 frames MP4 | <8s | ___s | ☐ |
| RAM usage | <200MB | ___ | ☐ |
| Crash-free 10 sessions | 100% | ___% | ☐ |

Notes / bugs found: ...
```

- [ ] **Step 6: Commit findings**

```bash
git add DOC/SMOKE_TEST_REPORT.md
git commit -m "docs: smoke test report on NEO One"
```

---

## Task T6.4: Pilot with 10 students

Manual ops task — collect feedback for v1.1.

- [ ] **Step 1: Schedule pilot session at 1 Làng Maker FPT Shop**

- [ ] **Step 2: Prepare materials (per spec Phụ lục A)**
  - Hộp A vật liệu cho HS 6-9 tuổi
  - Hộp B vật liệu cho HS 10-14 tuổi
  - Storyboard giấy 4 ô
  - Stamp Thẻ Hành Trình

- [ ] **Step 3: Run 10 sessions, observe**

For each HS, log:
- Tên + tuổi
- Số frame chụp
- Thời gian từ bắt đầu đến export
- Bug encountered (nếu có)
- HS vui không (1-5 stars)
- PH tải MP4 thành công không

- [ ] **Step 4: Aggregate findings to `DOC/PILOT_REPORT.md`**

```markdown
# Pilot Report — 10 HS đầu tiên

| HS | Tuổi | Frames | Time | Bug | Rating | PH download? |
|---|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... | ... |
...

## Bug list (priority)

- P0: ...
- P1: ...
- P2: ...

## v1.1 backlog
- ...
```

- [ ] **Step 5: Commit pilot report**

```bash
git add DOC/PILOT_REPORT.md
git commit -m "docs: pilot report from 10 HS at FPT Shop"
```

**Epic 6 demo criteria**: 10/10 HS hoàn thành flow trong 30 phút, ≥80% nhận MP4 về điện thoại, không crash app.

---

# Tổng kết

- 28 tasks, 6 epics, ~3 tuần với team 1 BE + 1 UI + 1 firmware.
- Tất cả tasks tuân thủ TDD: failing test → minimal impl → passing test → commit.
- Mỗi task tạo 1 commit có message rõ ràng.
- Sau Epic 6: NeoStopMotion v1.0 sẵn sàng triển khai 3 Làng Maker pilot (Phase 2 spec).

**Deliverable cuối:**
- `/opt/neostopmotion/` cài trên NEO One
- systemd auto-start kiosk
- 1 ThingBot board mẫu flash xong
- Documentation: `DOC/{ARCHITECTURE,IMPLEMENTATION_PLAN,SMOKE_TEST_REPORT,PILOT_REPORT,HARDWARE,DEPLOY_NEO_ONE,TEACHER_MANUAL,PROTOCOL}.md`
- Repository public GitHub BBStopMotion với MIT license

---

**HẾT IMPLEMENTATION PLAN v1.0**
