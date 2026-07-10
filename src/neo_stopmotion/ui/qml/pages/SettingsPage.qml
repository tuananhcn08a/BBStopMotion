// SettingsPage.qml — T-BS30 → 1h "Cài đặt" (net-new, Bright Studio sidebar compact)
// Redline: assets/redline/1h-settings.md
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N
import "../components"

Item {
    id: root
    focus: true

    signal navigateBack()

    function mainLabel(vi, en) {
        return N.AppState.language === "en" ? en : vi
    }

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.bgApp
    }

    ScrollView {
        id: settingsScroll
        anchors.fill: parent
        anchors.margins: 24
        anchors.leftMargin: 28
        anchors.rightMargin: 28
        clip: true
        // NOTE: ScrollView's implicit content Flickable defaults contentWidth to the
        // content's implicitWidth (contentChildrenWidth), NOT the viewport width. A
        // ColumnLayout child binding `width: parent.width` therefore sees the narrow
        // implicit width instead of the real viewport — cards inside collapse to their
        // narrowest row instead of filling the page (QA T-BS31, 1h-settings FAIL).
        // Fix: pin contentWidth to availableWidth so the viewport drives sizing, then
        // bind the ColumnLayout to that same width explicitly (not `parent.width`).
        contentWidth: availableWidth

        ColumnLayout {
            width: settingsScroll.availableWidth
            spacing: 14

            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                Text {
                    text: root.mainLabel("Cài đặt", "Settings")
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 24
                    font.weight: Font.ExtraBold
                    color: N.NeoConstants.navy
                }
                Text {
                    text: "· " + root.mainLabel("Settings (dành cho Thợ Cả)", "Settings (for the Studio Lead)")
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 14
                    font.weight: Font.Bold
                    color: N.NeoConstants.slate
                }
            }

            // ============================================================
            // Card 1 — Cấu hình chụp
            // ============================================================
            Rectangle {
                Layout.fillWidth: true
                Layout.topMargin: 4
                height: card1Col.implicitHeight + 12
                radius: N.NeoConstants.radiusXL
                color: N.NeoConstants.surfaceCard
                border.color: N.NeoConstants.borderCard
                border.width: 1

                ColumnLayout {
                    id: card1Col
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.margins: 20
                    anchors.topMargin: 6
                    anchors.bottomMargin: 6
                    spacing: 0

                    // ---- Camera ----
                    SettingsRow {
                        icon: "📷"
                        title: root.mainLabel("Camera", "Camera")
                        description: root.mainLabel("Chọn thiết bị camera đang dùng", "Choose the active camera device")
                        Layout.fillWidth: true

                        control: Rectangle {
                            radius: N.NeoConstants.radiusS
                            color: N.NeoConstants.bgApp
                            border.color: N.NeoConstants.borderCard
                            border.width: 1
                            implicitWidth: camLabel.implicitWidth + 28
                            implicitHeight: 34
                            Text {
                                id: camLabel
                                anchors.centerIn: parent
                                text: "Camera #" + appController.get_current_webcam_display_index() + " ▾"
                                font.family: N.NeoConstants.fontFamily
                                font.pixelSize: 13
                                font.weight: Font.Bold
                                color: N.NeoConstants.navy
                            }
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: cameraPicker.openPicker(appController.get_current_webcam_index())
                            }
                        }
                    }

                    // ---- Onion skin ----
                    SettingsRow {
                        icon: "👻"
                        title: root.mainLabel("Onion skin (bóng mờ)", "Onion skin")
                        description: root.mainLabel(
                            "Độ mờ frame trước chồng lên live preview",
                            "Opacity of the previous frame overlay")
                        Layout.fillWidth: true

                        control: RowLayout {
                            spacing: 10
                            Slider {
                                id: onionSlider
                                implicitWidth: 160
                                implicitHeight: 18
                                from: 0; to: 1.0
                                stepSize: 0.05
                                value: N.AppState.onionSkinOpacity
                                onMoved: {
                                    appController.set_onion_skin_opacity(value)
                                    N.AppState.onionSkinOpacity = value
                                    N.AppState.onionSkinEnabled = value > 0
                                }

                                // T-BS33: blue-ring knob custom (redline 1h — track
                                // 8px #E9F1FE, fill brightPrimary; knob 18x18 trắng
                                // viền 2px brightPrimary) thay cho handle xám mặc
                                // định Basic-style của QtQuick.Controls.
                                background: Rectangle {
                                    x: onionSlider.leftPadding
                                    y: onionSlider.topPadding + onionSlider.availableHeight / 2 - height / 2
                                    width: onionSlider.availableWidth
                                    height: 8
                                    radius: 4
                                    color: N.NeoConstants.primaryTint
                                    Rectangle {
                                        width: onionSlider.visualPosition * parent.width
                                        height: parent.height
                                        radius: 4
                                        color: N.NeoConstants.brightPrimary
                                    }
                                }
                                handle: Rectangle {
                                    x: onionSlider.leftPadding
                                        + onionSlider.visualPosition * (onionSlider.availableWidth - width)
                                    y: onionSlider.topPadding + onionSlider.availableHeight / 2 - height / 2
                                    width: 18; height: 18
                                    radius: 9
                                    color: N.NeoConstants.surfaceCard
                                    border.color: N.NeoConstants.brightPrimary
                                    border.width: 2
                                }
                            }
                            Text {
                                text: Math.round(onionSlider.value * 100) + "%"
                                font.family: N.NeoConstants.fontFamily
                                font.pixelSize: 13
                                font.weight: Font.ExtraBold
                                color: N.NeoConstants.navy
                                Layout.preferredWidth: 38
                            }
                        }
                    }

                    // ---- Tốc độ mặc định ----
                    SettingsRow {
                        icon: "🐇"
                        title: root.mainLabel("Tốc độ mặc định", "Default speed")
                        description: root.mainLabel("Áp dụng khi bắt đầu phiên mới", "Applied when a new session starts")
                        Layout.fillWidth: true

                        control: Row {
                            spacing: 2
                            Repeater {
                                model: [
                                    { label: "Cham", icon: "🐢" },
                                    { label: "Vua", icon: "🐇" },
                                    { label: "Nhanh", icon: "⚡" },
                                ]
                                delegate: Rectangle {
                                    readonly property bool isActive: N.AppState.defaultFpsLevel === modelData.label
                                    width: 44; height: 30
                                    radius: N.NeoConstants.radiusS
                                    color: isActive ? N.NeoConstants.brightPrimary : "transparent"
                                    Text {
                                        anchors.centerIn: parent
                                        text: modelData.icon
                                        font.pixelSize: 15
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: {
                                            appController.set_default_fps_level(modelData.label)
                                            N.AppState.defaultFpsLevel = modelData.label
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ---- Ngôn ngữ ----
                    SettingsRow {
                        icon: "🌐"
                        title: root.mainLabel("Ngôn ngữ · Language", "Language")
                        description: root.mainLabel(
                            "Hiển thị song ngữ hoặc một ngôn ngữ", "Show bilingual or a single language")
                        Layout.fillWidth: true

                        control: Row {
                            spacing: 2
                            Repeater {
                                model: [
                                    { value: "vi+en", vi: "Việt+EN" },
                                    { value: "vi", vi: "Tiếng Việt" },
                                    { value: "en", vi: "English" },
                                ]
                                delegate: Rectangle {
                                    readonly property bool isActive: N.AppState.language === modelData.value
                                    height: 30
                                    width: langLabel.implicitWidth + 20
                                    radius: N.NeoConstants.radiusS
                                    color: isActive ? N.NeoConstants.brightPrimary : "transparent"
                                    Text {
                                        id: langLabel
                                        anchors.centerIn: parent
                                        text: modelData.vi
                                        font.family: N.NeoConstants.fontFamily
                                        font.pixelSize: 12
                                        font.weight: Font.Bold
                                        color: isActive ? N.NeoConstants.white : N.NeoConstants.slate
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: {
                                            appController.set_language(modelData.value)
                                            N.AppState.language = modelData.value
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ---- Âm "tách" ----
                    SettingsRow {
                        icon: "🔊"
                        title: root.mainLabel('Âm thanh "tách" khi chụp', "Shutter sound on capture")
                        description: root.mainLabel('Shutter sound on capture', 'Plays a click sound on capture')
                        Layout.fillWidth: true
                        isLast: true

                        control: ToggleSwitch {
                            checked: N.AppState.soundEnabled
                            onToggled: {
                                appController.set_sound_enabled(checked)
                                N.AppState.soundEnabled = checked
                            }
                        }
                    }

                    // ---- Mục tiêu frame ----
                    SettingsRow {
                        icon: "🎯"
                        title: root.mainLabel("Mục tiêu frame", "Frame goal")
                        description: root.mainLabel(
                            "Số frame gợi ý để phim đủ mượt", "Suggested frame count for a smooth film")
                        Layout.fillWidth: true
                        isLast: true

                        control: Rectangle {
                            radius: N.NeoConstants.radiusS
                            color: N.NeoConstants.bgApp
                            border.color: N.NeoConstants.borderCard
                            border.width: 1
                            implicitWidth: goalLabel.implicitWidth + 28
                            implicitHeight: 34

                            Text {
                                id: goalLabel
                                anchors.centerIn: parent
                                text: N.AppState.goalFrames + " frame ▾"
                                font.family: N.NeoConstants.fontFamily
                                font.pixelSize: 13
                                font.weight: Font.Bold
                                color: N.NeoConstants.navy
                            }
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: goalMenu.open()
                            }
                            Menu {
                                id: goalMenu
                                y: parent.height + 4
                                Repeater {
                                    model: N.NeoConstants.goalFramesOptions
                                    delegate: MenuItem {
                                        text: modelData + " frame"
                                        onTriggered: {
                                            appController.set_goal_frames(modelData)
                                            N.AppState.goalFrames = modelData
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ============================================================
            // Card 2 — Hệ thống
            // ============================================================
            Rectangle {
                Layout.fillWidth: true
                Layout.topMargin: 4
                Layout.bottomMargin: 24
                height: card2Col.implicitHeight + 12
                radius: N.NeoConstants.radiusXL
                color: N.NeoConstants.surfaceCard
                border.color: N.NeoConstants.borderCard
                border.width: 1

                ColumnLayout {
                    id: card2Col
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.margins: 20
                    anchors.topMargin: 6
                    anchors.bottomMargin: 6
                    spacing: 0

                    SettingsRow {
                        icon: "☁️"
                        title: root.mainLabel("Tải lên cloud tự động", "Auto-upload to cloud")
                        description: root.mainLabel(
                            "Auto-upload + tạo QR sau khi xuất phim", "Auto-upload + generate QR after export")
                        Layout.fillWidth: true

                        control: ToggleSwitch {
                            checked: N.AppState.autoUpload
                            onToggled: {
                                appController.set_auto_upload(checked)
                                N.AppState.autoUpload = checked
                            }
                        }
                    }

                    SettingsRow {
                        icon: "🔌"
                        title: root.mainLabel("Nút ThingBot", "ThingBot button")
                        description: root.mainLabel(
                            "IO1 🟢 chụp frame · IO2 🔴 tạo phim", "IO1 🟢 capture · IO2 🔴 export")
                        Layout.fillWidth: true
                        isLast: true

                        control: Rectangle {
                            radius: N.NeoConstants.radiusFull
                            color: N.AppState.uartConnected ? N.NeoConstants.successBg : N.NeoConstants.warnBg
                            implicitWidth: thingbotBadge.implicitWidth + 24
                            implicitHeight: 26
                            Text {
                                id: thingbotBadge
                                anchors.centerIn: parent
                                text: N.AppState.uartConnected
                                    ? root.mainLabel("● Đã kết nối", "● Connected")
                                    : root.mainLabel("⚠ Chưa kết nối", "⚠ Not connected")
                                font.family: N.NeoConstants.fontFamily
                                font.pixelSize: 12
                                font.weight: Font.ExtraBold
                                color: N.AppState.uartConnected ? N.NeoConstants.successText : N.NeoConstants.warnText
                            }
                        }
                    }
                }
            }
        }
    }

    CameraPickerPopup {
        id: cameraPicker
        onCameraConfirmed: function(index) { }
        onCancelled: { }
    }

    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
            root.navigateBack()
            event.accepted = true
        }
    }
}
