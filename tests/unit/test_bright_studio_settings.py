"""Tests for T-BS30: Bright Studio redesign — Settings screen (F2/F3/F4/F8).

Spec ref: docs/01-specs/features/neo-stopmotion/bright-studio-redesign/spec.md
Test scenarios covered here (subset relevant to app-layer/persistence, no QML):
    TS-BS-05/06/07 (F2 goalFrames)      TS-BS-08/09    (F3 onionSkinOpacity)
    TS-BS-11/12/13 (F4 language)        TS-BS-27       (F8 persist across restart)
    TS-BS-22       (F7 retry_upload)
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pytest

from neo_stopmotion.config.settings import AppSettings, load_settings, save_settings
from neo_stopmotion.services.app_controller import AppController
from neo_stopmotion.services.library_service import LibraryEntry
from neo_stopmotion.services.speed_selector import SpeedSelector


# ---------------------------------------------------------------------------
# config.settings — save_settings() persistence (F8, TS-BS-27)
# ---------------------------------------------------------------------------


def test_save_settings_round_trip(tmp_path):
    """save_settings() writes a TOML that load_settings() reads back identically."""
    path = tmp_path / "config.toml"
    settings = AppSettings()
    settings.export.goal_frames = 50
    settings.capture.onion_opacity = 0.7
    settings.app.language = "en"
    settings.ui.sound_enabled = False
    settings.upload.auto_upload = False
    settings.capture.default_fps_level = "Nhanh"

    save_settings(settings, path)
    assert path.exists()

    reloaded = load_settings(user_config_path=path)
    assert reloaded.export.goal_frames == 50
    assert reloaded.capture.onion_opacity == pytest.approx(0.7)
    assert reloaded.app.language == "en"
    assert reloaded.ui.sound_enabled is False
    assert reloaded.upload.auto_upload is False
    assert reloaded.capture.default_fps_level == "Nhanh"


def test_save_settings_creates_parent_dirs(tmp_path):
    path = tmp_path / "nested" / "dir" / "config.toml"
    save_settings(AppSettings(), path)
    assert path.exists()


def test_defaults_match_bright_studio_redesign():
    """F3/F4 defaults changed by the redesign — GHI ĐÈ giá trị cũ (0.30 → 0.40, 'vi' → 'vi+en')."""
    s = load_settings()
    assert s.capture.onion_opacity == pytest.approx(0.40)
    assert s.app.language == "vi+en"
    assert s.export.goal_frames == 30
    assert s.upload.auto_upload is True
    assert s.capture.default_fps_level == "Vua"


# ---------------------------------------------------------------------------
# SpeedSelector — configurable default (F8 "Tốc độ mặc định")
# ---------------------------------------------------------------------------


def test_speed_selector_custom_default_label():
    sel = SpeedSelector(default_label="Nhanh")
    assert sel.selected_label == "Nhanh"
    assert sel.selected_fps == 12


def test_speed_selector_invalid_default_falls_back():
    sel = SpeedSelector(default_label="not-a-label")
    assert sel.selected_label == "Vua"


def test_speed_selector_set_default_label_changes_future_reset():
    sel = SpeedSelector()
    sel.select("Nhanh")
    assert sel.selected_label == "Nhanh"
    sel.set_default_label("Cham")
    sel.reset()
    assert sel.selected_label == "Cham"


def test_speed_selector_set_default_label_invalid_raises():
    sel = SpeedSelector()
    with pytest.raises(ValueError):
        sel.set_default_label("nope")


# ---------------------------------------------------------------------------
# AppController — Settings properties/slots (F2/F3/F4/F8)
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_capture():
    cap = MagicMock()
    cap.capture_frame.return_value = np.full((720, 1280, 3), 100, dtype=np.uint8)
    cap.onion_opacity = 0.40
    return cap


@pytest.fixture
def mock_session(tmp_path):
    from neo_stopmotion.services.session_service import SessionService
    return SessionService(projects_dir=tmp_path, fps_playback=10)


def test_goal_frames_persists_and_applies_immediately(mock_capture, mock_session, tmp_path):
    settings = AppSettings()
    settings_path = tmp_path / "config.toml"
    ctrl = AppController(capture=mock_capture, session=mock_session,
                          settings=settings, settings_path=settings_path)
    assert ctrl.goalFrames == 30  # TS-BS-05 default

    ctrl.set_goal_frames(10)
    assert ctrl.goalFrames == 10  # TS-BS-06: applies immediately
    assert settings.export.goal_frames == 10
    assert settings_path.exists()  # TS-BS-27: persisted


def test_onion_skin_opacity_applies_live_and_persists(mock_capture, mock_session, tmp_path):
    settings = AppSettings()
    settings_path = tmp_path / "config.toml"
    ctrl = AppController(capture=mock_capture, session=mock_session,
                          settings=settings, settings_path=settings_path)

    ctrl.set_onion_skin_opacity(0.7)
    assert ctrl.onionSkinOpacity == pytest.approx(0.7)  # TS-BS-09
    assert mock_capture.onion_opacity == pytest.approx(0.7)  # applies to live capture
    assert settings.capture.onion_opacity == pytest.approx(0.7)


def test_onion_skin_opacity_clamped_0_1(mock_capture, mock_session):
    ctrl = AppController(capture=mock_capture, session=mock_session)
    ctrl.set_onion_skin_opacity(5.0)
    assert ctrl.onionSkinOpacity == 1.0
    ctrl.set_onion_skin_opacity(-1.0)
    assert ctrl.onionSkinOpacity == 0.0


def test_set_live_onion_opacity_does_not_persist(mock_capture, mock_session, tmp_path):
    """F1 onion toggle at 2a must NOT overwrite the persisted Settings value."""
    settings = AppSettings()
    settings.capture.onion_opacity = 0.4
    settings_path = tmp_path / "config.toml"
    ctrl = AppController(capture=mock_capture, session=mock_session,
                          settings=settings, settings_path=settings_path)

    ctrl.set_live_onion_opacity(0.0)  # toggle OFF at 2a
    assert mock_capture.onion_opacity == 0.0  # live view updated
    assert settings.capture.onion_opacity == pytest.approx(0.4)  # config untouched
    assert ctrl.onionSkinOpacity == pytest.approx(0.4)  # persisted property unchanged
    assert not settings_path.exists()  # nothing written to disk


def test_language_setter_validates_and_persists(mock_capture, mock_session, tmp_path):
    settings = AppSettings()
    settings_path = tmp_path / "config.toml"
    ctrl = AppController(capture=mock_capture, session=mock_session,
                          settings=settings, settings_path=settings_path)

    ctrl.set_language("en")
    assert ctrl.language == "en"  # TS-BS-11
    assert settings.app.language == "en"

    ctrl.set_language("not-a-lang")  # invalid — ignored
    assert ctrl.language == "en"


def test_sound_enabled_and_auto_upload_toggle(mock_capture, mock_session):
    ctrl = AppController(capture=mock_capture, session=mock_session)
    assert ctrl.soundEnabled is True
    ctrl.set_sound_enabled(False)
    assert ctrl.soundEnabled is False

    assert ctrl.autoUpload is True
    ctrl.set_auto_upload(False)
    assert ctrl.autoUpload is False


def test_default_fps_level_updates_speed_selector(mock_capture, mock_session):
    ctrl = AppController(capture=mock_capture, session=mock_session)
    assert ctrl.defaultFpsLevel == "Vua"
    ctrl.set_default_fps_level("Nhanh")
    assert ctrl.defaultFpsLevel == "Nhanh"
    ctrl.speed_selector.select("Cham")
    ctrl.reset_session()
    assert ctrl.speed_selector.selected_label == "Nhanh"  # F8: reset() uses new default


def test_retry_upload_missing_file_emits_empty_result(mock_capture, mock_session, tmp_path):
    from neo_stopmotion.utils.signal_bus import SignalBus
    ctrl = AppController(capture=mock_capture, session=mock_session)
    bus = SignalBus.instance()
    received = []
    bus.share_url_ready.connect(lambda url, qr: received.append((url, qr)))

    ctrl.retry_upload(str(tmp_path / "does-not-exist.mp4"))
    assert received == [("", "")]


# ---------------------------------------------------------------------------
# LibraryEntry.to_qml_dict — created_at ISO field (F7 filter Hôm nay/Tuần này)
# ---------------------------------------------------------------------------


def test_to_qml_dict_includes_iso_created_at():
    entry = LibraryEntry(
        session_id="x",
        session_dir=Path("/tmp"),
        title="Phim test",
        created_at=datetime(2026, 7, 10, 14, 20),
        frame_count=10,
        fps_playback=8,
        duration_seconds=1.25,
        mp4_path=None,
        gif_path=None,
        qr_path=None,
        download_url=None,
        thumbnail_path=None,
    )
    d = entry.to_qml_dict()
    assert d["created_at"] == "2026-07-10T14:20:00"
