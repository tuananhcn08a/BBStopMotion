import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock

import pytest

# Make src importable for tests
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def _make_pyqt6_stubs() -> None:
    """Provide lightweight stubs for PyQt6 so core tests run without the GUI stack.

    Only installs the fake `PyQt6` package when the *real* PyQt6 is not
    installed in this environment (e.g. headless CI without the GUI stack).

    Why the guard matters: this function runs at conftest.py import time,
    which happens before pytest-qt's `pytest_configure` hook. If we always
    replace `sys.modules["PyQt6"]` with a stub — even when a real PyQt6 is
    installed — pytest-qt's hook later does
    `__import__("PyQt6", ..., ["QtTest"], 0)`. Because `sys.modules["PyQt6"]`
    is already our stub (which has no `QtTest` submodule), Python's import
    machinery treats `PyQt6` as already-imported and skips importing/binding
    the `QtTest` submodule onto it, so `getattr(PyQt6, "QtTest")` raises
    `AttributeError` and crashes the whole pytest session at
    `_do_configure()` (INTERNALERROR, 0 tests collected) — this was the
    `make test` INTERNALERROR reported in T-BS31 gate-desktop-report.md.
    Using `importlib.util.find_spec` here only *checks* for PyQt6 without
    importing it, so it doesn't itself populate `sys.modules["PyQt6"]` and
    doesn't interfere with pytest-qt's real import when PyQt6 is present.
    """
    if "PyQt6" in sys.modules:
        return
    if importlib.util.find_spec("PyQt6") is not None:
        # Real PyQt6 available — let pytest-qt (and everything else) import
        # and use the genuine package instead of the lightweight fakes below.
        return

    class _pyqtSignal:  # noqa: N801
        """Minimal pyqtSignal stub that records connected slots."""

        def __init__(self, *args: object) -> None:
            self._slots: list[object] = []

        def connect(self, slot: object) -> None:
            self._slots.append(slot)

        def emit(self, *args: object) -> None:
            for s in list(self._slots):
                try:
                    s(*args)  # type: ignore[operator]
                except Exception:
                    pass

        def disconnect(self, slot: object = None) -> None:
            if slot is None:
                self._slots.clear()
            else:
                self._slots = [s for s in self._slots if s is not slot]

    class _QObject:
        pass

    def _pyqtSlot(*args: object, **kwargs: object):  # type: ignore[no-untyped-def]  # noqa: N802
        def decorator(fn):  # type: ignore[no-untyped-def]
            return fn
        return decorator

    def _pyqtProperty(*args: object, **kwargs: object):  # type: ignore[no-untyped-def]  # noqa: N802
        def decorator(fn):  # type: ignore[no-untyped-def]
            return property(fn)
        return decorator

    class _QThread:
        pass

    class _QTimer:
        @staticmethod
        def singleShot(*args: object, **kwargs: object) -> None:  # noqa: N802
            pass

    class _Qt:
        AlignHCenter = 0

    class _QUrl:
        def __init__(self, *args: object) -> None:
            pass

        @staticmethod
        def fromLocalFile(path: str) -> "_QUrl":  # noqa: N802
            return _QUrl()

    class _QSize:
        def __init__(self, w: int = 0, h: int = 0) -> None:
            self.width_ = w
            self.height_ = h

        def width(self) -> int:
            return self.width_

        def height(self) -> int:
            return self.height_

    qt_core = ModuleType("PyQt6.QtCore")
    qt_core.QObject = _QObject  # type: ignore[attr-defined]
    qt_core.QThread = _QThread  # type: ignore[attr-defined]
    qt_core.QTimer = _QTimer  # type: ignore[attr-defined]
    qt_core.QUrl = _QUrl  # type: ignore[attr-defined]
    qt_core.QSize = _QSize  # type: ignore[attr-defined]
    qt_core.Qt = _Qt  # type: ignore[attr-defined]
    qt_core.pyqtSignal = _pyqtSignal  # type: ignore[attr-defined]
    qt_core.pyqtSlot = _pyqtSlot  # type: ignore[attr-defined]
    qt_core.pyqtProperty = _pyqtProperty  # type: ignore[attr-defined]

    # QtGui stub
    class _QImageFormat:
        Format_RGB888 = 4

    class _QImage:
        Format = _QImageFormat

        def __init__(self, *args: object) -> None:
            # args: (data, width, height, bytes_per_line, format) or ()
            self._null = len(args) == 0
            self._w: int = int(args[1]) if len(args) > 1 else 0
            self._h: int = int(args[2]) if len(args) > 2 else 0

        def isNull(self) -> bool:  # noqa: N802
            return self._null

        def width(self) -> int:
            return self._w

        def height(self) -> int:
            return self._h

        def size(self) -> "_QSize":  # noqa: N802
            return _QSize(self._w, self._h)

        def copy(self) -> "_QImage":
            return self

    class _QGuiApplication:
        def __init__(self, *args: object) -> None:
            pass

    qt_gui = ModuleType("PyQt6.QtGui")
    qt_gui.QImage = _QImage  # type: ignore[attr-defined]
    qt_gui.QGuiApplication = _QGuiApplication  # type: ignore[attr-defined]

    # QtWidgets stub
    qt_widgets = ModuleType("PyQt6.QtWidgets")

    # QtQml stub
    qt_qml = ModuleType("PyQt6.QtQml")
    qt_qml.QQmlApplicationEngine = MagicMock  # type: ignore[attr-defined]

    # QtQuick stub
    class _QQuickImageProviderImageType:
        Image = 1

    class _QQuickImageProvider:
        ImageType = _QQuickImageProviderImageType

        def __init__(self, image_type: object = None) -> None:
            pass

    qt_quick = ModuleType("PyQt6.QtQuick")
    qt_quick.QQuickImageProvider = _QQuickImageProvider  # type: ignore[attr-defined]

    pyqt6_root = ModuleType("PyQt6")
    pyqt6_root.QtCore = qt_core  # type: ignore[attr-defined]
    pyqt6_root.QtGui = qt_gui  # type: ignore[attr-defined]
    pyqt6_root.QtWidgets = qt_widgets  # type: ignore[attr-defined]
    pyqt6_root.QtQml = qt_qml  # type: ignore[attr-defined]
    pyqt6_root.QtQuick = qt_quick  # type: ignore[attr-defined]

    sys.modules["PyQt6"] = pyqt6_root
    sys.modules["PyQt6.QtCore"] = qt_core
    sys.modules["PyQt6.QtGui"] = qt_gui
    sys.modules["PyQt6.QtWidgets"] = qt_widgets
    sys.modules["PyQt6.QtQml"] = qt_qml
    sys.modules["PyQt6.QtQuick"] = qt_quick


_make_pyqt6_stubs()


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
