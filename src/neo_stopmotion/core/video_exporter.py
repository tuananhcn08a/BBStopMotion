"""ffmpeg-based video exporter for stop-motion frame sequences.

Optionally overlays a BBStopMotion watermark on every frame at bottom-right
with 85% opacity.
"""
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
        watermark_path: Path | None = None,
        watermark_width: int = 110,
        watermark_opacity: float = 0.85,
        watermark_margin: int = 20,
    ) -> None:
        self.fps = fps
        self.ffmpeg = ffmpeg
        self.codec = codec
        self.pix_fmt = pix_fmt
        self.gif_scale_width = gif_scale_width
        self.watermark_path = watermark_path
        self.watermark_width = watermark_width
        self.watermark_opacity = watermark_opacity
        self.watermark_margin = watermark_margin

    @property
    def has_watermark(self) -> bool:
        return self.watermark_path is not None and self.watermark_path.exists()

    # ---------- MP4 ----------
    def export_mp4(self, frames_dir: Path, output_path: Path) -> Path:
        if self.has_watermark:
            cmd = self._mp4_cmd_with_watermark(frames_dir, output_path)
        else:
            cmd = self._mp4_cmd_plain(frames_dir, output_path)
        logger.info(f"ffmpeg MP4 ({'watermarked' if self.has_watermark else 'plain'})")
        logger.debug(f"cmd: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode != 0:
            raise ExportError(
                f"ffmpeg MP4 failed: {result.stderr.decode(errors='ignore')[:500]}"
            )
        return output_path

    def _mp4_cmd_plain(self, frames_dir: Path, output_path: Path) -> list[str]:
        return [
            self.ffmpeg, "-y",
            "-framerate", str(self.fps),
            "-i", str(frames_dir / "frame_%04d.png"),
            "-c:v", self.codec,
            "-pix_fmt", self.pix_fmt,
            "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,"
                   "pad=1280:720:(ow-iw)/2:(oh-ih)/2",
            str(output_path),
        ]

    def _mp4_cmd_with_watermark(self, frames_dir: Path, output_path: Path) -> list[str]:
        m = self.watermark_margin
        w = self.watermark_width
        a = self.watermark_opacity
        scale_pad = (
            "scale=1280:720:force_original_aspect_ratio=decrease,"
            "pad=1280:720:(ow-iw)/2:(oh-ih)/2"
        )
        wm = f"scale={w}:-1,format=rgba,colorchannelmixer=aa={a}"
        overlay = f"overlay=W-w-{m}:H-h-{m}"
        return [
            self.ffmpeg, "-y",
            "-framerate", str(self.fps),
            "-i", str(frames_dir / "frame_%04d.png"),
            "-i", str(self.watermark_path),
            "-filter_complex",
            f"[0:v]{scale_pad}[bg];[1:v]{wm}[wm];[bg][wm]{overlay}",
            "-c:v", self.codec,
            "-pix_fmt", self.pix_fmt,
            str(output_path),
        ]

    # ---------- GIF (2-pass palette) ----------
    def export_gif(self, frames_dir: Path, output_path: Path) -> Path:
        palette = output_path.parent / "_palette.png"
        try:
            cmd1 = self._gif_palettegen_cmd(frames_dir, palette)
            r1 = subprocess.run(cmd1, capture_output=True)
            if r1.returncode != 0:
                raise ExportError(
                    f"ffmpeg palettegen failed: {r1.stderr.decode(errors='ignore')[:500]}"
                )
            cmd2 = self._gif_paletteuse_cmd(frames_dir, palette, output_path)
            r2 = subprocess.run(cmd2, capture_output=True)
            if r2.returncode != 0:
                raise ExportError(
                    f"ffmpeg paletteuse failed: {r2.stderr.decode(errors='ignore')[:500]}"
                )
            return output_path
        finally:
            if palette.exists():
                palette.unlink()

    def _gif_palettegen_cmd(self, frames_dir: Path, palette_out: Path) -> list[str]:
        scale = f"scale={self.gif_scale_width}:-1:flags=lanczos"
        if not self.has_watermark:
            return [
                self.ffmpeg, "-y",
                "-framerate", str(self.fps),
                "-i", str(frames_dir / "frame_%04d.png"),
                "-vf", f"{scale},palettegen",
                str(palette_out),
            ]
        m = self.watermark_margin
        w = self.watermark_width
        a = self.watermark_opacity
        wm = f"scale={w}:-1,format=rgba,colorchannelmixer=aa={a}"
        overlay = f"overlay=W-w-{m}:H-h-{m}"
        return [
            self.ffmpeg, "-y",
            "-framerate", str(self.fps),
            "-i", str(frames_dir / "frame_%04d.png"),
            "-i", str(self.watermark_path),
            "-filter_complex",
            f"[0:v]{scale}[bg];[1:v]{wm}[wm];[bg][wm]{overlay},palettegen",
            str(palette_out),
        ]

    def _gif_paletteuse_cmd(
        self, frames_dir: Path, palette_in: Path, output_path: Path
    ) -> list[str]:
        scale = f"scale={self.gif_scale_width}:-1:flags=lanczos"
        if not self.has_watermark:
            return [
                self.ffmpeg, "-y",
                "-framerate", str(self.fps),
                "-i", str(frames_dir / "frame_%04d.png"),
                "-i", str(palette_in),
                "-filter_complex", f"[0:v]{scale}[x];[x][1:v]paletteuse",
                str(output_path),
            ]
        m = self.watermark_margin
        w = self.watermark_width
        a = self.watermark_opacity
        wm = f"scale={w}:-1,format=rgba,colorchannelmixer=aa={a}"
        overlay = f"overlay=W-w-{m}:H-h-{m}"
        return [
            self.ffmpeg, "-y",
            "-framerate", str(self.fps),
            "-i", str(frames_dir / "frame_%04d.png"),
            "-i", str(self.watermark_path),
            "-i", str(palette_in),
            "-filter_complex",
            f"[0:v]{scale}[bg];[1:v]{wm}[wm];[bg][wm]{overlay}[x];[x][2:v]paletteuse",
            str(output_path),
        ]
