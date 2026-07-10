// ToggleSwitch.qml — T-BS30, 1h Settings: toggle chuẩn 44x26px
// Redline: assets/redline/1h-settings.md §Toggle spec chung
import QtQuick
import "../singletons" as N

Rectangle {
    id: root
    property bool checked: false
    signal toggled(bool checked)

    implicitWidth: 44
    implicitHeight: 26
    radius: N.NeoConstants.radiusFull
    color: checked ? N.NeoConstants.brightPrimary : "#C4D2E5"
    Behavior on color { ColorAnimation { duration: N.NeoConstants.animFast } }

    Rectangle {
        width: 20; height: 20
        radius: N.NeoConstants.radiusFull
        color: "#FFFFFF"
        anchors.verticalCenter: parent.verticalCenter
        x: root.checked ? parent.width - width - 3 : 3
        Behavior on x { NumberAnimation { duration: N.NeoConstants.animFast } }
    }

    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: {
            root.checked = !root.checked
            root.toggled(root.checked)
        }
    }
}
