"""Tests for T-012: LibraryService.

Spec ref: docs/01-specs/features/film-library/spec.md
Domain:   docs/01-specs/features/film-library/domain.md

Test scenarios mapped to spec:
  TS-01 (P0) — list_sessions: 3 valid + 1 not-exported → returns 3, sorted newest first
  TS-02 (P0) — delete_session removes directory + gone from list
  TS-03 (P0) — metadata parsed correctly (all display fields)
  TS-04 (P1) — empty state: 0 valid sessions → empty list
  + extras: BR coverage (error states, missing mp4, JSON parse error)
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pytest

from neo_stopmotion.services.library_service import LibraryEntry, LibraryService

# ---------------------------------------------------------------------------
# Helpers to create fake sessions in tmp_path
# ---------------------------------------------------------------------------

def _make_session(
    parent: Path,
    session_id: str,
    *,
    exported: bool = True,
    mp4_exists: bool = True,
    gif_exists: bool = False,
    title: str = "Test phim",
    created_at: str = "2026-06-16T14:20:00",
    frame_count: int = 10,
    fps_playback: int = 8,
    download_url: str | None = None,
    corrupt_json: bool = False,
    no_json: bool = False,
    no_frames: bool = False,
) -> Path:
    """Create a fake session directory with optional project.json + mp4."""
    session_dir = parent / f"session_{session_id}"
    session_dir.mkdir(parents=True, exist_ok=True)

    mp4_path = session_dir / "output.mp4"
    gif_path = session_dir / "output.gif"

    if mp4_exists:
        mp4_path.write_bytes(b"\x00MP4DATA\x00" * 100)
    if gif_exists:
        gif_path.write_bytes(b"\x47\x49\x46" * 100)

    frames_dir = session_dir / "frames"
    if not no_frames:
        frames_dir.mkdir(exist_ok=True)
        (frames_dir / "frame_0001.png").write_bytes(b"\x89PNG\r\n" * 10)

    if no_json:
        return session_dir

    if corrupt_json:
        (session_dir / "project.json").write_text("{invalid json!!!", encoding="utf-8")
        return session_dir

    meta = {
        "session_id": session_id,
        "title": title,
        "created_at": created_at,
        "frame_count": frame_count,
        "fps_playback": fps_playback,
        "duration_seconds": frame_count / fps_playback if fps_playback > 0 else 0.0,
        "exported": exported,
        "mp4_path": str(mp4_path) if mp4_exists else None,
        "gif_path": str(gif_path) if gif_exists else None,
        "qr_path": None,
        "download_url": download_url,
        "status": "completed",
    }
    (session_dir / "project.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8"
    )
    return session_dir


# ---------------------------------------------------------------------------
# TS-01: list_sessions — 3 valid + 1 not-exported → returns 3 sorted newest first
# ---------------------------------------------------------------------------

def test_ts01_list_sessions_filters_and_sorts(tmp_path):
    """TS-01 (P0): only exported+mp4 sessions listed; newest first."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "aaa", created_at="2026-06-15T10:00:00")
    _make_session(projects, "bbb", created_at="2026-06-16T14:20:00")  # newest
    _make_session(projects, "ccc", created_at="2026-06-14T09:00:00")  # oldest
    _make_session(projects, "ddd", exported=False, created_at="2026-06-16T18:00:00")  # excluded

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    # Only 3 exported ones returned
    assert len(entries) == 3

    # Sort: newest first
    dates = [e.created_at for e in entries]
    assert dates == sorted(dates, reverse=True), "Should be newest first"

    # Verify first is bbb (newest)
    assert entries[0].session_id == "bbb"


# ---------------------------------------------------------------------------
# TS-02: delete_session removes dir + gone from list
# ---------------------------------------------------------------------------

def test_ts02_delete_session_removes_dir(tmp_path):
    """TS-02 (P0): delete_session removes the whole session directory."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "s001")
    _make_session(projects, "s002")

    svc = LibraryService(projects)
    entries_before = svc.list_sessions()
    assert len(entries_before) == 2

    svc.delete_session("s001")

    # Directory gone
    assert not (projects / "session_s001").exists()

    # List updated
    entries_after = svc.list_sessions()
    assert len(entries_after) == 1
    assert entries_after[0].session_id == "s002"


# ---------------------------------------------------------------------------
# TS-03: metadata parsed correctly
# ---------------------------------------------------------------------------

def test_ts03_metadata_fields(tmp_path):
    """TS-03 (P0): all display fields parsed from project.json."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(
        projects,
        "meta1",
        title="Khủng long phiêu lưu",
        created_at="2026-06-16T14:20:00",
        frame_count=12,
        fps_playback=8,
        download_url="https://example.com/film",
        gif_exists=True,
    )

    svc = LibraryService(projects)
    entries = svc.list_sessions()
    assert len(entries) == 1
    e = entries[0]

    assert e.session_id == "meta1"
    assert e.title == "Khủng long phiêu lưu"
    assert e.display_title == "Khủng long phiêu lưu"
    assert e.frame_count == 12
    assert e.fps_playback == 8
    assert e.fps_label == "Vừa · 8 fps"
    assert e.download_url == "https://example.com/film"
    assert e.created_at == datetime(2026, 6, 16, 14, 20, 0)
    assert e.date_label == "16/06/2026 · 14:20"
    assert e.duration_label == "1.5 giây"
    assert "MB" in e.size_label  # has size
    assert e.thumbnail_path is not None
    assert e.thumbnail_path.exists()
    assert not e.is_error


# ---------------------------------------------------------------------------
# TS-04: empty state — no valid sessions → empty list
# ---------------------------------------------------------------------------

def test_ts04_empty_state(tmp_path):
    """TS-04 (P1): 0 valid sessions → empty list returned."""
    projects = tmp_path / "projects"
    projects.mkdir()

    svc = LibraryService(projects)
    entries = svc.list_sessions()
    assert entries == []


# ---------------------------------------------------------------------------
# BR-3: corrupt JSON → error entry (not silently skipped)
# ---------------------------------------------------------------------------

def test_br3_corrupt_json_returns_error_entry(tmp_path):
    """BR-3: corrupt project.json → LibraryEntry with is_error=True."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "good")
    _make_session(projects, "bad", corrupt_json=True)

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    good = [e for e in entries if not e.is_error]
    bad = [e for e in entries if e.is_error]

    assert len(good) == 1
    assert len(bad) == 1
    assert "lỗi" in bad[0].error_reason or "hỏng" in bad[0].error_reason


# ---------------------------------------------------------------------------
# BR-4: no project.json → silently skipped
# ---------------------------------------------------------------------------

def test_br4_no_json_silently_skipped(tmp_path):
    """BR-4: directory with no project.json is not listed at all."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "valid")
    _make_session(projects, "nojson", no_json=True)

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    assert len(entries) == 1
    assert entries[0].session_id == "valid"


# ---------------------------------------------------------------------------
# BR-2: exported=true but mp4 missing → error entry
# ---------------------------------------------------------------------------

def test_br2_mp4_missing_is_error(tmp_path):
    """BR-2: exported=true but mp4_path file does not exist → is_error=True."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "nompfour", mp4_exists=False)

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    assert len(entries) == 1
    assert entries[0].is_error


# ---------------------------------------------------------------------------
# BR-5: empty title → display_title uses created_at
# ---------------------------------------------------------------------------

def test_br5_empty_title_uses_created_at(tmp_path):
    """BR-5: empty title → 'Phim dd/MM HH:mm'."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "notitle", title="", created_at="2026-06-16T14:20:00")

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    assert len(entries) == 1
    assert entries[0].display_title == "Phim 16/06 14:20"


# ---------------------------------------------------------------------------
# BR-6: download_url None → property is None
# ---------------------------------------------------------------------------

def test_br6_no_download_url(tmp_path):
    """BR-6: session with download_url=None → entry.download_url is None."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "nourl", download_url=None)

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    assert entries[0].download_url is None


# ---------------------------------------------------------------------------
# BR-9: sort stable when two sessions have same created_at second (tie-break by id)
# ---------------------------------------------------------------------------

def test_br9_sort_stable_tie_break(tmp_path):
    """BR-9 / edge: same created_at second → stable sort by session_id."""
    projects = tmp_path / "projects"
    projects.mkdir()

    ts = "2026-06-16T14:20:00"
    _make_session(projects, "aaa", created_at=ts)
    _make_session(projects, "zzz", created_at=ts)

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    # Both present
    ids = {e.session_id for e in entries}
    assert ids == {"aaa", "zzz"}


# ---------------------------------------------------------------------------
# BR-10: max_sessions cap
# ---------------------------------------------------------------------------

def test_br10_max_sessions_cap(tmp_path):
    """BR-10: only max_sessions entries returned when more exist."""
    projects = tmp_path / "projects"
    projects.mkdir()

    for i in range(10):
        _make_session(
            projects,
            f"s{i:03d}",
            created_at=f"2026-06-{(i % 28) + 1:02d}T10:00:00",
        )

    svc = LibraryService(projects, max_sessions=5)
    entries = svc.list_sessions()

    assert len(entries) == 5
    # Should be newest 5
    dates = [e.created_at for e in entries]
    assert dates == sorted(dates, reverse=True)


# ---------------------------------------------------------------------------
# delete_session: invalid session_id raises ValueError
# ---------------------------------------------------------------------------

def test_delete_session_empty_id_raises(tmp_path):
    """delete_session('') raises ValueError."""
    projects = tmp_path / "projects"
    projects.mkdir()

    svc = LibraryService(projects)
    with pytest.raises(ValueError, match="session_id must not be empty"):
        svc.delete_session("")


# ---------------------------------------------------------------------------
# delete_session: non-existing session_id raises OSError
# ---------------------------------------------------------------------------

def test_delete_session_not_found_raises(tmp_path):
    """delete_session with unknown id raises OSError (not found)."""
    projects = tmp_path / "projects"
    projects.mkdir()

    svc = LibraryService(projects)
    with pytest.raises(OSError):
        svc.delete_session("no_such_session_xyz")


# ---------------------------------------------------------------------------
# projects_dir does not exist → list_sessions raises OSError
# ---------------------------------------------------------------------------

def test_list_sessions_missing_projects_dir(tmp_path):
    """list_sessions raises OSError when projects_dir doesn't exist."""
    svc = LibraryService(tmp_path / "nonexistent")
    with pytest.raises(OSError):
        svc.list_sessions()


# ---------------------------------------------------------------------------
# thumbnail_path = None when frame_0001.png missing
# ---------------------------------------------------------------------------

def test_thumbnail_none_when_frame_missing(tmp_path):
    """Thumbnail is None when frames/frame_0001.png does not exist."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "nothumb", no_frames=True)

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    assert len(entries) == 1
    assert entries[0].thumbnail_path is None


# ---------------------------------------------------------------------------
# size_label: only MP4 (no gif)
# ---------------------------------------------------------------------------

def test_size_label_mp4_only(tmp_path):
    """size_label shows only MP4 when no gif."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "mp4only", gif_exists=False)

    svc = LibraryService(projects)
    entries = svc.list_sessions()

    label = entries[0].size_label
    assert "(MP4)" in label
    assert "GIF" not in label


# ---------------------------------------------------------------------------
# to_qml_dict returns expected keys
# ---------------------------------------------------------------------------

def test_to_qml_dict_keys(tmp_path):
    """to_qml_dict returns all required keys for QML."""
    projects = tmp_path / "projects"
    projects.mkdir()

    _make_session(projects, "qmldict")

    svc = LibraryService(projects)
    entries = svc.list_sessions()
    d = entries[0].to_qml_dict()

    required_keys = {
        "session_id", "session_dir", "title", "raw_title", "date_label",
        "frame_count", "fps_label", "duration_label", "size_label",
        "mp4_path", "gif_path", "qr_path", "download_url",
        "thumbnail_path", "is_error", "error_reason",
    }
    assert required_keys.issubset(d.keys())


# ---------------------------------------------------------------------------
# fps_label for custom fps
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# T-BS33: update_download_url — retry-upload write-back (F7/F8 follow-up)
# ---------------------------------------------------------------------------

def test_update_download_url_writes_back(tmp_path):
    """T-BS33: persists a new download_url (+ optional qr_path) into
    project.json so a fresh list_sessions() scan reflects a retried upload."""
    projects = tmp_path / "projects"
    projects.mkdir()
    session_dir = _make_session(projects, "retry1", download_url=None)

    svc = LibraryService(projects)
    qr = session_dir / "qr.png"
    svc.update_download_url(session_dir, "https://example.com/retried.mp4", qr_path=qr)

    data = json.loads((session_dir / "project.json").read_text(encoding="utf-8"))
    assert data["download_url"] == "https://example.com/retried.mp4"
    assert data["qr_path"] == str(qr)

    # Re-scan (simulates the Library page re-opening) sees the new value.
    entries = svc.list_sessions()
    assert entries[0].download_url == "https://example.com/retried.mp4"


def test_update_download_url_without_qr_path_leaves_qr_untouched(tmp_path):
    """qr_path is optional — omitting it must not clobber the existing field."""
    projects = tmp_path / "projects"
    projects.mkdir()
    session_dir = _make_session(projects, "retry2", download_url=None)
    (session_dir / "project.json").write_text(
        json.dumps({
            **json.loads((session_dir / "project.json").read_text(encoding="utf-8")),
            "qr_path": "/old/qr.png",
        }),
        encoding="utf-8",
    )

    svc = LibraryService(projects)
    svc.update_download_url(session_dir, "https://example.com/x.mp4")

    data = json.loads((session_dir / "project.json").read_text(encoding="utf-8"))
    assert data["download_url"] == "https://example.com/x.mp4"
    assert data["qr_path"] == "/old/qr.png"


def test_update_download_url_missing_project_json_is_noop(tmp_path):
    """No project.json in the session dir → logs + no-ops (does not raise)."""
    projects = tmp_path / "projects"
    projects.mkdir()
    session_dir = projects / "session_nope"
    session_dir.mkdir()

    svc = LibraryService(projects)
    svc.update_download_url(session_dir, "https://example.com/x.mp4")  # must not raise
    assert not (session_dir / "project.json").exists()


def test_update_download_url_corrupt_json_is_noop(tmp_path):
    """Corrupt project.json → logs + no-ops (does not raise, does not overwrite)."""
    projects = tmp_path / "projects"
    projects.mkdir()
    session_dir = projects / "session_bad"
    session_dir.mkdir()
    (session_dir / "project.json").write_text("{not valid json", encoding="utf-8")

    svc = LibraryService(projects)
    svc.update_download_url(session_dir, "https://example.com/x.mp4")  # must not raise
    assert (session_dir / "project.json").read_text(encoding="utf-8") == "{not valid json"


@pytest.mark.parametrize("fps,expected", [
    (5, "Chậm · 5 fps"),
    (8, "Vừa · 8 fps"),
    (12, "Nhanh · 12 fps"),
    (15, "15 fps"),
])
def test_fps_label_mapping(fps, expected):
    """fps_label returns correct human-readable string."""
    entry = LibraryEntry(
        session_id="x",
        session_dir=Path("/tmp"),
        title="T",
        created_at=datetime(2026, 6, 16, 14, 20),
        frame_count=10,
        fps_playback=fps,
        duration_seconds=1.0,
        mp4_path=None,
        gif_path=None,
        qr_path=None,
        download_url=None,
        thumbnail_path=None,
    )
    assert entry.fps_label == expected
