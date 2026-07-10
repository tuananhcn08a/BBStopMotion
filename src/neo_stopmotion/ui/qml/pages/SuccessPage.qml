// SuccessPage.qml — T-BS30 → 2c "Thành công" (trong shell)
// Redline: assets/redline/2c-success.md
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtMultimedia
import "../singletons" as N

Item {
    id: root
    property string mp4Path: ""
    property string gifPath: ""
    property string shareUrl: ""
    property string qrPath: ""
    property bool uploadFailed: mp4Path !== "" && shareUrl === "" && N.AppState.autoUpload
    property bool uploadRetrying: false

    signal navigateToLibrary()

    function mainLabel(vi, en) {
        return N.AppState.language === "en" ? en : vi
    }
    function showSub() {
        return N.AppState.language === "vi+en"
    }
    // "(đến DD/M)" — ngày hết hạn lưu phim (redline 2c: "Phim lưu 7 ngày (đến 17/7)").
    // Không có mốc "uploaded_at" thật từ backend (catbox.moe không có expiry) nên tính
    // trực tiếp từ ngày hiện tại + 7, cùng cách format "DD/M" đã dùng ở LibraryPage.qml.
    function expiryDateLabel() {
        var d = new Date()
        d.setDate(d.getDate() + 7)
        return d.getDate() + "/" + (d.getMonth() + 1)
    }

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.bgApp
    }

    Item {
        anchors.fill: parent
        clip: true

        Text { text: "🎉"; font.pixelSize: 24; opacity: 0.7; x: parent.width * 0.12; y: 60 }
        Text { text: "🎊"; font.pixelSize: 22; opacity: 0.7; anchors.right: parent.right; anchors.rightMargin: parent.width * 0.16; y: 80 }

        ColumnLayout {
            anchors.centerIn: parent
            width: parent.width - 96
            spacing: 22

            ColumnLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 4

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.mainLabel("Phim của con xong rồi! 🌟", "Your movie is ready! 🌟")
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 38
                    font.weight: Font.ExtraBold
                    color: N.NeoConstants.navy
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    visible: root.showSub()
                    text: "Your movie is ready — " + N.AppState.frameCount + " frame · "
                        + N.AppState.durationDisplay + " · MP4 + GIF"
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 16
                    font.weight: Font.DemiBold
                    color: N.NeoConstants.slate
                }
            }

            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 24

                // ------------------------------------------------------
                // Video player 440x268
                // ------------------------------------------------------
                Rectangle {
                    Layout.preferredWidth: 440
                    Layout.preferredHeight: 268
                    radius: N.NeoConstants.radiusXXL
                    color: N.NeoConstants.previewBg
                    clip: true

                    MediaPlayer {
                        id: player
                        source: root.mp4Path !== "" ? "file://" + root.mp4Path : ""
                        videoOutput: vo
                        audioOutput: AudioOutput { volume: 0 }
                        loops: MediaPlayer.Infinite
                        onSourceChanged: if (root.mp4Path !== "") play()
                        Component.onCompleted: if (root.mp4Path !== "") play()
                    }
                    VideoOutput {
                        id: vo
                        anchors.fill: parent
                    }

                    Rectangle {
                        anchors.centerIn: parent
                        width: 70; height: 70; radius: 35
                        color: "#EBFFFFFF"
                        visible: player.playbackState !== MediaPlayer.PlayingState
                        Text { anchors.centerIn: parent; text: "▶"; font.pixelSize: 24; color: N.NeoConstants.brightPrimary }
                        MouseArea { anchors.fill: parent; onClicked: player.play() }
                    }

                    Rectangle {
                        anchors.bottom: parent.bottom
                        anchors.right: parent.right
                        anchors.margins: 10
                        height: 22
                        width: wmLabel.implicitWidth + 16
                        radius: N.NeoConstants.radiusS
                        color: N.NeoConstants.previewOverlay
                        Text {
                            id: wmLabel
                            anchors.centerIn: parent
                            text: "watermark BBStopMotion"
                            font.pixelSize: 11
                            color: N.NeoConstants.slateFaint
                        }
                    }
                }

                // ------------------------------------------------------
                // Card QR (hoặc banner upload-lỗi)
                // ------------------------------------------------------
                Rectangle {
                    Layout.preferredWidth: 290
                    Layout.alignment: Qt.AlignVCenter
                    visible: !root.uploadFailed
                    height: qrCardContent.implicitHeight + 40
                    radius: N.NeoConstants.radiusXXL
                    color: N.NeoConstants.surfaceCard
                    border.color: N.NeoConstants.borderCard
                    border.width: 1

                    ColumnLayout {
                        id: qrCardContent
                        anchors.centerIn: parent
                        width: parent.width - 40
                        spacing: 10

                        Rectangle {
                            Layout.alignment: Qt.AlignHCenter
                            width: 168; height: 168
                            radius: N.NeoConstants.radiusM
                            border.color: N.NeoConstants.borderCard
                            border.width: 1
                            color: "white"
                            visible: root.qrPath !== ""

                            Image {
                                anchors.fill: parent
                                anchors.margins: 8
                                source: root.qrPath !== "" ? "file://" + root.qrPath : ""
                                fillMode: Image.PreserveAspectFit
                                cache: false
                            }
                        }

                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            visible: root.qrPath === ""
                            text: "💾 " + root.mainLabel("Phim đã lưu trên máy", "Movie saved on this device")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 15
                            font.weight: Font.Bold
                            color: N.NeoConstants.slate
                        }

                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            visible: root.qrPath !== ""
                            text: root.mainLabel("Bố mẹ quét để tải phim 📱", "Ask a parent to scan & download 📱")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 15
                            font.weight: Font.ExtraBold
                            color: N.NeoConstants.navy
                            horizontalAlignment: Text.AlignHCenter
                            wrapMode: Text.WordWrap
                        }

                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            Layout.fillWidth: true
                            visible: root.qrPath !== ""
                            text: root.mainLabel(
                                "Phim lưu 7 ngày (đến " + root.expiryDateLabel() + "), chỉ ai có mã này mới tải được.",
                                "Saved for 7 days (until " + root.expiryDateLabel() + "); only people with this code can download it.")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 12
                            color: N.NeoConstants.slate
                            wrapMode: Text.WordWrap
                            horizontalAlignment: Text.AlignHCenter
                        }
                    }
                }

                // Upload-lỗi / chưa upload banner (thay Card QR — redline "State: Upload lỗi")
                Rectangle {
                    Layout.preferredWidth: 290
                    Layout.alignment: Qt.AlignVCenter
                    visible: root.uploadFailed
                    height: failCol.implicitHeight + 32
                    radius: N.NeoConstants.radiusXXL
                    color: N.NeoConstants.dangerBg
                    border.color: N.NeoConstants.dangerBorder
                    border.width: 1

                    ColumnLayout {
                        id: failCol
                        anchors.centerIn: parent
                        width: parent.width - 32
                        spacing: 12

                        Text {
                            Layout.fillWidth: true
                            text: N.AppState.autoUpload
                                ? root.mainLabel(
                                    "Tải lên chưa được — con vẫn có thể tải phim về máy nhé!",
                                    "Upload didn't work — you can still download the movie!")
                                : root.mainLabel(
                                    "Chưa tải lên — bấm nút bên dưới nếu con muốn có mã QR để chia sẻ",
                                    "Not uploaded yet — tap below if you'd like a QR code to share")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 14
                            font.weight: Font.Bold
                            color: N.NeoConstants.dangerRed
                            wrapMode: Text.WordWrap
                        }

                        Button {
                            id: retryBtn
                            Layout.fillWidth: true
                            height: 44
                            enabled: root.mp4Path !== "" && !root.uploadRetrying
                            background: Rectangle {
                                radius: N.NeoConstants.radiusM
                                color: retryBtn.hovered ? Qt.darker(N.NeoConstants.brightPrimary, 1.1) : N.NeoConstants.brightPrimary
                                opacity: retryBtn.enabled ? 1.0 : 0.5
                            }
                            contentItem: Text {
                                text: root.uploadRetrying
                                    ? root.mainLabel("Đang tải lên...", "Uploading...")
                                    : (N.AppState.autoUpload
                                        ? root.mainLabel("Thử tải lên lại", "Retry upload")
                                        : root.mainLabel("Tải lên ngay", "Upload now"))
                                font.family: N.NeoConstants.fontFamily
                                font.pixelSize: 14
                                font.weight: Font.Bold
                                color: "#FFFFFF"
                                horizontalAlignment: Text.AlignHCenter
                            }
                            onClicked: {
                                root.uploadRetrying = true
                                appController.retry_upload(root.mp4Path)
                            }
                        }
                    }
                }
            }

            // ----------------------------------------------------------
            // Action buttons
            // ----------------------------------------------------------
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 14

                Button {
                    id: downloadBtn
                    height: 54
                    enabled: root.mp4Path !== ""
                    background: Rectangle {
                        radius: N.NeoConstants.radiusFull
                        color: downloadBtn.hovered ? Qt.darker(N.NeoConstants.brightPrimary, 1.08) : N.NeoConstants.brightPrimary
                        opacity: downloadBtn.enabled ? 1.0 : 0.5
                    }
                    contentItem: Text {
                        text: root.mainLabel("⬇ Tải về máy · Download", "⬇ Download")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 16
                        font.weight: Font.ExtraBold
                        color: "#FFFFFF"
                        horizontalAlignment: Text.AlignHCenter
                    }
                    leftPadding: 38
                    rightPadding: 38
                    onClicked: _openSaveDialog()
                }

                Button {
                    id: newFilmBtn
                    height: 54
                    background: Rectangle {
                        radius: N.NeoConstants.radiusFull
                        color: newFilmBtn.hovered ? N.NeoConstants.primaryTint : "transparent"
                        border.color: N.NeoConstants.brightPrimary
                        border.width: 2
                    }
                    contentItem: Text {
                        text: root.mainLabel("🔁 Làm phim mới · New film", "🔁 New film")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 16
                        font.weight: Font.ExtraBold
                        color: N.NeoConstants.brightPrimary
                        horizontalAlignment: Text.AlignHCenter
                    }
                    leftPadding: 38
                    rightPadding: 38
                    onClicked: appController.reset_session()
                }
            }

            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.mainLabel(
                    "Bấm nút xanh 🟢 để bắt đầu phim mới ngay lập tức",
                    "Press the green 🟢 button to start a new film right away")
                font.family: N.NeoConstants.fontFamily
                font.pixelSize: 13
                font.weight: Font.DemiBold
                color: N.NeoConstants.slateMuted
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Keyboard shortcuts (giữ nguyên hành vi — TS-BS-32)
    // ---------------------------------------------------------------------------
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Space) {
            if (player.playbackState === MediaPlayer.PlayingState) player.pause()
            else player.play()
            event.accepted = true
        } else if (event.key === Qt.Key_S) {
            if (root.mp4Path !== "") _openSaveDialog()
            event.accepted = true
        } else if (event.key === Qt.Key_L) {
            if (root.shareUrl !== "") appController.copy_link(root.shareUrl)
            event.accepted = true
        } else if (event.key === Qt.Key_G) {
            root.navigateToLibrary()
            event.accepted = true
        } else if (event.key === Qt.Key_N || event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            appController.reset_session()
            event.accepted = true
        }
    }

    function _openSaveDialog() {
        appController.open_save_dialog(root.mp4Path)
    }

    Connections {
        target: signalBusBridge
        function onSaveVideoResult(success, message) {
            if (message === "__cancelled__" || message === "Đã sao chép link!") return
            saveToast.show(success, message)
        }
        function onShareUrlReady(url, qr) {
            root.uploadRetrying = false
            if (url !== "") {
                root.shareUrl = url
                root.qrPath = qr
                saveToast.show(true, root.mainLabel("Đã tải lên thành công!", "Uploaded successfully!"))
            } else {
                saveToast.show(false, root.mainLabel("Tải lên vẫn chưa được, con thử lại sau nhé!", "Upload still failed — try again later!"))
            }
        }
    }

    Rectangle {
        id: saveToast
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: N.NeoConstants.spacingL
        width: Math.min(toastMsg.implicitWidth + 32, 480)
        height: toastMsg.implicitHeight + 24
        radius: N.NeoConstants.radiusM
        color: _isError ? N.NeoConstants.dangerRed : N.NeoConstants.successText
        opacity: 0
        visible: opacity > 0

        property bool _isError: false
        property string _message: ""

        function show(success, msg) {
            _isError = !success
            _message = (success ? "✓  " : "⚠️  ") + msg
            opacity = 0.95
            toastHideTimer.interval = success ? 4000 : 6000
            toastHideTimer.restart()
        }

        Text {
            id: toastMsg
            anchors { left: parent.left; right: parent.right; verticalCenter: parent.verticalCenter; margins: 16 }
            text: saveToast._message
            font.family: N.NeoConstants.fontFamily
            font.pixelSize: N.NeoConstants.fontCaption
            font.weight: Font.Bold
            color: "#FFFFFF"
            wrapMode: Text.WrapAnywhere
        }

        Timer { id: toastHideTimer; onTriggered: saveToast.opacity = 0 }
        Behavior on opacity { NumberAnimation { duration: 200 } }
    }
}
