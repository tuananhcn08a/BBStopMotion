// CapturePage.qml — T-BS30 → 2a "Chụp frame" (Bright Studio full sidebar-shell)
// Redline: assets/redline/2a-capture.md
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N
import "../components"

Item {
    id: root
    focus: true

    signal navigateToLibrary()

    // "Xem lại phim" (P) — chạy lại các frame đã chụp như 1 vòng lặp trong
    // vùng preview; TẮT nút CHỤP + onion skin trong lúc xem lại (redline).
    property bool reviewing: false
    property int reviewIndex: 0

    function openShortcuts() { shortcutsOverlay.open() }
    function flashCapture() { preview.flash() }

    function mainLabel(vi, en) {
        return N.AppState.language === "en" ? en : vi
    }
    function showSub() {
        return N.AppState.language === "vi+en"
    }

    Component.onCompleted: {
        N.AppState.webcamReady = true
        filmStrip.refresh()
        _applyOnionLive()
    }

    function _applyOnionLive() {
        var v = N.AppState.onionSkinEnabled ? N.AppState.onionSkinOpacity : 0.0
        appController.set_live_onion_opacity(v)
    }

    function _toggleReview() {
        if (N.AppState.frameCount === 0) return
        root.reviewing = !root.reviewing
        if (root.reviewing) {
            root.reviewIndex = 0
            reviewTimer.start()
        } else {
            reviewTimer.stop()
        }
    }

    Timer {
        id: reviewTimer
        interval: {
            var fps = appController.get_selected_fps()
            return fps > 0 ? Math.round(1000 / fps) : 125
        }
        repeat: true
        onTriggered: {
            var n = filmStrip.framePaths.length
            if (n === 0) { root.reviewing = false; return }
            root.reviewIndex = (root.reviewIndex + 1) % n
        }
    }

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.bgApp
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: 24
        anchors.bottomMargin: 24
        anchors.leftMargin: 28
        anchors.rightMargin: 28
        spacing: 16

        // ================================================================
        // Step indicator + Onion skin toggle
        // ================================================================
        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Rectangle {
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.brightPrimary
                implicitWidth: step1Row.implicitWidth + 32
                implicitHeight: 36
                RowLayout {
                    id: step1Row
                    anchors.centerIn: parent
                    spacing: 8
                    Rectangle {
                        width: 20; height: 20; radius: N.NeoConstants.radiusFull
                        color: "#40FFFFFF"
                        Text { anchors.centerIn: parent; text: "1"; font.pixelSize: 12; color: "#FFFFFF"; font.weight: Font.Bold }
                    }
                    Text {
                        text: root.mainLabel("Chụp · Capture", "Capture")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 14
                        font.weight: Font.Bold
                        color: "#FFFFFF"
                    }
                }
            }
            Text { text: "›"; font.pixelSize: 16; font.weight: Font.Bold; color: N.NeoConstants.slateFaint }

            Rectangle {
                radius: N.NeoConstants.radiusFull
                color: "transparent"
                border.color: N.NeoConstants.borderCard
                border.width: 1
                implicitWidth: step2Row.implicitWidth + 32
                implicitHeight: 36
                RowLayout {
                    id: step2Row
                    anchors.centerIn: parent
                    spacing: 8
                    Text {
                        text: root.mainLabel("2 Xuất · Export", "2 Export")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 14
                        font.weight: Font.Bold
                        color: N.NeoConstants.slate
                    }
                }
            }
            Text { text: "›"; font.pixelSize: 16; font.weight: Font.Bold; color: N.NeoConstants.slateFaint }

            Rectangle {
                radius: N.NeoConstants.radiusFull
                color: "transparent"
                border.color: N.NeoConstants.borderCard
                border.width: 1
                implicitWidth: step3Row.implicitWidth + 32
                implicitHeight: 36
                RowLayout {
                    id: step3Row
                    anchors.centerIn: parent
                    spacing: 8
                    Text {
                        text: root.mainLabel("3 Chia sẻ · Share", "3 Share")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 14
                        font.weight: Font.Bold
                        color: N.NeoConstants.slate
                    }
                }
            }

            Item { Layout.fillWidth: true }

            // Onion skin toggle
            Rectangle {
                radius: N.NeoConstants.radiusFull
                color: "transparent"
                border.color: N.NeoConstants.borderCard
                border.width: 1
                implicitWidth: onionRow.implicitWidth + 28
                implicitHeight: 36

                RowLayout {
                    id: onionRow
                    anchors.centerIn: parent
                    spacing: 8
                    Text {
                        text: "👻 " + root.mainLabel("Onion skin", "Onion skin")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 13
                        font.weight: Font.Bold
                        color: N.NeoConstants.navy
                    }
                    Rectangle {
                        width: 34; height: 20; radius: N.NeoConstants.radiusFull
                        color: N.AppState.onionSkinEnabled ? N.NeoConstants.brightPrimary : "#C4D2E5"
                        Rectangle {
                            width: 16; height: 16; radius: N.NeoConstants.radiusFull
                            color: "#FFFFFF"
                            anchors.verticalCenter: parent.verticalCenter
                            x: N.AppState.onionSkinEnabled ? parent.width - width - 2 : 2
                            Behavior on x { NumberAnimation { duration: N.NeoConstants.animFast } }
                        }
                    }
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        N.AppState.onionSkinEnabled = !N.AppState.onionSkinEnabled
                        root._applyOnionLive()
                    }
                }
            }
        }

        // ================================================================
        // Camera preview
        // ================================================================
        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 380
            radius: N.NeoConstants.radiusXL
            color: N.NeoConstants.previewBg
            clip: true

            LivePreview {
                id: preview
                anchors.fill: parent
                visible: !root.reviewing
            }

            // "Xem lại phim" — flipbook loop qua các frame đã chụp
            Image {
                anchors.fill: parent
                visible: root.reviewing && filmStrip.framePaths.length > 0
                source: (root.reviewing && filmStrip.framePaths.length > 0)
                    ? filmStrip.framePaths[root.reviewIndex] : ""
                fillMode: Image.PreserveAspectFit
                cache: false
                asynchronous: true
            }

            // LIVE badge (top-left)
            Rectangle {
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.margins: 16
                visible: !root.reviewing
                height: 30
                width: liveBadgeRow.implicitWidth + 20
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.previewOverlay

                RowLayout {
                    id: liveBadgeRow
                    anchors.centerIn: parent
                    spacing: 8
                    Rectangle {
                        width: 8; height: 8; radius: 4
                        color: N.NeoConstants.liveDot
                        SequentialAnimation on opacity {
                            running: true
                            loops: Animation.Infinite
                            NumberAnimation { to: 0.3; duration: 550 }
                            NumberAnimation { to: 1.0; duration: 550 }
                        }
                    }
                    Text {
                        text: "LIVE"
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 13
                        font.weight: Font.ExtraBold
                        font.letterSpacing: 0.8
                        color: "#FFFFFF"
                    }
                }
            }

            Rectangle {
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.margins: 16
                visible: root.reviewing
                height: 30
                width: reviewBadgeRow.implicitWidth + 20
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.previewOverlay
                RowLayout {
                    id: reviewBadgeRow
                    anchors.centerIn: parent
                    spacing: 8
                    Text {
                        text: "▶ " + root.mainLabel("Xem lại", "Preview")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 13
                        font.weight: Font.ExtraBold
                        color: "#FFFFFF"
                    }
                }
            }

            // Frame counter chip (top-right)
            Rectangle {
                anchors.top: parent.top
                anchors.right: parent.right
                anchors.margins: 16
                height: 46
                width: frameCounterCol.implicitWidth + 32
                radius: N.NeoConstants.radiusM
                color: N.NeoConstants.previewOverlay

                ColumnLayout {
                    id: frameCounterCol
                    anchors.centerIn: parent
                    spacing: 0
                    Text {
                        Layout.alignment: Qt.AlignHCenter
                        text: N.AppState.frameCount
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 22
                        font.weight: Font.ExtraBold
                        color: "#FFFFFF"
                    }
                    Text {
                        Layout.alignment: Qt.AlignHCenter
                        text: root.mainLabel("FRAME", "FRAME") + " · ≈ " + N.AppState.durationDisplay
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 9
                        font.weight: Font.ExtraBold
                        font.letterSpacing: 1.0
                        color: N.NeoConstants.slateFaint
                    }
                }
            }

            // Hint (bottom-centre)
            Rectangle {
                anchors.bottom: parent.bottom
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.bottomMargin: 14
                visible: !root.reviewing
                height: 32
                width: hintRow.implicitWidth + 28
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.previewOverlay

                RowLayout {
                    id: hintRow
                    anchors.centerIn: parent
                    spacing: 8
                    Text {
                        text: root.mainLabel("Bấm", "Press")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        color: "#C9D8EE"
                    }
                    Rectangle {
                        width: spaceKbd.implicitWidth + 14; height: 20; radius: 6
                        color: "#FFFFFF"
                        Text { id: spaceKbd; anchors.centerIn: parent; text: "Space"; font.pixelSize: 11; font.weight: Font.ExtraBold; color: N.NeoConstants.navy }
                    }
                    Text {
                        text: root.mainLabel("hoặc nút xanh 🟢 để chụp", "or the green 🟢 button")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                        color: "#C9D8EE"
                    }
                }
            }
        }

        // ================================================================
        // Hàng điều khiển — Card Tốc độ | Nút CHỤP | Cột hành động
        // ================================================================
        RowLayout {
            Layout.fillWidth: true
            spacing: 16

            // ---- Card Tốc độ ----
            Rectangle {
                Layout.preferredWidth: 240
                Layout.fillHeight: true
                radius: N.NeoConstants.radiusL
                color: N.NeoConstants.surfaceCard
                border.color: N.NeoConstants.borderCard
                border.width: 1

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 8

                    Text {
                        text: root.mainLabel("TỐC ĐỘ", "SPEED")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 11
                        font.weight: Font.ExtraBold
                        font.letterSpacing: 1.0
                        color: N.NeoConstants.slate
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        spacing: 6

                        Repeater {
                            id: speedBtns
                            model: [
                                { label: "Cham", fps: 5, icon: "🐢", key: "1", vi: "Chậm", en: "Slow" },
                                { label: "Vua",  fps: 8, icon: "🐇", key: "2", vi: "Thường", en: "Normal" },
                                { label: "Nhanh",fps: 12,icon: "⚡", key: "3", vi: "Nhanh", en: "Fast" },
                            ]

                            delegate: Rectangle {
                                id: speedSegItem
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                readonly property bool isActive: N.AppState.selectedSpeedLabel === modelData.label
                                radius: N.NeoConstants.radiusM
                                color: isActive ? N.NeoConstants.primaryTint : N.NeoConstants.surfaceCard
                                border.width: isActive ? 1.5 : 1
                                border.color: isActive ? N.NeoConstants.brightPrimary : N.NeoConstants.borderCard

                                Column {
                                    anchors.centerIn: parent
                                    spacing: 1
                                    Text {
                                        anchors.horizontalCenter: parent.horizontalCenter
                                        text: modelData.icon + " " + root.mainLabel(modelData.vi, modelData.en)
                                        font.family: N.NeoConstants.fontFamily
                                        font.pixelSize: 12
                                        font.weight: speedSegItem.isActive ? Font.ExtraBold : Font.Bold
                                        color: speedSegItem.isActive ? N.NeoConstants.brightPrimary : N.NeoConstants.slate
                                    }
                                    Text {
                                        anchors.horizontalCenter: parent.horizontalCenter
                                        text: modelData.fps + " fps · " + root.mainLabel("phím", "key") + " " + modelData.key
                                        font.family: N.NeoConstants.fontFamily
                                        font.pixelSize: 9
                                        color: speedSegItem.isActive ? N.NeoConstants.primaryTintText : N.NeoConstants.slateMuted
                                    }
                                }

                                MouseArea {
                                    anchors.fill: parent
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: {
                                        appController.select_speed(modelData.label)
                                        N.AppState.selectedSpeedLabel = modelData.label
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ---- Nút CHỤP ----
            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 8

                Item { Layout.fillHeight: true }

                Rectangle {
                    id: shootBtn
                    Layout.alignment: Qt.AlignHCenter
                    width: 92; height: 92
                    radius: N.NeoConstants.radiusFull
                    color: N.NeoConstants.accentCapture
                    border.width: 6
                    border.color: N.NeoConstants.accentCaptureRing
                    opacity: root.reviewing ? 0.4 : 1.0
                    scale: shootMouse.pressed ? 0.94 : 1.0
                    Behavior on scale { NumberAnimation { duration: 80; easing.type: Easing.OutQuad } }

                    Text {
                        anchors.centerIn: parent
                        text: "📷"
                        font.pixelSize: 34
                    }

                    MouseArea {
                        id: shootMouse
                        anchors.fill: parent
                        enabled: !root.reviewing
                        cursorShape: Qt.PointingHandCursor
                        onClicked: appController.handle_uart_command("SHOOT")
                    }
                }

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.mainLabel("CHỤP", "CHỤP") + " · " + root.mainLabel("Snap", "Snap")
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 18
                    font.weight: Font.ExtraBold
                    color: N.NeoConstants.navy
                }

                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 6
                    Text {
                        text: root.mainLabel("hoặc nút xanh IO1 🟢", "or the green IO1 🟢 button")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 12
                        color: N.NeoConstants.slate
                    }
                    Rectangle {
                        width: spaceKbd2.implicitWidth + 14; height: 20; radius: 6
                        color: N.NeoConstants.surfaceCard
                        border.color: N.NeoConstants.borderCard
                        border.width: 1
                        Text { id: spaceKbd2; anchors.centerIn: parent; text: "Space"; font.pixelSize: 11; font.weight: Font.ExtraBold; color: N.NeoConstants.navy }
                    }
                }

                Item { Layout.fillHeight: true }
            }

            // ---- Cột hành động ----
            ColumnLayout {
                Layout.preferredWidth: 250
                Layout.fillHeight: true
                spacing: 8

                // Xem lại phim — P
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 44
                    radius: N.NeoConstants.radiusM
                    color: reviewBtnMouse.containsMouse ? N.NeoConstants.bgApp : N.NeoConstants.surfaceCard
                    border.color: N.NeoConstants.borderCard
                    border.width: 1
                    opacity: N.AppState.frameCount > 0 ? 1.0 : 0.5

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 14
                        anchors.rightMargin: 14
                        Text {
                            Layout.fillWidth: true
                            text: (root.reviewing ? "⏸ " : "▶ ") + root.mainLabel("Xem lại phim", "Play")
                                + " · " + root.mainLabel("Play", "Play")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 14
                            font.weight: Font.Bold
                            color: N.NeoConstants.navy
                        }
                        Rectangle {
                            width: pKbd.implicitWidth + 12; height: 20; radius: 6
                            color: N.NeoConstants.bgApp
                            Text { id: pKbd; anchors.centerIn: parent; text: "P"; font.pixelSize: 11; font.weight: Font.ExtraBold; color: N.NeoConstants.slate }
                        }
                    }
                    MouseArea {
                        id: reviewBtnMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        enabled: N.AppState.frameCount > 0
                        onClicked: root._toggleReview()
                    }
                }

                // Xoá frame cuối — Del (F1: xoá NGAY, không confirm)
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 44
                    radius: N.NeoConstants.radiusM
                    color: undoBtnMouse.containsMouse ? N.NeoConstants.bgApp : N.NeoConstants.surfaceCard
                    border.color: N.NeoConstants.borderCard
                    border.width: 1
                    opacity: (N.AppState.frameCount > 0 && !root.reviewing) ? 1.0 : 0.5

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 14
                        anchors.rightMargin: 14
                        Text {
                            Layout.fillWidth: true
                            text: "🗑 " + root.mainLabel("Xoá frame cuối", "Undo") + " · " + root.mainLabel("Undo", "Undo")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 14
                            font.weight: Font.Bold
                            color: N.NeoConstants.navy
                        }
                        Rectangle {
                            width: delKbd.implicitWidth + 12; height: 20; radius: 6
                            color: N.NeoConstants.bgApp
                            Text { id: delKbd; anchors.centerIn: parent; text: "Del"; font.pixelSize: 11; font.weight: Font.ExtraBold; color: N.NeoConstants.slate }
                        }
                    }
                    MouseArea {
                        id: undoBtnMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        enabled: N.AppState.frameCount > 0 && !root.reviewing
                        onClicked: root._smartDelete()
                    }
                }

                Item { Layout.fillHeight: true }

                // Xuất phim! — Enter (primary)
                Rectangle {
                    id: exportBtn
                    Layout.fillWidth: true
                    Layout.preferredHeight: 52
                    radius: N.NeoConstants.radiusM
                    readonly property bool canExport: N.AppState.frameCount >= N.NeoConstants.minFrames
                    color: canExport ? N.NeoConstants.brightPrimary : N.NeoConstants.slateFaint
                    opacity: canExport ? 1.0 : 0.5

                    RowLayout {
                        anchors.centerIn: parent
                        spacing: 10
                        Text {
                            text: "🎬 " + root.mainLabel("Xuất phim!", "Export!") + " · " + root.mainLabel("Export", "Export")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 15
                            font.weight: Font.ExtraBold
                            color: "#FFFFFF"
                        }
                        Rectangle {
                            width: enterKbd.implicitWidth + 12; height: 20; radius: 6
                            color: "#33FFFFFF"
                            Text { id: enterKbd; anchors.centerIn: parent; text: "Enter"; font.pixelSize: 11; font.weight: Font.ExtraBold; color: "#FFFFFF" }
                        }
                    }
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: appController.handle_uart_command("EXPORT")

                        ToolTip.visible: containsMouse && !exportBtn.canExport
                        ToolTip.text: root.mainLabel(
                            "Cần ít nhất " + N.NeoConstants.minFrames + " frame",
                            "Need at least " + N.NeoConstants.minFrames + " frames")
                        hoverEnabled: true
                    }
                }
            }
        }

        // ================================================================
        // Filmstrip
        // ================================================================
        FilmStrip {
            id: filmStrip
            Layout.fillWidth: true
            Layout.preferredHeight: 112
            interactive: !root.reviewing

            onDeleteRequested: function(frameIndex) {
                appController.handle_delete_frame(frameIndex)  // F1: xoá NGAY, không confirm
            }
        }
    }

    // ====================================================================
    // Keyboard shortcuts (giữ nguyên hành vi bàn phím — TS-BS-32)
    // ====================================================================
    function _smartDelete() {
        var idx = filmStrip.selectedIndex
        appController.delete_frame_smart(idx)
    }

    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Space) {
            if (!root.reviewing) appController.handle_uart_command("SHOOT")
            event.accepted = true
        } else if (event.key === Qt.Key_Delete) {
            if (!root.reviewing) root._smartDelete()
            event.accepted = true
        } else if (event.key === Qt.Key_Escape) {
            if (root.reviewing) { root.reviewing = false; reviewTimer.stop() }
            else if (cameraPicker.visible) { /* handled by picker's own Esc */ }
            else { filmStrip.selectedIndex = 0 }
            event.accepted = true
        } else if (event.key === Qt.Key_C) {
            if (!cameraPicker.visible) {
                cameraPicker.openPicker(appController.get_current_webcam_index())
                event.accepted = true
            }
        } else if (event.key === Qt.Key_G) {
            if (!cameraPicker.visible) {
                root.navigateToLibrary()
                event.accepted = true
            }
        } else if (event.key === Qt.Key_1) {
            appController.select_speed("Cham"); N.AppState.selectedSpeedLabel = "Cham"
            event.accepted = true
        } else if (event.key === Qt.Key_2) {
            appController.select_speed("Vua"); N.AppState.selectedSpeedLabel = "Vua"
            event.accepted = true
        } else if (event.key === Qt.Key_3) {
            appController.select_speed("Nhanh"); N.AppState.selectedSpeedLabel = "Nhanh"
            event.accepted = true
        } else if (event.key === Qt.Key_P) {
            root._toggleReview()
            event.accepted = true
        } else if (event.key === Qt.Key_Question || event.key === Qt.Key_F1) {
            if (shortcutsOverlay.visible) shortcutsOverlay.close()
            else shortcutsOverlay.open()
            event.accepted = true
        } else if (event.key === Qt.Key_Left) {
            if (filmStrip.selectedIndex > 1) filmStrip.selectedIndex -= 1
            else if (N.AppState.frameCount > 0) filmStrip.selectedIndex = 1
            event.accepted = true
        } else if (event.key === Qt.Key_Right) {
            if (filmStrip.selectedIndex < N.AppState.frameCount) filmStrip.selectedIndex += 1
            event.accepted = true
        }
    }

    CameraPickerPopup {
        id: cameraPicker
        onCameraConfirmed: function(index) { }
        onCancelled: { }
    }

    KeyboardShortcutsOverlay {
        id: shortcutsOverlay
    }

    // ====================================================================
    // Connections — refresh filmstrip on events
    // ====================================================================
    Connections {
        target: appController
        function onFrameCountChanged(n) {
            filmStrip.refresh()
            if (filmStrip.selectedIndex > n) filmStrip.selectedIndex = 0
            if (n === 0) { root.reviewing = false; reviewTimer.stop() }
        }
    }

    Connections {
        target: signalBusBridge
        function onFrameDeleted(newCount) {
            filmStrip.selectedIndex = 0
            filmStrip.refresh()
        }
        function onFrameUndone(newCount) {
            filmStrip.selectedIndex = 0
            filmStrip.refresh()
        }
        function onWebcamReady() {
            N.AppState.previewCounter++
        }
    }
}
