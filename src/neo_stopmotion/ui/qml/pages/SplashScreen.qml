import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N

Item {
    id: root
    signal finished()

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.background

        ColumnLayout {
            anchors.centerIn: parent
            spacing: N.NeoConstants.spacingL

            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "BBStopMotion"
                font.pixelSize: N.NeoConstants.fontTitle * 1.5
                font.bold: true
                color: N.NeoConstants.primary
            }

            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Trạm Làm Phim Hoạt Hình"
                font.pixelSize: N.NeoConstants.fontTitle
                font.bold: true
                color: N.NeoConstants.primary
            }

            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "NEO One"
                font.pixelSize: N.NeoConstants.fontBody
                color: N.NeoConstants.textSecondary
            }
        }
    }

    Timer {
        interval: 2000
        running: true
        onTriggered: root.finished()
    }
}
