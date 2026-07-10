import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window
import "singletons" as N
import "pages" as Pages
import "components" as C

ApplicationWindow {
    id: root
    width: 1280
    height: 820
    visible: true
    visibility: Window.Windowed
    title: "BBStopMotion — Trạm 6"
    color: N.NeoConstants.bgApp
    font.family: N.NeoConstants.fontFamily

    // T-BS30: full sidebar-shell — sidebar trái (nav + progress + ThingBot) +
    // main content (StackView). Redline: assets/redline/2a-capture.md §Sidebar.
    RowLayout {
        anchors.fill: parent
        spacing: 0

        C.Sidebar {
            id: sidebar
            Layout.fillHeight: true
            variant: (N.AppState.screen === "library" || N.AppState.screen === "settings")
                ? "compact" : "full"
            activeScreen: N.AppState.screen
            locked: N.AppState.navLocked

            onNavigate: function(screen) {
                _goToScreen(screen)
            }
            onHelpRequested: {
                if (stack.currentItem && stack.currentItem.openShortcuts) {
                    stack.currentItem.openShortcuts()
                }
            }
        }

        StackView {
            id: stack
            Layout.fillWidth: true
            Layout.fillHeight: true
            initialItem: capturePageComponent
            focus: true

            // Global key handler — cốt lõi 3 phím IO (T-011 AC1), giữ nguyên
            // hành vi bàn phím sau redesign (TS-BS-32).
            Keys.onPressed: function(event) {
                var onLibrary = stack.currentItem && stack.currentItem.toString().indexOf("LibraryPage") !== -1
                if (onLibrary) {
                    return  // LibraryPage handles all keys itself
                }
                if (event.key === Qt.Key_Space) {
                    appController.handle_uart_command("SHOOT")
                    event.accepted = true
                } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
                    appController.handle_uart_command("EXPORT")
                    event.accepted = true
                }
            }
        }
    }

    // ========================================================================
    // Splash overlay — che toàn cửa sổ (sidebar+main) lúc khởi động, biến mất
    // sau khi finished() (T-BS30: sidebar-shell nằm sẵn phía dưới ngay từ đầu).
    // ========================================================================
    Loader {
        id: splashLoader
        anchors.fill: parent
        active: true
        sourceComponent: Pages.SplashScreen {
            onFinished: splashLoader.active = false
        }
    }

    function _goToScreen(screen) {
        if (N.AppState.navLocked) return
        N.AppState.screen = screen
        if (screen === "capture") {
            stack.replace(capturePageComponent)
        } else if (screen === "library") {
            stack.replace(libraryPageComponent)
        } else if (screen === "settings") {
            stack.replace(settingsPageComponent)
        }
    }

    Component {
        id: capturePageComponent
        Pages.CapturePage {
            onNavigateToLibrary: _goToScreen("library")
        }
    }

    Component {
        id: libraryPageComponent
        Pages.LibraryPage {
            onNavigateBack: _goToScreen("capture")
        }
    }

    Component {
        id: settingsPageComponent
        Pages.SettingsPage {
            onNavigateBack: _goToScreen("capture")
        }
    }

    Component {
        id: exportingPageComponent
        Pages.ExportingPage { }
    }

    Component {
        id: successPageComponent
        Pages.SuccessPage {
            onNavigateToLibrary: _goToScreen("library")
        }
    }

    Connections {
        target: appController
        function onFrameCountChanged(n) {
            N.AppState.frameCount = n
        }
    }

    Connections {
        target: signalBusBridge
        function onUartConnected() {
            N.AppState.uartConnected = true
        }
        function onUartDisconnected() {
            N.AppState.uartConnected = false
        }
        function onExportStarted() {
            N.AppState.screen = "capture"
            N.AppState.navLocked = true
            stack.replace(exportingPageComponent)
        }
        function onExportProgress(p) {
            if (stack.currentItem && stack.currentItem.progress !== undefined) {
                stack.currentItem.progress = p
            }
        }
        function onExportCompleted(mp4Path, gifPath, shareUrl, qrPath) {
            N.AppState.navLocked = false
            stack.replace(successPageComponent, {
                mp4Path: mp4Path,
                gifPath: gifPath,
                shareUrl: shareUrl,
                qrPath: qrPath,
            })
        }
        function onExportFailed(msg) {
            console.log("Export failed:", msg)
            N.AppState.navLocked = false
            stack.replace(capturePageComponent)
        }
        function onSessionReset() {
            N.AppState.screen = "capture"
            stack.replace(capturePageComponent)
        }
        function onStatusMessage(level, message) {
            console.log("STATUS [" + level + "] " + message)
        }
    }

    // T-BS30: đồng bộ AppState (F2/F3/F4/F8) từ giá trị đã persist trong
    // AppController lúc khởi động (config.toml) — QML singleton mặc định
    // không tự đọc config, phải sync 1 lần khi app mở.
    Component.onCompleted: {
        N.AppState.goalFrames = appController.goalFrames
        N.AppState.onionSkinOpacity = appController.onionSkinOpacity
        N.AppState.language = appController.language
        N.AppState.soundEnabled = appController.soundEnabled
        N.AppState.autoUpload = appController.autoUpload
        N.AppState.defaultFpsLevel = appController.defaultFpsLevel

        // T-BS30 (visual diff gate): NEO_STOPMOTION_SCREEN jumps straight to a
        // screen after splash — lets grab-qml.sh capture 1g/1h without scripting
        // clicks (verify/README.md limitation noted for T-BS03).
        if (typeof initialScreen !== "undefined" && initialScreen !== "capture") {
            _goToScreen(initialScreen)
        }
    }
}
