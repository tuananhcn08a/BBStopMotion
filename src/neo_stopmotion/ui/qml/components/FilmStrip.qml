// FilmStrip.qml — T-BS30 → 2a filmstrip (redline: assets/redline/2a-capture.md §Filmstrip)
// F1: xoá frame bất kỳ — hover thumbnail bất kỳ → viền đỏ + nút × 22px, xoá NGAY
// (không confirm, đồng nhất BR-05). Giữ phím tắt cũ (◀▶ chọn, Del xoá) — TS-BS-32.
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N

Rectangle {
    id: root

    // List of file:// paths (with cache-busting suffix) — set from CapturePage
    property var framePaths: []

    // Currently selected index (1-based; 0 = nothing selected) — bàn phím ◀▶/Del.
    property int selectedIndex: 0
    readonly property int currentSelectedIndex: selectedIndex

    // Xoá tương tác được không (khoá lúc đang xem lại / EXPORTING — F1 edge case)
    property bool interactive: true

    signal deleteRequested(int frameIndex)  // 1-based index — xoá NGAY, không confirm (F1)

    radius: N.NeoConstants.radiusL
    color: N.NeoConstants.surfaceCard
    border.width: 1
    border.color: N.NeoConstants.borderCard

    function refresh() {
        root.framePaths = appController.get_frame_paths()
    }

    Keys.onLeftPressed: { if (selectedIndex > 1) selectedIndex -= 1 }
    Keys.onRightPressed: { if (selectedIndex < framePaths.length) selectedIndex += 1 }
    Keys.onDeletePressed: { if (selectedIndex > 0 && root.interactive) root.deleteRequested(selectedIndex) }
    Keys.onEscapePressed: { selectedIndex = 0 }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 14
        spacing: 8

        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Text {
                text: N.AppState.language === "vi" ? "CÁC FRAME ĐÃ CHỤP"
                    : N.AppState.language === "en" ? "CAPTURED FRAMES"
                    : "CÁC FRAME ĐÃ CHỤP · CAPTURED FRAMES"
                font.family: N.NeoConstants.fontFamily
                font.pixelSize: 12
                font.weight: Font.ExtraBold
                font.letterSpacing: 0.9
                color: N.NeoConstants.slate
            }

            Item { Layout.fillWidth: true }

            Text {
                text: N.AppState.language === "en" ? "Hover a frame to preview or delete it"
                    : "Rê chuột lên frame để xem lại hoặc xoá frame bất kỳ"
                font.family: N.NeoConstants.fontFamily
                font.pixelSize: 12
                color: N.NeoConstants.slateMuted
            }
        }

        Text {
            visible: root.framePaths.length === 0
            text: N.AppState.language === "en" ? "Take your first frame!" : "Chụp tấm đầu tiên đi!"
            font.family: N.NeoConstants.fontFamily
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.slateMuted
        }

        ListView {
            id: listView
            visible: root.framePaths.length > 0
            Layout.fillWidth: true
            Layout.preferredHeight: 76

            orientation: ListView.Horizontal
            spacing: 8
            clip: true
            model: root.framePaths

            onCountChanged: if (count > 0) positionViewAtEnd()

            ScrollBar.horizontal: ScrollBar {
                height: 4
                policy: ScrollBar.AsNeeded
            }

            delegate: Item {
                id: thumbItem
                required property string modelData
                required property int index

                readonly property int frameNum: index + 1
                readonly property bool isNewest: frameNum === root.framePaths.length
                readonly property bool isSelected: root.selectedIndex === frameNum

                width: 96
                height: 76

                Rectangle {
                    id: thumbContainer
                    width: 96
                    height: 60
                    radius: N.NeoConstants.radiusS
                    color: N.NeoConstants.thumbBg
                    clip: true

                    border.width: thumbItem.isNewest ? 3 : (thumbItem.isSelected ? 2 : 0)
                    border.color: thumbItem.isNewest ? N.NeoConstants.brightPrimary : N.NeoConstants.brightPrimary

                    Image {
                        anchors.fill: parent
                        anchors.margins: thumbItem.isNewest ? 3 : (thumbItem.isSelected ? 2 : 0)
                        source: thumbItem.modelData
                        fillMode: Image.PreserveAspectCrop
                        asynchronous: true
                        cache: false
                        smooth: true
                    }

                    // Frame index chip (bottom-left)
                    Rectangle {
                        anchors.left: parent.left
                        anchors.bottom: parent.bottom
                        anchors.margins: 4
                        height: 16
                        width: idxLabel.implicitWidth + 12
                        radius: 5
                        color: thumbItem.isNewest ? N.NeoConstants.brightPrimary : N.NeoConstants.previewOverlay
                        Text {
                            id: idxLabel
                            anchors.centerIn: parent
                            text: thumbItem.frameNum
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 10
                            font.weight: Font.ExtraBold
                            color: "#FFFFFF"
                        }
                    }

                    // Hover delete overlay (F1) — viền đỏ + nút × 22px
                    Rectangle {
                        anchors.fill: parent
                        visible: thumbMouse.containsMouse && root.interactive
                        color: "transparent"
                        border.width: 2
                        border.color: N.NeoConstants.dangerRed
                        radius: N.NeoConstants.radiusS
                    }

                    Rectangle {
                        visible: thumbMouse.containsMouse && root.interactive
                        anchors.top: parent.top
                        anchors.right: parent.right
                        anchors.topMargin: -6
                        anchors.rightMargin: -6
                        width: 22; height: 22
                        radius: N.NeoConstants.radiusFull
                        color: N.NeoConstants.dangerRed
                        Text {
                            anchors.centerIn: parent
                            text: "×"
                            font.pixelSize: 13
                            font.weight: Font.ExtraBold
                            color: "#FFFFFF"
                        }
                        MouseArea {
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.deleteRequested(thumbItem.frameNum)  // xoá NGAY (F1)
                        }
                    }
                }

                MouseArea {
                    id: thumbMouse
                    anchors.fill: thumbContainer
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    enabled: root.interactive
                    onClicked: {
                        root.selectedIndex = thumbItem.frameNum
                        root.forceActiveFocus()
                    }
                }
            }

            footer: Rectangle {
                visible: root.interactive
                width: 96; height: 60
                radius: N.NeoConstants.radiusS
                color: "transparent"
                border.width: 2
                border.color: N.NeoConstants.slateFaint
                Column {
                    anchors.centerIn: parent
                    spacing: 0
                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: "+"
                        font.pixelSize: 18
                        font.weight: Font.ExtraBold
                        color: N.NeoConstants.slateMuted
                    }
                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: (root.framePaths.length + 1).toString()
                        font.pixelSize: 10
                        font.weight: Font.Bold
                        color: N.NeoConstants.slateMuted
                    }
                }
            }
        }
    }
}
