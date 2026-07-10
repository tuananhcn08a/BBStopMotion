// Sidebar.qml — T-BS30 Bright Studio full sidebar-shell
// Redline: docs/04-phases/neo-stopmotion/phase-04-bright-studio-redesign/assets/redline/2a-capture.md
//          (1g/1h dùng biến thể "compact" — chỉ nav 3 mục, xem redline 1g-library.md/1h-settings.md)
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N

Rectangle {
    id: root

    // "full" (2a/2b/2c — nav + Card Tiến độ + Card ThingBot + Help)
    // "compact" (1g/1h — chỉ nav 3 mục)
    property string variant: "full"
    // 'capture' | 'library' | 'settings'
    property string activeScreen: "capture"
    // Khoá tương tác lúc EXPORTING (F5) — opacity 0.55, không click được
    property bool locked: false

    signal navigate(string screen)
    signal helpRequested()

    width: N.NeoConstants.sidebarWidth
    color: N.NeoConstants.surfaceCard
    opacity: locked ? 0.55 : 1.0
    Behavior on opacity { NumberAnimation { duration: N.NeoConstants.animFast } }

    Rectangle {
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.right: parent.right
        width: 1
        color: N.NeoConstants.borderLight
    }

    // Bilingual helper (F4): 'vi+en' hiện cả 2 (VN chính + EN phụ nhỏ),
    // 'vi' chỉ VN, 'en' chỉ EN làm chữ chính.
    function mainLabel(vi, en) {
        return N.AppState.language === "en" ? en : vi
    }
    function showSub() {
        return N.AppState.language === "vi+en"
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        anchors.topMargin: 24
        spacing: 8

        // ============================================================
        // Logo + wordmark
        // ============================================================
        RowLayout {
            Layout.fillWidth: true
            Layout.bottomMargin: 12
            spacing: 10

            Rectangle {
                width: 34; height: 34
                radius: N.NeoConstants.radiusS
                color: N.NeoConstants.brightPrimary
                Text {
                    anchors.centerIn: parent
                    text: "BB"
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 14
                    font.weight: Font.ExtraBold
                    color: "#FFFFFF"
                }
            }

            Text {
                Layout.fillWidth: true
                text: "BBStopMotion <font color='" + N.NeoConstants.brightPrimary + "'>studio</font>"
                textFormat: Text.RichText
                font.family: N.NeoConstants.fontFamily
                font.pixelSize: 17
                font.weight: Font.ExtraBold
                color: N.NeoConstants.navy
                wrapMode: Text.WordWrap
            }
        }

        // ============================================================
        // Nav — 3 mục (Chụp phim / Thư viện phim / Cài đặt)
        // ============================================================
        Repeater {
            model: [
                { screen: "capture",  icon: "🎥", vi: "Chụp phim",     en: "Capture" },
                { screen: "library",  icon: "📽️", vi: "Thư viện phim", en: "Library" },
                { screen: "settings", icon: "⚙️", vi: "Cài đặt",       en: "Settings" },
            ]
            delegate: Rectangle {
                id: navItem
                Layout.fillWidth: true
                height: 44
                radius: N.NeoConstants.radiusM
                readonly property bool isActive: root.activeScreen === modelData.screen
                color: isActive ? N.NeoConstants.primaryTint
                     : navMouse.containsMouse ? N.NeoConstants.bgApp : "transparent"

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 14
                    anchors.rightMargin: 14
                    spacing: 10

                    Text {
                        text: modelData.icon
                        font.pixelSize: 18
                    }
                    ColumnLayout {
                        spacing: 0
                        Text {
                            text: root.mainLabel(modelData.vi, modelData.en)
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 15
                            font.weight: navItem.isActive ? Font.Bold : Font.DemiBold
                            color: navItem.isActive ? N.NeoConstants.brightPrimary : N.NeoConstants.navy
                        }
                        Text {
                            visible: root.showSub()
                            text: modelData.en
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 11
                            font.weight: Font.DemiBold
                            color: navItem.isActive ? N.NeoConstants.primaryTintText : N.NeoConstants.slateMuted
                        }
                    }
                }

                MouseArea {
                    id: navMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    enabled: !root.locked
                    onClicked: root.navigate(modelData.screen)
                }
            }
        }

        // ============================================================
        // Card Tiến độ (F2 goalFrames) — chỉ variant "full"
        // ============================================================
        Rectangle {
            Layout.fillWidth: true
            Layout.topMargin: 16
            visible: root.variant === "full"
            height: progressCol.implicitHeight + 32
            radius: N.NeoConstants.radiusL
            color: "transparent"
            border.color: N.NeoConstants.borderCard
            border.width: 1

            ColumnLayout {
                id: progressCol
                anchors.fill: parent
                anchors.margins: 16
                spacing: 0

                Text {
                    text: root.mainLabel("TIẾN ĐỘ", "PROGRESS")
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 11
                    font.weight: Font.ExtraBold
                    font.letterSpacing: 1.1
                    color: N.NeoConstants.slate
                }

                RowLayout {
                    Layout.topMargin: 6
                    spacing: 6
                    Text {
                        text: N.AppState.frameCount
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 34
                        font.weight: Font.ExtraBold
                        color: N.NeoConstants.navy
                    }
                    Text {
                        Layout.alignment: Qt.AlignBottom
                        Layout.bottomMargin: 4
                        text: root.mainLabel(
                            "/ " + N.AppState.goalFrames + " frame",
                            "/ " + N.AppState.goalFrames + " frames")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 14
                        font.weight: Font.Bold
                        color: N.NeoConstants.slate
                    }
                }

                Rectangle {
                    id: progressTrack
                    Layout.fillWidth: true
                    Layout.topMargin: 10
                    height: 10
                    radius: N.NeoConstants.radiusFull
                    color: N.NeoConstants.primaryTint

                    Rectangle {
                        id: progressFill
                        height: parent.height
                        radius: N.NeoConstants.radiusFull
                        color: N.NeoConstants.brightPrimary
                        width: parent.width * Math.min(
                            N.AppState.goalFrames > 0 ? N.AppState.frameCount / N.AppState.goalFrames : 0, 1.0)
                        Behavior on width { NumberAnimation { duration: N.NeoConstants.animNormal } }

                        Text {
                            visible: progressFill.width > 12
                            anchors.right: parent.right
                            anchors.top: parent.top
                            anchors.rightMargin: -4
                            anchors.topMargin: -6
                            text: "⭐"
                            font.pixelSize: 15
                        }
                    }
                }

                Text {
                    Layout.topMargin: 10
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                    lineHeight: 1.45
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 12
                    color: N.NeoConstants.slate
                    textFormat: Text.RichText
                    text: {
                        var remaining = N.AppState.goalFrames - N.AppState.frameCount
                        if (remaining <= 0) {
                            return root.mainLabel(
                                "Đã đạt mục tiêu, con vẫn có thể chụp thêm nếu muốn!",
                                "Goal reached — keep going if you like!")
                        }
                        return root.mainLabel(
                            "Chụp thêm <b><font color='" + N.NeoConstants.navy + "'>" + remaining
                                + " frame</font></b> nữa là phim đủ mượt!",
                            "<b><font color='" + N.NeoConstants.navy + "'>" + remaining
                                + " more frames</font></b> for a smooth film!")
                    }
                }
            }
        }

        // ============================================================
        // Card ThingBot — chỉ variant "full" (desktop CÓ UART thật)
        // ============================================================
        Rectangle {
            Layout.fillWidth: true
            Layout.topMargin: 8
            visible: root.variant === "full"
            height: thingbotRow.implicitHeight + 24
            radius: N.NeoConstants.radiusL
            color: "transparent"
            border.color: N.NeoConstants.borderCard
            border.width: 1

            RowLayout {
                id: thingbotRow
                anchors.fill: parent
                anchors.margins: 14
                spacing: 10

                Text { text: "🔌"; font.pixelSize: 18 }

                ColumnLayout {
                    spacing: 1
                    Text {
                        text: "ThingBot"
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 12
                        font.weight: Font.Bold
                        color: N.NeoConstants.navy
                    }
                    Text {
                        text: N.AppState.uartConnected
                            ? root.mainLabel("● Đã kết nối", "● Connected")
                            : root.mainLabel("⚠ Chưa kết nối", "⚠ Not connected")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 11
                        font.weight: Font.Bold
                        color: N.AppState.uartConnected ? N.NeoConstants.successText : N.NeoConstants.warnText
                    }
                }
            }
        }

        Item { Layout.fillHeight: true }

        // ============================================================
        // Trợ giúp — chỉ variant "full"
        // ============================================================
        Rectangle {
            Layout.fillWidth: true
            visible: root.variant === "full"
            height: 44
            radius: N.NeoConstants.radiusM
            color: helpMouse.containsMouse ? N.NeoConstants.bgApp : "transparent"

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 14
                anchors.rightMargin: 14
                spacing: 12
                Text { text: "❓"; font.pixelSize: 16 }
                Text {
                    text: root.mainLabel("Trợ giúp", "Help")
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                    color: N.NeoConstants.slate
                }
            }

            MouseArea {
                id: helpMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                enabled: !root.locked
                onClicked: root.helpRequested()
            }
        }
    }
}
