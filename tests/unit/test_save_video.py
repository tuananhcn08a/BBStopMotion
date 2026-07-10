"""Tests for T-007: Save Video feature.

Spec ref:  docs/01-specs/features/save-video/spec.md
Design:    docs/01-specs/features/save-video/design-spec.md

P0 scenarios:
TS-01 (P0): Happy path — file copied to dest, save_video_result(True, path) emitted
TS-02 (P0): Source file not modified after copy
TS-03 (P1): mp4Path empty → save rejected (not tested here, UI concern)
TS-04 (P1): Dest dir missing → error emitted
TS-05 (P1): No write permission → error emitted
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from neo_stopmotion.services.video_saver import VideoSaver

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_mp4(tmp_path) -> Path:
    """Create a fake MP4 file (just bytes, no real video)."""
    src = tmp_path / "session" / "output.mp4"
    src.parent.mkdir(parents=True)
    src.write_bytes(b"\x00\x01\x02\x03" * 256)  # 1 KB of fake data
    return src


@pytest.fixture
def dest_dir(tmp_path) -> Path:
    d = tmp_path / "dest"
    d.mkdir()
    return d


# ---------------------------------------------------------------------------
# TS-01  Happy path
# ---------------------------------------------------------------------------


def test_ts01_save_video_happy_path(sample_mp4, dest_dir):
    """TS-01 (P0): copy mp4 to dest_dir → True + dest path in result."""
    from neo_stopmotion.utils.signal_bus import SignalBus
    bus = SignalBus.instance()
    results = []
    bus.save_video_result.connect(lambda ok, msg: results.append((ok, msg)))

    saver = VideoSaver()
    saver.save(mp4_path=str(sample_mp4), dest_dir=str(dest_dir))

    assert len(results) == 1
    ok, msg = results[0]
    assert ok is True
    dest_file = dest_dir / "output.mp4"
    assert dest_file.exists()
    assert str(dest_file) in msg


# ---------------------------------------------------------------------------
# TS-02  Source file not modified
# ---------------------------------------------------------------------------


def test_ts02_source_not_modified(sample_mp4, dest_dir):
    """TS-02 (P0): source file remains intact after copy."""
    original_size = sample_mp4.stat().st_size
    original_content = sample_mp4.read_bytes()

    saver = VideoSaver()
    saver.save(mp4_path=str(sample_mp4), dest_dir=str(dest_dir))

    assert sample_mp4.exists()
    assert sample_mp4.stat().st_size == original_size
    assert sample_mp4.read_bytes() == original_content


# ---------------------------------------------------------------------------
# TS-04  Destination directory missing / inaccessible
# ---------------------------------------------------------------------------


def test_ts04_dest_dir_missing_emits_error(sample_mp4, tmp_path):
    """TS-04 (P1): non-existent dest dir → error result."""
    from neo_stopmotion.utils.signal_bus import SignalBus
    bus = SignalBus.instance()
    results = []
    bus.save_video_result.connect(lambda ok, msg: results.append((ok, msg)))

    missing_dir = tmp_path / "does_not_exist" / "sub"
    saver = VideoSaver()
    saver.save(mp4_path=str(sample_mp4), dest_dir=str(missing_dir))

    assert len(results) == 1
    ok, msg = results[0]
    assert ok is False
    assert len(msg) > 0  # error message present


# ---------------------------------------------------------------------------
# TS-05  Source file does not exist
# ---------------------------------------------------------------------------


def test_ts05_source_missing_emits_error(dest_dir, tmp_path):
    """Source file missing → error result, no crash."""
    from neo_stopmotion.utils.signal_bus import SignalBus
    bus = SignalBus.instance()
    results = []
    bus.save_video_result.connect(lambda ok, msg: results.append((ok, msg)))

    nonexistent = tmp_path / "no_such_file.mp4"
    saver = VideoSaver()
    saver.save(mp4_path=str(nonexistent), dest_dir=str(dest_dir))

    assert len(results) == 1
    ok, _ = results[0]
    assert ok is False


# ---------------------------------------------------------------------------
# TS-06  Copy link to clipboard (clipboard tested via stub)
# ---------------------------------------------------------------------------


def test_ts06_copy_link_happy_path():
    """TS-06 (P1): copy_link writes to clipboard and signals success."""
    from neo_stopmotion.services.video_saver import VideoSaver
    from neo_stopmotion.utils.signal_bus import SignalBus

    bus = SignalBus.instance()
    results = []
    bus.save_video_result.connect(lambda ok, msg: results.append((ok, msg)))

    saver = VideoSaver()
    clipboard_received = []

    with patch("neo_stopmotion.services.video_saver.VideoSaver._set_clipboard") as mock_cb:
        mock_cb.side_effect = lambda text: clipboard_received.append(text)
        saver.copy_link("https://files.catbox.moe/abc123.mp4")

    assert clipboard_received == ["https://files.catbox.moe/abc123.mp4"]
    # Should also emit a success result
    assert any(ok for ok, _ in results)


# ---------------------------------------------------------------------------
# TS-07  copy_link hidden when no shareUrl
# ---------------------------------------------------------------------------


def test_ts07_copy_link_empty_url_is_noop():
    """TS-07 (P1): copy_link with empty URL does nothing / no error."""
    from neo_stopmotion.services.video_saver import VideoSaver
    from neo_stopmotion.utils.signal_bus import SignalBus

    bus = SignalBus.instance()
    results = []
    bus.save_video_result.connect(lambda ok, msg: results.append((ok, msg)))

    saver = VideoSaver()
    with patch("neo_stopmotion.services.video_saver.VideoSaver._set_clipboard") as mock_cb:
        saver.copy_link("")
    mock_cb.assert_not_called()
    # No result emitted for empty URL
    assert len(results) == 0


# ---------------------------------------------------------------------------
# Copy is idempotent — can save twice to different dirs
# ---------------------------------------------------------------------------


def test_save_twice_to_different_dirs(sample_mp4, tmp_path):
    """Can call save() multiple times to save to different locations."""
    from neo_stopmotion.utils.signal_bus import SignalBus

    bus = SignalBus.instance()
    results = []
    bus.save_video_result.connect(lambda ok, msg: results.append((ok, msg)))

    dir_a = tmp_path / "a"
    dir_a.mkdir()
    dir_b = tmp_path / "b"
    dir_b.mkdir()

    saver = VideoSaver()
    saver.save(mp4_path=str(sample_mp4), dest_dir=str(dir_a))
    saver.save(mp4_path=str(sample_mp4), dest_dir=str(dir_b))

    assert (dir_a / "output.mp4").exists()
    assert (dir_b / "output.mp4").exists()
    assert results[0][0] is True
    assert results[1][0] is True


# ---------------------------------------------------------------------------
# AppController integration: save_video slot
# ---------------------------------------------------------------------------


def test_app_controller_save_video_slot(sample_mp4, dest_dir, qtbot):
    """AppController.save_video(mp4_path, dest_dir) delegates to VideoSaver.

    save_video() emits save_video_result from a plain background
    threading.Thread (see app_controller.py:save_video). With the real Qt
    event loop, a cross-thread signal emission to a QObject uses a queued
    connection that only gets delivered once something pumps the receiving
    thread's event queue — a bare `time.sleep()` poll loop never does that
    and the assertion would hang/fail waiting forever. `qtbot.waitUntil`
    polls the condition while also calling `QCoreApplication.processEvents()`
    each iteration, which is what actually drains the queued connection.
    """
    from neo_stopmotion.services.app_controller import AppController
    from neo_stopmotion.utils.signal_bus import SignalBus

    bus = SignalBus.instance()
    results = []
    bus.save_video_result.connect(lambda ok, msg: results.append((ok, msg)))

    mock_capture = MagicMock()
    mock_session = MagicMock()

    ctrl = AppController(
        capture=mock_capture,
        session=mock_session,
    )
    ctrl.save_video(str(sample_mp4), str(dest_dir))

    qtbot.waitUntil(lambda: len(results) >= 1, timeout=2000)

    assert len(results) >= 1
    ok, msg = results[0]
    assert ok is True
    assert (dest_dir / "output.mp4").exists()
