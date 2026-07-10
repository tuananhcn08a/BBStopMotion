// SettingsRow.qml — T-BS30, 1h Settings: 1 row trong Card list
// Redline: assets/redline/1h-settings.md §Card list
import QtQuick
import QtQuick.Layouts
import "../singletons" as N

ColumnLayout {
    id: root

    property string icon: ""
    property string title: ""
    property string description: ""
    property Item control
    property bool isLast: false

    spacing: 0

    onControlChanged: {
        if (control) {
            control.parent = controlHolder
            control.anchors.verticalCenter = controlHolder.verticalCenter
            control.anchors.right = controlHolder.right
        }
    }

    RowLayout {
        Layout.fillWidth: true
        Layout.preferredHeight: 64
        spacing: 14

        Rectangle {
            width: 38; height: 38
            radius: 11
            color: N.NeoConstants.primaryTint
            Text { anchors.centerIn: parent; text: root.icon; font.pixelSize: 17 }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 2
            Text {
                Layout.fillWidth: true
                text: root.title
                font.family: N.NeoConstants.fontFamily
                font.pixelSize: 15
                font.weight: Font.ExtraBold
                color: N.NeoConstants.navy
                elide: Text.ElideRight
            }
            Text {
                Layout.fillWidth: true
                text: root.description
                font.family: N.NeoConstants.fontFamily
                font.pixelSize: 12
                color: N.NeoConstants.slate
                elide: Text.ElideRight
            }
        }

        Item {
            id: controlHolder
            implicitWidth: root.control ? root.control.implicitWidth : 40
            implicitHeight: root.control ? root.control.implicitHeight : 34
            Layout.preferredWidth: implicitWidth
            Layout.preferredHeight: implicitHeight
            Layout.alignment: Qt.AlignVCenter
        }
    }

    Rectangle {
        Layout.fillWidth: true
        visible: !root.isLast
        height: 1
        color: N.NeoConstants.dividerLight
    }
}
