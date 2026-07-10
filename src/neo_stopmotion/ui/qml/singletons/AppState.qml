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
    property string selectedSpeedLabel: "Vua"  // Cham | Vua | Nhanh — for speed segment highlight

    // -----------------------------------------------------------------
    // T-BS30 — Bright Studio: nav + feature state (spec §5)
    // -----------------------------------------------------------------
    // F5 — nav sidebar: 'capture' | 'library' | 'settings'
    property string screen: "capture"
    // Nav bị khoá khi đang xuất phim (F5 — sidebar opacity 0.55, không tương tác)
    property bool navLocked: false

    // F1 — onion skin toggle riêng ở 2a (đồng bộ 2 chiều với onionSkinOpacity Settings)
    property bool onionSkinEnabled: true

    // F2 — mục tiêu số frame (persist qua AppController/config)
    property int goalFrames: 30

    // F3 — độ mờ onion skin 0-1 (persist qua AppController/config)
    property real onionSkinOpacity: 0.40

    // F4 — ngôn ngữ hiển thị: 'vi+en' | 'vi' | 'en'
    property string language: "vi+en"

    // F8 — các setting còn lại
    property bool soundEnabled: true
    property bool autoUpload: true
    property string defaultFpsLevel: "Vua"

    // Computed
    readonly property real durationSeconds: frameCount / 10.0
    readonly property string durationDisplay: durationSeconds.toFixed(1) + "s"
}
