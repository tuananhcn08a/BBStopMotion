"""LibraryService — T-012 film library.

Scans projects_dir, reads project.json, filters valid sessions (exported=true &
mp4 exists), sorts newest first, computes file size + thumbnail path on-demand.

Spec ref:  docs/01-specs/features/film-library/spec.md
Domain:    docs/01-specs/features/film-library/domain.md
"""
from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

# ---------------------------------------------------------------------------
# LibraryEntry — minimal data-class for QML (pure Python, no Qt deps)
# ---------------------------------------------------------------------------

@dataclass
class LibraryEntry:
    """Lightweight view-model for one session in the library."""

    session_id: str
    session_dir: Path
    title: str                    # display title (may be synthetic if blank)
    created_at: datetime
    frame_count: int
    fps_playback: int
    duration_seconds: float
    mp4_path: Path | None
    gif_path: Path | None
    qr_path: Path | None
    download_url: str | None
    thumbnail_path: Path | None   # frames/frame_0001.png or None
    is_error: bool = False        # BR-2 / BR-3: error state
    error_reason: str = ""

    # ---------- computed helpers ----------

    @property
    def display_title(self) -> str:
        """BR-5: empty title → 'Phim dd/MM HH:mm'."""
        if self.title:
            return self.title
        try:
            return f"Phim {self.created_at.strftime('%d/%m %H:%M')}"
        except Exception:  # noqa: BLE001
            return "Phim không rõ ngày"

    @property
    def total_size_bytes(self) -> int:
        """BR-12: mp4 + gif size (gif optional)."""
        size = 0
        if self.mp4_path and self.mp4_path.exists():
            size += self.mp4_path.stat().st_size
        if self.gif_path and self.gif_path.exists():
            size += self.gif_path.stat().st_size
        return size

    @property
    def size_label(self) -> str:
        """Human-readable size, e.g. '2.4 MB (MP4 + GIF)'."""
        b = self.total_size_bytes
        if b == 0:
            return "--"
        mb = b / (1024 * 1024)
        has_gif = self.gif_path and self.gif_path.exists()
        suffix = " (MP4 + GIF)" if has_gif else " (MP4)"
        return f"{mb:.1f} MB{suffix}"

    @property
    def fps_label(self) -> str:
        """Human-readable fps, e.g. 'Vừa · 8 fps'."""
        mapping = {5: "Chậm", 8: "Vừa", 12: "Nhanh"}
        name = mapping.get(self.fps_playback, "")
        if name:
            return f"{name} · {self.fps_playback} fps"
        return f"{self.fps_playback} fps"

    @property
    def date_label(self) -> str:
        """Format: 'dd/MM/yyyy · HH:mm'."""
        try:
            return self.created_at.strftime("%d/%m/%Y · %H:%M")
        except Exception:  # noqa: BLE001
            return "--"

    @property
    def duration_label(self) -> str:
        """Format: 'X.X giây' (recompute if fps_playback > 0)."""
        if self.fps_playback <= 0:
            return "--"
        dur = self.frame_count / self.fps_playback
        return f"{dur:.1f} giây"

    def to_qml_dict(self) -> dict[str, Any]:
        """Return a plain dict suitable for QVariantList in QML."""
        return {
            "session_id": self.session_id,
            "session_dir": str(self.session_dir),
            "title": self.display_title,
            "raw_title": self.title,
            # T-BS30 (F7): ISO 8601 để QML lọc "Hôm nay"/"Tuần này" chính xác
            # (date_label là chuỗi đã format tiếng Việt, không parse được bằng Date()).
            "created_at": self.created_at.isoformat(),
            "date_label": self.date_label,
            "frame_count": self.frame_count,
            "fps_label": self.fps_label,
            "duration_label": self.duration_label,
            "size_label": self.size_label,
            "mp4_path": str(self.mp4_path) if self.mp4_path else "",
            "gif_path": str(self.gif_path) if self.gif_path else "",
            "qr_path": str(self.qr_path) if self.qr_path else "",
            "download_url": self.download_url or "",
            "thumbnail_path": str(self.thumbnail_path) if self.thumbnail_path else "",
            "is_error": self.is_error,
            "error_reason": self.error_reason,
        }


# ---------------------------------------------------------------------------
# LibraryService
# ---------------------------------------------------------------------------

class LibraryService:
    """Scan projects_dir and manage the list of library sessions.

    Designed to be used both from Python tests (pure) and from QML via
    AppController which calls list_sessions() / delete_session().
    """

    def __init__(self, projects_dir: Path, max_sessions: int = 50) -> None:
        self._projects_dir = Path(projects_dir)
        self._max_sessions = max_sessions

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def list_sessions(self) -> list[LibraryEntry]:
        """Scan projects_dir, return filtered + sorted list of sessions.

        Rules (spec §2, domain BR-1..BR-10):
        - Directories with no project.json → silently skipped (BR-4).
        - project.json parse error → LibraryEntry with is_error=True (BR-3).
        - exported=false → excluded (BR-1).
        - exported=true but mp4 missing → is_error=True (BR-2).
        - exported=true + mp4 exists → valid entry.
        - Sort newest first (BR-9), max max_sessions entries (BR-10).
        """
        if not self._projects_dir.exists():
            raise OSError(
                f"Không tìm thấy thư mục dự án: {self._projects_dir}"
            )
        if not self._projects_dir.is_dir():
            raise OSError(
                f"Đường dẫn không phải thư mục: {self._projects_dir}"
            )

        entries: list[LibraryEntry] = []
        try:
            subdirs = [d for d in self._projects_dir.iterdir() if d.is_dir()]
        except PermissionError as e:
            raise OSError(
                f"Không đọc được thư mục dự án: {self._projects_dir}"
            ) from e

        for session_dir in subdirs:
            entry = self._parse_session(session_dir)
            if entry is not None:
                entries.append(entry)

        # Sort: newest first, stable tie-break by session_id (BR-9, domain edge case)
        entries.sort(key=lambda e: (e.created_at, e.session_id), reverse=True)

        # BR-10: cap to max_sessions
        return entries[: self._max_sessions]

    def delete_session(self, session_id: str) -> None:
        """Delete session directory (shutil.rmtree).

        BR-8: removes entire directory including frames/, mp4, gif, qr, json.
        Raises ValueError if session_id is empty.
        Raises OSError if directory does not exist or cannot be deleted.
        """
        if not session_id:
            raise ValueError("session_id must not be empty")

        # Find the session dir (scan to avoid path injection)
        session_dir: Path | None = None
        try:
            for d in self._projects_dir.iterdir():
                if d.is_dir():
                    proj_file = d / "project.json"
                    if proj_file.exists():
                        try:
                            data = json.loads(proj_file.read_text(encoding="utf-8"))
                            if data.get("session_id") == session_id:
                                session_dir = d
                                break
                        except Exception:  # noqa: BLE001
                            # Corrupted JSON — match by directory name convention too
                            if session_id in d.name:
                                session_dir = d
                                break
                    elif session_id in d.name:
                        session_dir = d
                        break
        except PermissionError as e:
            raise OSError(f"Không đọc được thư mục dự án: {e}") from e

        if session_dir is None:
            raise OSError(
                f"Không tìm thấy session '{session_id}' trong {self._projects_dir}"
            )

        logger.info(f"Deleting session {session_id}: {session_dir}")
        try:
            shutil.rmtree(session_dir)
        except PermissionError as e:
            raise OSError(
                f"Không thể xoá phim. Kiểm tra lại quyền thư mục: {e}"
            ) from e
        except OSError as e:
            raise OSError(f"Không thể xoá phim: {e}") from e

        logger.info(f"Session deleted: {session_id} ({session_dir})")

    def update_download_url(
        self, session_dir: Path, download_url: str, qr_path: Path | None = None
    ) -> None:
        """T-BS33 (F7/F8 follow-up): write a new share URL back into project.json.

        AppController.retry_upload() previously only emitted the result over
        SignalBus (QML session state) — the Library's badge would show the
        stale/missing download_url again after a re-scan (app restart, or
        just calling library_list_sessions() again) because project.json on
        disk was never updated. This persists both download_url and (when
        provided) qr_path so a re-scan reflects the retried upload.

        Best-effort: missing project.json or a parse/write error is logged
        and swallowed (mirrors _parse_session's tolerant error handling) —
        retry_upload() must not raise just because the Library write-back
        failed; the SignalBus result (session-only) still reaches the UI.
        """
        proj_file = Path(session_dir) / "project.json"
        if not proj_file.exists():
            logger.warning(f"update_download_url: no project.json in {session_dir}")
            return

        try:
            data = json.loads(proj_file.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            logger.warning(f"update_download_url: parse error in {proj_file}: {e}")
            return

        data["download_url"] = download_url
        if qr_path is not None:
            data["qr_path"] = str(qr_path)

        try:
            proj_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except OSError as e:
            logger.warning(f"update_download_url: write failed for {proj_file}: {e}")
            return

        logger.info(f"update_download_url: {proj_file} -> download_url={download_url}")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_session(self, session_dir: Path) -> LibraryEntry | None:
        """Parse one session directory.

        Returns None if directory should be silently skipped (BR-4: no project.json).
        Returns LibraryEntry(is_error=True) for BR-2/BR-3.
        Returns valid LibraryEntry for BR-1 pass-through.
        """
        proj_file = session_dir / "project.json"
        if not proj_file.exists():
            # BR-4: no project.json — silently skip
            return None

        # Try to parse project.json
        try:
            data = json.loads(proj_file.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            # BR-3: unreadable JSON
            logger.warning(f"project.json parse error in {session_dir}: {e}")
            return LibraryEntry(
                session_id=session_dir.name[:8],
                session_dir=session_dir,
                title="Phim bị lỗi",
                created_at=datetime.fromtimestamp(session_dir.stat().st_mtime),
                frame_count=0,
                fps_playback=0,
                duration_seconds=0.0,
                mp4_path=None,
                gif_path=None,
                qr_path=None,
                download_url=None,
                thumbnail_path=None,
                is_error=True,
                error_reason="Không đọc được thông tin phim (project.json hỏng)",
            )

        # BR-1: exported must be True
        if not data.get("exported", False):
            return None

        # Parse essential fields
        session_id = data.get("session_id", session_dir.name)
        title = data.get("title", "") or ""
        created_at = _parse_datetime(data.get("created_at"), session_dir)
        frame_count = int(data.get("frame_count", 0))
        fps_playback = int(data.get("fps_playback", 10))
        duration_seconds = float(data.get("duration_seconds", 0.0))

        mp4_raw = data.get("mp4_path")
        gif_raw = data.get("gif_path")
        qr_raw = data.get("qr_path")
        download_url = data.get("download_url") or None

        mp4_path = Path(mp4_raw) if mp4_raw else None
        gif_path = Path(gif_raw) if gif_raw else None
        qr_path = Path(qr_raw) if qr_raw else None

        # BR-2: mp4 missing or null
        if mp4_path is None or not mp4_path.exists():
            logger.warning(f"mp4 missing for session {session_id}: {mp4_path}")
            return LibraryEntry(
                session_id=session_id,
                session_dir=session_dir,
                title=title,
                created_at=created_at,
                frame_count=frame_count,
                fps_playback=fps_playback,
                duration_seconds=duration_seconds,
                mp4_path=mp4_path,
                gif_path=gif_path,
                qr_path=qr_path,
                download_url=download_url,
                thumbnail_path=None,
                is_error=True,
                error_reason="File phim MP4 không tìm thấy",
            )

        # Thumbnail: frame_0001.png
        thumb = session_dir / "frames" / "frame_0001.png"
        thumbnail_path = thumb if thumb.exists() else None

        return LibraryEntry(
            session_id=session_id,
            session_dir=session_dir,
            title=title,
            created_at=created_at,
            frame_count=frame_count,
            fps_playback=fps_playback,
            duration_seconds=duration_seconds,
            mp4_path=mp4_path,
            gif_path=gif_path,
            qr_path=qr_path,
            download_url=download_url,
            thumbnail_path=thumbnail_path,
        )


def _parse_datetime(raw: object, session_dir: Path) -> datetime:
    """Parse ISO datetime string; fallback to directory mtime."""
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            pass
    try:
        return datetime.fromtimestamp(session_dir.stat().st_mtime)
    except Exception:  # noqa: BLE001
        return datetime.now()
