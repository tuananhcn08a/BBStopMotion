// ExportingPage.qml — T-BS30 → 2b "Đang xuất phim" (trong shell)
// Redline: assets/redline/2b-exporting.md
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N

Item {
    id: root
    property real progress: 0.0

    // Mapping tiến độ (redline 2b): MP4 0-40% → GIF 40-62% → upload 62-90% → QR 90-100%.
    // Khi autoUpload=false (F8/Q6b): chỉ còn 2 giai đoạn (Ghép MP4 → Tạo GIF).
    readonly property bool autoUpload: N.AppState.autoUpload
    readonly property real mp4End: autoUpload ? 0.40 : 0.55
    readonly property real gifEnd: autoUpload ? 0.62 : 1.0
    readonly property real uploadEnd: 0.90

    readonly property bool mp4Done: progress >= mp4End
    readonly property bool gifDone: progress >= gifEnd
    readonly property bool uploadDone: !autoUpload || progress >= uploadEnd
    readonly property bool qrDone: !autoUpload || progress >= 1.0

    function mainLabel(vi, en) {
        return N.AppState.language === "en" ? en : vi
    }
    function showSub() {
        return N.AppState.language === "vi+en"
    }

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.bgApp
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: N.NeoConstants.spacingL
        spacing: 16

        // ================================================================
        // Step indicator (2 — Xuất, active; sidebar opacity 0.55 khi export)
        // ================================================================
        RowLayout {
            spacing: 8

            Rectangle {
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.successBg
                border.color: N.NeoConstants.successBorder
                border.width: 1
                implicitWidth: step1Row.implicitWidth + 32
                implicitHeight: 36
                RowLayout {
                    id: step1Row
                    anchors.centerIn: parent
                    spacing: 8
                    Text {
                        text: root.mainLabel("✓ Chụp · " + N.AppState.frameCount + " frame",
                                              "✓ Capture · " + N.AppState.frameCount + " frames")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 14
                        font.weight: Font.Bold
                        color: N.NeoConstants.successText
                    }
                }
            }
            Text { text: "›"; font.pixelSize: 16; font.weight: Font.Bold; color: N.NeoConstants.slateFaint }

            Rectangle {
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.brightPrimary
                implicitWidth: step2Row.implicitWidth + 32
                implicitHeight: 36
                RowLayout {
                    id: step2Row
                    anchors.centerIn: parent
                    spacing: 8
                    Rectangle {
                        width: 20; height: 20; radius: N.NeoConstants.radiusFull
                        color: "#40FFFFFF"
                        Text { anchors.centerIn: parent; text: "2"; font.pixelSize: 12; color: "#FFFFFF"; font.weight: Font.Bold }
                    }
                    Text {
                        text: root.mainLabel("Xuất · Export", "Export")
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
        }

        // ================================================================
        // Card export — canh giữa
        // ================================================================
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            Rectangle {
                anchors.centerIn: parent
                width: 560
                height: cardContent.implicitHeight + 96
                radius: N.NeoConstants.radiusExportCard
                color: N.NeoConstants.surfaceCard
                border.color: N.NeoConstants.borderCard
                border.width: 1

                ColumnLayout {
                    id: cardContent
                    anchors.centerIn: parent
                    width: parent.width - 96
                    spacing: 0

                    Text {
                        Layout.alignment: Qt.AlignHCenter
                        text: "🎬"
                        font.pixelSize: 64
                    }

                    Text {
                        Layout.alignment: Qt.AlignHCenter
                        Layout.topMargin: 16
                        text: root.mainLabel("Đang ghép phim của con...", "Creating your movie...")
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 30
                        font.weight: Font.ExtraBold
                        color: N.NeoConstants.navy
                        horizontalAlignment: Text.AlignHCenter
                        wrapMode: Text.WordWrap
                    }

                    Text {
                        Layout.alignment: Qt.AlignHCenter
                        Layout.topMargin: 6
                        visible: root.showSub()
                        text: "Creating your movie — " + N.AppState.frameCount + " frame · MP4 + GIF"
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 15
                        font.weight: Font.DemiBold
                        color: N.NeoConstants.slate
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.topMargin: 28
                        height: 14
                        radius: N.NeoConstants.radiusFull
                        color: N.NeoConstants.primaryTint

                        Rectangle {
                            height: parent.height
                            radius: N.NeoConstants.radiusFull
                            color: N.NeoConstants.brightPrimary
                            width: parent.width * Math.max(0, Math.min(root.progress, 1.0))
                            Behavior on width { NumberAnimation { duration: 200 } }
                        }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        Layout.topMargin: 10

                        Text {
                            text: root.mp4Done ? root.mainLabel("✓ Ghép MP4", "✓ Compose MP4")
                                                : root.mainLabel("Ghép MP4", "Compose MP4")
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 12
                            font.weight: Font.Bold
                            color: root.mp4Done ? N.NeoConstants.successText
                                 : (!root.gifDone ? N.NeoConstants.brightPrimary : N.NeoConstants.slateMuted)
                        }
                        Item { Layout.fillWidth: true }
                        Text {
                            text: root.gifDone ? root.mainLabel("✓ Tạo GIF", "✓ Create GIF")
                                : (root.mp4Done ? root.mainLabel("● Tạo GIF...", "● Creating GIF...")
                                                 : root.mainLabel("Tạo GIF", "Create GIF"))
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 12
                            font.weight: Font.Bold
                            color: root.gifDone ? N.NeoConstants.successText
                                 : (root.mp4Done ? N.NeoConstants.brightPrimary : N.NeoConstants.slateMuted)
                        }
                        Item { Layout.fillWidth: true; visible: root.autoUpload }
                        Text {
                            visible: root.autoUpload
                            text: root.uploadDone ? root.mainLabel("✓ Tải lên cloud", "✓ Uploaded")
                                : (root.gifDone ? root.mainLabel("● Tải lên cloud...", "● Uploading...")
                                                 : root.mainLabel("Tải lên cloud", "Upload to cloud"))
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 12
                            font.weight: Font.Bold
                            color: root.uploadDone ? N.NeoConstants.successText
                                 : (root.gifDone ? N.NeoConstants.brightPrimary : N.NeoConstants.slateMuted)
                        }
                        Item { Layout.fillWidth: true; visible: root.autoUpload }
                        Text {
                            visible: root.autoUpload
                            text: root.qrDone ? root.mainLabel("✓ Tạo QR", "✓ Generate QR")
                                : (root.uploadDone ? root.mainLabel("● Tạo QR...", "● Generating QR...")
                                                     : root.mainLabel("Tạo QR", "Generate QR"))
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 12
                            font.weight: Font.Bold
                            color: root.qrDone ? N.NeoConstants.successText
                                 : (root.uploadDone ? N.NeoConstants.brightPrimary : N.NeoConstants.slateMuted)
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.topMargin: 24
                        height: warnRow.implicitHeight + 24
                        radius: N.NeoConstants.radiusM
                        color: N.NeoConstants.warnBg
                        border.color: N.NeoConstants.warnBorder
                        border.width: 1

                        RowLayout {
                            id: warnRow
                            anchors.centerIn: parent
                            width: parent.width - 32
                            Text {
                                Layout.fillWidth: true
                                text: root.mainLabel(
                                    "⏳ Chờ chút xíu nha, con đừng tắt màn hình nhé!",
                                    "⏳ Just a moment — please don't close this screen!")
                                font.family: N.NeoConstants.fontFamily
                                font.pixelSize: 14
                                font.weight: Font.Bold
                                color: N.NeoConstants.warnText
                                wrapMode: Text.WordWrap
                            }
                        }
                    }
                }
            }
        }
    }
}
