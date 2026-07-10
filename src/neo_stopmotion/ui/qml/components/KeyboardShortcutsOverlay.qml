// KeyboardShortcutsOverlay.qml — T-011: Overlay phím tắt toàn app (?/F1)
// Đóng bằng Esc hoặc ?
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../singletons" as N

Popup {
    id: root

    anchors.centerIn: Overlay.overlay
    width: 700
    height: 580
    modal: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    Overlay.modal: Rectangle {
        color: "#99000000"
    }

    background: Rectangle {
        color: N.NeoConstants.surface
        radius: 20
        border.color: N.NeoConstants.primary
        border.width: 2
    }

    enter: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: N.NeoConstants.animFast }
        NumberAnimation { property: "scale"; from: 0.92; to: 1.0; duration: N.NeoConstants.animFast }
    }
    exit: Transition {
        NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 150 }
    }

    contentItem: FocusScope {
        id: contentScope

        Keys.onEscapePressed: function(event) {
            root.close()
            event.accepted = true
        }
        Keys.onPressed: function(event) {
            if (event.key === Qt.Key_Question) {
                root.close()
                event.accepted = true
            }
        }

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: N.NeoConstants.spacingL
            spacing: N.NeoConstants.spacingM

            // Header
            RowLayout {
                Layout.fillWidth: true

                Text {
                    text: "⌨️ Phím tắt"
                    font.pixelSize: N.NeoConstants.fontBody
                    font.bold: true
                    color: N.NeoConstants.textPrimary
                    Layout.fillWidth: true
                }

                Button {
                    text: "✕ Đóng"
                    width: 90
                    height: 36
                    font.pixelSize: N.NeoConstants.fontCaption
                    onClicked: root.close()
                    background: Rectangle {
                        radius: 8
                        color: parent.hovered ? "#CCCCCC" : "#E0E0E0"
                    }
                    contentItem: Text {
                        text: parent.text
                        font: parent.font
                        color: N.NeoConstants.textPrimary
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                }
            }

            // Divider
            Rectangle {
                Layout.fillWidth: true
                height: 1
                color: "#E0E0E0"
            }

            // Shortcut table — scroll if needed
            ScrollView {
                Layout.fillWidth: true
                Layout.fillHeight: true
                clip: true

                ColumnLayout {
                    width: parent.width
                    spacing: N.NeoConstants.spacingM

                    // --- Section: 3 phím cốt lõi ---
                    SectionHeader { sectionTitle: "3 Phím cốt lõi (cũng là nút vật lý IO)" }

                    ShortcutRow { keys: "Space"; description: "Chụp ảnh"; tag: "IO1" }
                    ShortcutRow { keys: "Del"; description: "Xoá tấm (đang chọn → xoá tấm đó; không chọn → xoá tấm cuối)"; tag: "IO2" }
                    ShortcutRow { keys: "Enter"; description: "Tạo phim (cần ≥5 tấm)"; tag: "IO3" }

                    // --- Section: CapturePage ---
                    SectionHeader { sectionTitle: "Màn Chụp ảnh" }

                    ShortcutRow { keys: "◀  ▶"; description: "Chọn tấm trong filmstrip" }
                    ShortcutRow { keys: "Esc"; description: "Bỏ chọn tấm / đóng popup / thoát xem lại" }
                    ShortcutRow { keys: "C"; description: "Mở popup đổi camera" }
                    ShortcutRow { keys: "G"; description: "Xem thư viện phim" }
                    ShortcutRow { keys: "P"; description: "Xem lại phim (flipbook các frame đã chụp)" }
                    ShortcutRow { keys: "1  2  3"; description: "Tốc độ Chậm / Vừa / Nhanh" }
                    ShortcutRow { keys: "?  F1"; description: "Mở / đóng overlay phím tắt này" }

                    // --- Section: Popup chọn camera ---
                    SectionHeader { sectionTitle: "Popup Chọn camera" }

                    ShortcutRow { keys: "◀  ▶"; description: "Đổi sang máy trước / tiếp" }
                    ShortcutRow { keys: "1 – 6"; description: "Chọn nhanh camera theo số" }
                    ShortcutRow { keys: "Enter"; description: "Xác nhận chọn camera này" }
                    ShortcutRow { keys: "Esc"; description: "Huỷ, giữ camera hiện tại" }

                    // --- Section: Dialog xác nhận xoá ---
                    SectionHeader { sectionTitle: "Hộp thoại Xác nhận xoá" }

                    ShortcutRow { keys: "Esc"; description: "Thôi để lại (mặc định)" }
                    ShortcutRow { keys: "Enter  Del"; description: "Xoá tấm này" }

                    // --- Section: Màn Phim đã xong ---
                    SectionHeader { sectionTitle: "Màn Phim đã xong" }

                    ShortcutRow { keys: "Space"; description: "Phát / tạm dừng phim" }
                    ShortcutRow { keys: "S"; description: "Lưu video" }
                    ShortcutRow { keys: "L"; description: "Sao chép link chia sẻ" }
                    ShortcutRow { keys: "G"; description: "Xem thư viện phim" }
                    ShortcutRow { keys: "N  Enter"; description: "Làm phim mới" }

                    // Bottom spacer
                    Item { height: N.NeoConstants.spacingS }
                }
            }

            // Footer hint
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: "Nhấn Esc hoặc ? để đóng"
                font.pixelSize: N.NeoConstants.fontCaption
                color: N.NeoConstants.textSecondary
                font.italic: true
            }
        }
    }

    onOpened: contentScope.forceActiveFocus()

    // ---------------------------------------------------------------------------
    // Internal helper components
    // ---------------------------------------------------------------------------

    component SectionHeader: Rectangle {
        required property string sectionTitle
        Layout.fillWidth: true
        height: 32
        color: "#F2EAD8"
        radius: 6

        Text {
            anchors.verticalCenter: parent.verticalCenter
            anchors.left: parent.left
            anchors.leftMargin: N.NeoConstants.spacingM
            text: sectionTitle
            font.pixelSize: N.NeoConstants.fontCaption
            font.bold: true
            color: N.NeoConstants.textPrimary
        }
    }

    component ShortcutRow: RowLayout {
        required property string keys
        property string description: ""
        property string tag: ""
        Layout.fillWidth: true
        spacing: N.NeoConstants.spacingM

        // Key badge(s)
        Rectangle {
            width: 120
            height: 30
            radius: 6
            color: "#F5F5F5"
            border.color: "#D0C8B0"
            border.width: 1

            Text {
                anchors.centerIn: parent
                text: keys
                font.pixelSize: 13
                font.bold: true
                font.family: "monospace"
                color: "#7a6200"
            }
        }

        // IO tag (optional)
        Rectangle {
            visible: tag !== ""
            width: tag !== "" ? 36 : 0
            height: 22
            radius: 5
            color: "#212121"

            Text {
                anchors.centerIn: parent
                text: tag
                font.pixelSize: 11
                font.bold: true
                color: "#FFFFFF"
            }
        }

        // Description
        Text {
            Layout.fillWidth: true
            text: description
            font.pixelSize: N.NeoConstants.fontCaption
            color: N.NeoConstants.textPrimary
            wrapMode: Text.WordWrap
        }
    }
}
