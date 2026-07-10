from neo_stopmotion.ui.qml_loader import find_qml_root


def test_find_qml_root_returns_existing_path():
    path = find_qml_root()
    assert path.exists()
    assert (path / "MainWindow.qml").exists()


# ---------------------------------------------------------------------------
# T-BS33: Welcome (1d) — TS-BS-17 (P0).
#
# Full QQmlApplicationEngine rendering is not exercised by this test suite
# (no precedent in this repo — see NEO_STOPMOTION_SCREEN=welcome + grab-qml.sh
# for the real-render check). This is a structural/source guard so a P0
# scenario still has *some* pytest coverage: the Welcome page exists, is
# wired into MainWindow's overlay + welcomeSeen state, and its CTA emits the
# signal that flips AppState.welcomeSeen (→ Capture, per TS-BS-17).
# ---------------------------------------------------------------------------

def test_welcome_page_qml_exists_and_declares_start_signal():
    welcome_path = find_qml_root() / "pages" / "WelcomePage.qml"
    assert welcome_path.exists()
    src = welcome_path.read_text(encoding="utf-8")
    assert "signal startRequested()" in src
    assert "Bắt đầu làm phim!" in src  # redline 1d CTA copy


def test_app_state_declares_welcome_seen_default_false():
    app_state_path = find_qml_root() / "singletons" / "AppState.qml"
    src = app_state_path.read_text(encoding="utf-8")
    assert "property bool welcomeSeen: false" in src


def test_main_window_wires_welcome_overlay_and_start_transition():
    main_window_path = find_qml_root() / "MainWindow.qml"
    src = main_window_path.read_text(encoding="utf-8")
    # Overlay driven by welcomeSeen (F6) and the CTA flips it to true —
    # TS-BS-17: "sau khi bấm → welcomeSeen=true, screen='capture'".
    assert "Pages.WelcomePage" in src
    assert "N.AppState.welcomeSeen" in src
    assert "onStartRequested" in src
    assert "N.AppState.welcomeSeen = true" in src
