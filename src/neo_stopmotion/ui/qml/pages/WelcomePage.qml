// WelcomePage.qml — T-BS33 → 1d "Chào mừng" (Welcome, full-screen, KHÔNG sidebar)
// Redline: assets/redline/1d-welcome.md · Mockup: assets/mockups/1d-welcome.html
// Domain: F6 (`welcomeSeen`), TS-BS-17 (P0).
//
// welcomeSeen sống trong AppState (QML singleton, trong-bộ-nhớ) — KHÔNG ghi vào
// config.toml. Domain BR-27: "mặc định false mỗi lần mở app/reload; KHÔNG
// persist qua config — luôn hiện lại Welcome ở lần mở tiếp theo" (TS-BS-18).
//
// Redline note: mockup gốc khai canvas 1100x700 (khác 1280x820 của cửa sổ app
// thật) — 1d không có shadow-frame/canvas cố định, layout là flex
// column center nên tự nhiên co giãn theo kích thước cửa sổ thật mà KHÔNG cần
// stretch nội dung sang 1280x820 (xem "Design Learnings" trong redline).
import QtQuick
import QtQuick.Layouts
import "../singletons" as N

Item {
    id: root
    anchors.fill: parent
    focus: true

    // Bấm "Bắt đầu làm phim!" — MainWindow.qml set AppState.welcomeSeen = true.
    signal startRequested()

    function mainLabel(vi, en) {
        return N.AppState.language === "en" ? en : vi
    }

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.bgApp
    }

    // Emoji trang trí 4 góc (opacity 0.5, redline §Emoji trang trí)
    Text { text: "🎬"; font.pixelSize: 30; opacity: 0.5; x: 60; y: 40 }
    Text {
        text: "⭐"; font.pixelSize: 26; opacity: 0.5
        anchors.top: parent.top; anchors.right: parent.right
        anchors.topMargin: 90; anchors.rightMargin: 90
    }
    Text {
        text: "🎞️"; font.pixelSize: 26; opacity: 0.5
        anchors.bottom: parent.bottom; anchors.bottomMargin: 70
        x: 120
    }
    Text {
        text: "🤖"; font.pixelSize: 30; opacity: 0.5
        anchors.bottom: parent.bottom; anchors.right: parent.right
        anchors.bottomMargin: 100; anchors.rightMargin: 70
    }

    ColumnLayout {
        anchors.centerIn: parent
        spacing: 28
        width: Math.min(root.width - 80, 900)

        // ----------------------------------------------------------
        // Logo + wordmark
        // ----------------------------------------------------------
        Row {
            Layout.alignment: Qt.AlignHCenter
            spacing: 12

            Rectangle {
                width: 52; height: 52; radius: 15
                color: N.NeoConstants.brightPrimary
                anchors.verticalCenter: parent.verticalCenter
                Text {
                    anchors.centerIn: parent
                    text: "BB"
                    color: N.NeoConstants.white
                    font.family: N.NeoConstants.fontFamily
                    font.weight: Font.ExtraBold
                    font.pixelSize: 20
                }
            }

            Row {
                anchors.verticalCenter: parent.verticalCenter
                spacing: 0
                Text {
                    text: "BBStopMotion "
                    font.family: N.NeoConstants.fontFamily
                    font.weight: Font.ExtraBold
                    font.pixelSize: 30
                    color: N.NeoConstants.navy
                }
                Text {
                    text: "studio"
                    font.family: N.NeoConstants.fontFamily
                    font.weight: Font.ExtraBold
                    font.pixelSize: 30
                    color: N.NeoConstants.brightPrimary
                }
            }
        }

        // ----------------------------------------------------------
        // Tiêu đề + sub
        // ----------------------------------------------------------
        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.fillWidth: true
            spacing: 8

            Text {
                Layout.alignment: Qt.AlignHCenter
                Layout.fillWidth: true
                text: root.mainLabel("Chào mừng đến xưởng phim!", "Welcome to the animation studio!")
                font.family: N.NeoConstants.fontFamily
                font.weight: Font.ExtraBold
                font.pixelSize: 46
                lineHeight: 1.2
                color: N.NeoConstants.navy
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
            }
            Text {
                Layout.alignment: Qt.AlignHCenter
                Layout.fillWidth: true
                text: root.mainLabel(
                    "Welcome to the animation studio — hôm nay con sẽ tự tay làm một bộ phim hoạt hình.",
                    "Today you'll make your very own animated film, start to finish.")
                font.family: N.NeoConstants.fontFamily
                font.weight: Font.DemiBold
                font.pixelSize: 18
                color: N.NeoConstants.slate
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
            }
        }

        // ----------------------------------------------------------
        // 3 card bước
        // ----------------------------------------------------------
        Row {
            Layout.alignment: Qt.AlignHCenter
            spacing: 16

            Repeater {
                model: [
                    {
                        icon: "📷",
                        title: root.mainLabel("1 · Chụp", "1 · Shoot"),
                        desc: root.mainLabel(
                            "Sắp đặt nhân vật rồi chụp 30–50 tấm ảnh",
                            "Set up your characters, then shoot 30-50 photos"),
                    },
                    {
                        icon: "🎬",
                        title: root.mainLabel("2 · Xuất phim", "2 · Export"),
                        desc: root.mainLabel(
                            "App tự ghép ảnh thành phim MP4 + GIF",
                            "The app stitches your photos into an MP4 + GIF"),
                    },
                    {
                        icon: "📱",
                        title: root.mainLabel("3 · Chia sẻ", "3 · Share"),
                        desc: root.mainLabel(
                            "Bố mẹ quét QR để tải phim về điện thoại",
                            "Parents scan a QR code to download the film"),
                    },
                ]
                delegate: Rectangle {
                    width: 220
                    implicitHeight: stepCol.implicitHeight + 40
                    radius: N.NeoConstants.radiusXXL
                    color: N.NeoConstants.surfaceCard
                    border.color: N.NeoConstants.borderCard
                    border.width: 1

                    ColumnLayout {
                        id: stepCol
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.top: parent.top
                        anchors.margins: 20
                        spacing: 4

                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            text: modelData.icon
                            font.pixelSize: 34
                        }
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            Layout.topMargin: 8
                            text: modelData.title
                            font.family: N.NeoConstants.fontFamily
                            font.weight: Font.ExtraBold
                            font.pixelSize: 16
                            color: N.NeoConstants.navy
                        }
                        Text {
                            Layout.alignment: Qt.AlignHCenter
                            Layout.topMargin: 4
                            Layout.preferredWidth: 180
                            text: modelData.desc
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 13
                            color: N.NeoConstants.slate
                            horizontalAlignment: Text.AlignHCenter
                            wrapMode: Text.WordWrap
                        }
                    }
                }
            }
        }

        // ----------------------------------------------------------
        // CTA — nút Bắt đầu (+ xấp xỉ box-shadow bằng 1 rect mờ phía sau)
        // ----------------------------------------------------------
        Item {
            Layout.alignment: Qt.AlignHCenter
            implicitWidth: ctaButton.width
            implicitHeight: ctaButton.height + 6

            Rectangle {
                id: ctaShadowRect
                anchors.horizontalCenter: parent.horizontalCenter
                y: 6
                width: ctaButton.width
                height: ctaButton.height
                radius: height / 2
                color: N.NeoConstants.ctaShadow
            }

            Rectangle {
                id: ctaButton
                anchors.horizontalCenter: parent.horizontalCenter
                y: 0
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.brightPrimary
                implicitWidth: ctaLabel.implicitWidth + 112
                implicitHeight: ctaLabel.implicitHeight + 40

                Text {
                    id: ctaLabel
                    anchors.centerIn: parent
                    text: root.mainLabel("Bắt đầu làm phim! · Start 🚀", "Start making a movie! 🚀")
                    font.family: N.NeoConstants.fontFamily
                    font.weight: Font.ExtraBold
                    font.pixelSize: 22
                    color: N.NeoConstants.white
                }

                MouseArea {
                    id: ctaMouseArea
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.startRequested()
                }
            }
        }

        Text {
            Layout.alignment: Qt.AlignHCenter
            text: root.mainLabel(
                "Hoặc bấm nút xanh 🟢 trên bàn để bắt đầu ngay",
                "Or press the green button on the table to start right away")
            font.family: N.NeoConstants.fontFamily
            font.weight: Font.DemiBold
            font.pixelSize: 13
            color: N.NeoConstants.slateMuted
        }
    }

    // Bàn phím tiện dụng: Space/Enter cũng coi như bấm "Bắt đầu" (đồng nhất
    // hint "bấm nút xanh" — bàn phím là fallback không có ThingBot, xem
    // MainWindow.qml Keys.onPressed cho phím toàn cục ở các màn khác).
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Space || event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            root.startRequested()
            event.accepted = true
        }
    }
}
