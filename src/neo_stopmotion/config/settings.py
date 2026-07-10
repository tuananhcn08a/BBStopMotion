from __future__ import annotations
import os
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib


DEFAULTS_PATH = Path(__file__).parent / "defaults.toml"

#: Default location for the *user override* config file (also the persistence
#: target for Settings screen changes — T-BS30).
DEFAULT_USER_CONFIG_PATH = Path.home() / ".config" / "neostopmotion" / "config.toml"


@dataclass
class AppCfg:
    name: str = "NeoStopMotion"
    version: str = "1.0.0"
    # F4 (Bright Studio redesign): 'vi+en' | 'vi' | 'en' — mặc định song ngữ
    language: str = "vi+en"
    debug: bool = False


@dataclass
class CaptureCfg:
    webcam_index: int = 0
    resolution_width: int = 1280
    resolution_height: int = 720
    preview_fps: int = 30
    # F3 (Bright Studio redesign): mặc định đổi 0.30 → 0.40, GHI ĐÈ giá trị cũ.
    onion_opacity: float = 0.40
    auto_retry_count: int = 3
    # F8: tốc độ mặc định khi bắt đầu phiên mới — "Cham" | "Vua" | "Nhanh"
    default_fps_level: str = "Vua"


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
    # F2: mục tiêu số frame gợi ý (Card Tiến độ sidebar) — không giới hạn chụp thêm.
    goal_frames: int = 30


@dataclass
class StorageCfg:
    projects_dir: str = "~/projects"
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
    font_family: str = "Plus Jakarta Sans"
    sound_enabled: bool = True
    flash_on_capture: bool = True
    show_countdown: bool = True
    show_thumbnail_strip: bool = True
    ask_title_before_export: bool = True


@dataclass
class UploadCfg:
    # F8: "Tải lên cloud tự động" — tắt thì 2b bỏ giai đoạn upload/QR (Q6b).
    auto_upload: bool = True


@dataclass
class AppSettings:
    app: AppCfg = field(default_factory=AppCfg)
    capture: CaptureCfg = field(default_factory=CaptureCfg)
    uart: UartCfg = field(default_factory=UartCfg)
    export: ExportCfg = field(default_factory=ExportCfg)
    storage: StorageCfg = field(default_factory=StorageCfg)
    server: ServerCfg = field(default_factory=ServerCfg)
    ui: UiCfg = field(default_factory=UiCfg)
    upload: UploadCfg = field(default_factory=UploadCfg)


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
        if DEFAULT_USER_CONFIG_PATH.exists():
            data = _merge(data, _read_toml(DEFAULT_USER_CONFIG_PATH))
    data = _apply_env(data)
    return AppSettings(
        app=AppCfg(**data.get("app", {})),
        capture=CaptureCfg(**data.get("capture", {})),
        uart=UartCfg(**data.get("uart", {})),
        export=ExportCfg(**data.get("export", {})),
        storage=StorageCfg(**data.get("storage", {})),
        server=ServerCfg(**data.get("server", {})),
        ui=UiCfg(**data.get("ui", {})),
        upload=UploadCfg(**data.get("upload", {})),
    )


def _toml_scalar(value: Any) -> str:
    """Serialize a primitive (bool/int/float/str) as a TOML value literal.

    T-BS30: AppSettings only ever contains these primitive types (see the
    dataclasses above), so a hand-rolled serializer avoids adding a new
    tomli-w-style dependency just to persist the Settings screen (F8).
    """
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def save_settings(settings: AppSettings, path: Path | None = None) -> None:
    """Persist *settings* as the user-override TOML file (T-BS30, F8).

    Writes the *entire* AppSettings tree — the next load_settings() call
    merges this file on top of defaults.toml, so round-tripping is
    idempotent (every field is explicit, nothing is "reset").
    """
    target = path or DEFAULT_USER_CONFIG_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    data = asdict(settings)
    lines: list[str] = []
    for section, fields_dict in data.items():
        lines.append(f"[{section}]")
        for key, value in fields_dict.items():
            lines.append(f"{key} = {_toml_scalar(value)}")
        lines.append("")
    target.write_text("\n".join(lines), encoding="utf-8")
