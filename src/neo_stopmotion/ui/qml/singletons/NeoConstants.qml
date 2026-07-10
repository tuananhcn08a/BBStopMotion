pragma Singleton
import QtQuick

// NeoConstants — design tokens singleton.
// T-BS30: retheme "Bright Studio" (nền sáng, xanh dương #1B6EF3 + navy #1C3255,
// bo tròn lớn) — nguồn: docs/04-phases/neo-stopmotion/phase-04-bright-studio-redesign/
// assets/redline/{2a-capture,2b-exporting,2c-success,1g-library,1h-settings}.md
QtObject {
    // -----------------------------------------------------------------
    // Bright Studio palette (binding — xem redline cho từng màn)
    // -----------------------------------------------------------------
    readonly property color bgApp:           "#F3F6FB"   // nền toàn app
    readonly property color surfaceCard:     "#FFFFFF"   // card/sidebar/panel
    readonly property color brightPrimary:   "#1B6EF3"   // xanh dương chính
    readonly property color primaryTint:     "#E9F1FE"   // nền nav/chip active
    readonly property color primaryTintText: "#7FA8EE"   // chữ phụ trên nền tint
    readonly property color accentCapture:   "#FF6B35"   // nút CHỤP cam
    readonly property color accentCaptureRing: "#FFD9C7" // viền nút CHỤP

    readonly property color navy:            "#1C3255"   // text chính (đậm)
    readonly property color slate:           "#6B7C93"   // text phụ
    readonly property color slateMuted:      "#9AA8BC"   // text mờ/hint
    readonly property color slateFaint:      "#B6C3D6"   // separator, icon mờ

    readonly property color borderCard:      "#E3EAF4"   // viền card chuẩn
    readonly property color borderLight:     "#E9EFF7"   // viền nhạt (sidebar)
    readonly property color dividerLight:    "#EEF3FA"   // divider trong list

    readonly property color successBg:       "#E7F6EE"
    readonly property color successText:     "#21A85C"
    readonly property color successBorder:   "#BFE8D0"

    readonly property color warnBg:          "#FFF6E8"
    readonly property color warnText:        "#A96A00"
    readonly property color warnBorder:      "#FFE3B8"

    readonly property color dangerBg:        "#FDECEB"
    readonly property color dangerBorder:    "#F6C9C5"
    readonly property color dangerRed:       "#FF453A"   // hover xoá / cảnh báo mạnh

    readonly property color previewBg:       "#101E33"   // nền camera preview tối
    readonly property color previewBgAlt:    "#14243C"   // sọc placeholder
    readonly property color previewOverlay:  Qt.rgba(16 / 255, 30 / 255, 51 / 255, 0.75)
    readonly property color thumbBg:         "#24344E"
    readonly property color thumbBgAlt:      "#2B3D5A"

    readonly property color liveDot:         "#FF453A"

    // -----------------------------------------------------------------
    // Typography
    // -----------------------------------------------------------------
    readonly property string fontFamily: "Plus Jakarta Sans"

    property bool largeTextMode: false
    readonly property real textScale:    largeTextMode ? 1.25 : 1.0
    readonly property int fontTitle:     Math.round(30 * textScale)
    readonly property int fontBody:      Math.round(16 * textScale)
    readonly property int fontButton:    Math.round(16 * textScale)
    readonly property int fontCaption:   Math.round(13 * textScale)
    readonly property int fontFrameCount: Math.round(34 * textScale)

    // -----------------------------------------------------------------
    // Layout — sidebar/cards/radius
    // -----------------------------------------------------------------
    readonly property int sidebarWidth:      248
    readonly property int sidebarWidthCompact: 248

    readonly property int radiusS:      10
    readonly property int radiusM:      12
    readonly property int radiusL:      16
    readonly property int radiusXL:     18
    readonly property int radiusXXL:    20
    readonly property int radiusExportCard: 28
    readonly property int radiusFull:   999

    // -----------------------------------------------------------------
    // Legacy aliases — giữ để component cũ (FilmStrip base, popup, overlay...)
    // không phải sửa từng file; TRỎ VỀ token Bright Studio mới.
    // -----------------------------------------------------------------
    readonly property color primary:    brightPrimary
    readonly property color secondary:  brightPrimary
    readonly property color accent:     accentCapture
    readonly property color background: bgApp
    readonly property color surface:    surfaceCard
    readonly property color textPrimary: navy
    readonly property color textSecondary: slate
    readonly property color success:    successText
    readonly property color warning:    warnText
    readonly property color error:      dangerRed

    // Touch targets
    readonly property int touchMin:      largeTextMode ? 60 : 52
    readonly property int buttonHeight:  largeTextMode ? 68 : 60
    readonly property int previewWidth:  1280
    readonly property int previewHeight: 720

    // Animation
    readonly property int animFast:    200
    readonly property int animNormal:  400
    readonly property int animSlow:    800

    // Stop-motion specific
    // F3: onion skin opacity mặc định đổi 0.30 → 0.40 (Bright Studio redesign)
    readonly property real onionOpacity: 0.40
    readonly property int targetFps:     10
    readonly property int minFrames:     5
    readonly property int maxFrames:     100
    // F2: mục tiêu số frame mặc định 30; các lựa chọn dropdown Settings (BA Q3 đề xuất)
    readonly property int goalFramesDefault: 30
    readonly property var goalFramesOptions: [10, 20, 30, 50, 75, 100]

    // Spacing
    readonly property int spacingS: 8
    readonly property int spacingM: 16
    readonly property int spacingL: 24
    readonly property int spacingXL: 40
}
