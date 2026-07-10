// LibraryPage.qml — T-BS30 → 1g "Thư viện phim" (Bright Studio, sidebar compact)
// Redline: assets/redline/1g-library.md
// GIỮ tính năng xoá phim (đã có trước redesign) — xác nhận 2 bước, không có
// trong redline hình ảnh nhưng task card yêu cầu GIỮ (không thoái lui UX).
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtMultimedia
import "../singletons" as N

Item {
    id: root
    focus: true

    signal navigateBack()

    property var sessions: []
    property bool isLoading: true
    property string errorMessage: ""
    property string searchText: ""
    property string activeFilter: "all"  // all | today | week

    property var qrEntry: null       // entry object shown in QR modal
    property var playEntry: null     // entry object shown in player modal
    property var deleteEntry: null   // entry pending delete confirmation
    property int deleteStep: 0       // 0=none 1=step1 2=step2

    function mainLabel(vi, en) {
        return N.AppState.language === "en" ? en : vi
    }

    Component.onCompleted: _loadSessions()
    Component.onDestruction: _stopPlayer()

    function _loadSessions() {
        isLoading = true
        errorMessage = ""
        var raw = []
        try {
            raw = appController.library_list_sessions()
        } catch (e) {
            errorMessage = "Không thể mở thư mục dự án. Kiểm tra lại cài đặt."
            isLoading = false
            return
        }
        sessions = raw || []
        isLoading = false
    }

    // Bỏ dấu tiếng Việt (đơn giản) để search không cần gõ dấu — UX đề xuất BA.
    function _stripAccents(s) {
        if (!s) return ""
        var map = [
            [/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a"], [/[èéẹẻẽêềếệểễ]/g, "e"],
            [/[ìíịỉĩ]/g, "i"], [/[òóọỏõôồốộổỗơờớợởỡ]/g, "o"],
            [/[ùúụủũưừứựửữ]/g, "u"], [/[ỳýỵỷỹ]/g, "y"], [/đ/g, "d"],
        ]
        var out = s.toLowerCase()
        for (var i = 0; i < map.length; i++) out = out.replace(map[i][0], map[i][1])
        return out
    }

    function _matchesSearch(entry) {
        if (root.searchText === "") return true
        return root._stripAccents(entry.title).indexOf(root._stripAccents(root.searchText)) !== -1
    }

    function _matchesFilter(entry) {
        if (root.activeFilter === "all") return true
        var created = new Date(entry.created_at)
        var now = new Date()
        if (root.activeFilter === "today") {
            return created.toDateString() === now.toDateString()
        }
        if (root.activeFilter === "week") {
            var weekMs = 7 * 24 * 60 * 60 * 1000
            return (now - created) <= weekMs && (now - created) >= 0
        }
        return true
    }

    readonly property var filteredSessions: sessions.filter(function(s) {
        return !s.is_error && root._matchesSearch(s) && root._matchesFilter(s)
    })

    Rectangle {
        anchors.fill: parent
        color: N.NeoConstants.bgApp
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 24
        anchors.leftMargin: 28
        anchors.rightMargin: 28
        spacing: 16

        // ================================================================
        // Search + filter
        // ================================================================
        RowLayout {
            Layout.fillWidth: true
            spacing: 14

            Rectangle {
                Layout.fillWidth: true
                height: 46
                radius: N.NeoConstants.radiusFull
                color: N.NeoConstants.surfaceCard
                border.color: N.NeoConstants.borderCard
                border.width: 1

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 18
                    anchors.rightMargin: 18
                    spacing: 10
                    Text { text: "🔍"; font.pixelSize: 15 }
                    TextInput {
                        id: searchInput
                        Layout.fillWidth: true
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 15
                        font.weight: Font.DemiBold
                        color: N.NeoConstants.navy
                        clip: true
                        onTextChanged: root.searchText = text

                        Text {
                            visible: searchInput.text === ""
                            text: root.mainLabel("Tìm phim theo tên...", "Search movies by name...")
                            font: searchInput.font
                            color: N.NeoConstants.slateMuted
                        }
                    }
                }
            }

            Repeater {
                model: [
                    { id: "all", vi: "Tất cả", en: "All" },
                    { id: "today", vi: "Hôm nay", en: "Today" },
                    { id: "week", vi: "Tuần này", en: "This week" },
                ]
                delegate: Rectangle {
                    readonly property bool isActive: root.activeFilter === modelData.id
                    height: 38
                    radius: N.NeoConstants.radiusFull
                    color: isActive ? N.NeoConstants.brightPrimary : N.NeoConstants.surfaceCard
                    border.color: isActive ? "transparent" : N.NeoConstants.borderCard
                    border.width: 1
                    width: filterLabel.implicitWidth + 32

                    Text {
                        id: filterLabel
                        anchors.centerIn: parent
                        text: root.mainLabel(modelData.vi, modelData.en)
                        font.family: N.NeoConstants.fontFamily
                        font.pixelSize: 13
                        font.weight: Font.Bold
                        color: isActive ? "#FFFFFF" : N.NeoConstants.slate
                    }
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.activeFilter = modelData.id
                    }
                }
            }
        }

        // ================================================================
        // Loading / error / empty
        // ================================================================
        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 60
            spacing: 12
            visible: isLoading
            BusyIndicator { Layout.alignment: Qt.AlignHCenter; running: true }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.mainLabel("Đang tải danh sách phim...", "Loading movies...")
                font.family: N.NeoConstants.fontFamily
                color: N.NeoConstants.slate
            }
        }

        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 60
            spacing: 12
            visible: !isLoading && errorMessage !== ""
            Text { Layout.alignment: Qt.AlignHCenter; text: "⚠️"; font.pixelSize: 44 }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: errorMessage
                font.family: N.NeoConstants.fontFamily
                color: N.NeoConstants.dangerRed
                font.weight: Font.Bold
            }
        }

        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.topMargin: 60
            spacing: 12
            visible: !isLoading && errorMessage === "" && filteredSessions.length === 0
            Text { Layout.alignment: Qt.AlignHCenter; text: "📽️"; font.pixelSize: 54 }
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.mainLabel("Chưa có phim nào.\nHãy làm phim đầu tiên nhé!",
                                      "No movies yet.\nMake your first film!")
                font.family: N.NeoConstants.fontFamily
                color: N.NeoConstants.slate
                horizontalAlignment: Text.AlignHCenter
            }
        }

        // ================================================================
        // Danh sách nhóm theo ngày
        // ================================================================
        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: !isLoading && errorMessage === "" && filteredSessions.length > 0
            clip: true

            ColumnLayout {
                width: parent.width
                spacing: 6

                Repeater {
                    model: root._groupedByDay(root.filteredSessions)
                    delegate: ColumnLayout {
                        Layout.fillWidth: true
                        Layout.topMargin: index === 0 ? 0 : 6
                        spacing: 10

                        Text {
                            text: modelData.header
                            font.family: N.NeoConstants.fontFamily
                            font.pixelSize: 12
                            font.weight: Font.ExtraBold
                            font.letterSpacing: 1.0
                            color: N.NeoConstants.slate
                        }

                        Repeater {
                            model: modelData.items
                            delegate: Rectangle {
                                Layout.fillWidth: true
                                height: 84
                                radius: N.NeoConstants.radiusL
                                color: N.NeoConstants.surfaceCard
                                border.color: N.NeoConstants.borderCard
                                border.width: 1

                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 12
                                    spacing: 16

                                    Rectangle {
                                        width: 96; height: 60
                                        radius: N.NeoConstants.radiusS
                                        color: N.NeoConstants.thumbBg
                                        clip: true
                                        Image {
                                            anchors.fill: parent
                                            visible: modelData.thumbnail_path !== ""
                                            source: modelData.thumbnail_path !== "" ? "file://" + modelData.thumbnail_path : ""
                                            fillMode: Image.PreserveAspectCrop
                                            cache: false
                                        }
                                        Text {
                                            anchors.centerIn: parent
                                            visible: modelData.thumbnail_path === ""
                                            text: "📽️"; font.pixelSize: 24
                                        }
                                    }

                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        spacing: 2
                                        Text {
                                            Layout.fillWidth: true
                                            text: modelData.title
                                            font.family: N.NeoConstants.fontFamily
                                            font.pixelSize: 16
                                            font.weight: Font.ExtraBold
                                            color: N.NeoConstants.navy
                                            elide: Text.ElideRight
                                        }
                                        Text {
                                            // "{N} frame · {N}s · {giờ}" (redline) — không lặp lại ngày
                                            // (đã có ở header nhóm); không có field "tên bé" trong dữ
                                            // liệu hiện có nên bỏ, xem báo cáo T-BS30.
                                            text: modelData.frame_count + " frame · " + modelData.duration_label
                                                + " · " + modelData.date_label.split(" · ")[1]
                                            font.family: N.NeoConstants.fontFamily
                                            font.pixelSize: 12
                                            color: N.NeoConstants.slate
                                        }
                                    }

                                    Rectangle {
                                        height: 26
                                        radius: N.NeoConstants.radiusFull
                                        color: modelData.download_url !== "" ? N.NeoConstants.successBg : N.NeoConstants.warnBg
                                        width: badgeLabel.implicitWidth + 24
                                        Text {
                                            id: badgeLabel
                                            anchors.centerIn: parent
                                            text: modelData.download_url !== ""
                                                ? root.mainLabel("✓ Đã tải lên", "✓ Uploaded")
                                                : root.mainLabel("⚠ Chưa tải lên", "⚠ Not uploaded")
                                            font.family: N.NeoConstants.fontFamily
                                            font.pixelSize: 12
                                            font.weight: Font.ExtraBold
                                            color: modelData.download_url !== "" ? N.NeoConstants.successText : N.NeoConstants.warnText
                                        }
                                    }

                                    Button {
                                        visible: modelData.download_url !== ""
                                        text: root.mainLabel("QR", "QR")
                                        font.family: N.NeoConstants.fontFamily
                                        font.pixelSize: 13
                                        font.weight: Font.Bold
                                        background: Rectangle {
                                            radius: N.NeoConstants.radiusS
                                            color: "transparent"
                                            border.color: N.NeoConstants.borderCard
                                            border.width: 1.5
                                        }
                                        contentItem: Text {
                                            text: parent.text; font: parent.font
                                            color: N.NeoConstants.brightPrimary
                                            horizontalAlignment: Text.AlignHCenter
                                        }
                                        onClicked: root.qrEntry = modelData
                                    }

                                    Button {
                                        visible: modelData.download_url === ""
                                        text: root.mainLabel("↻ Tải lên", "↻ Upload")
                                        font.family: N.NeoConstants.fontFamily
                                        font.pixelSize: 13
                                        font.weight: Font.Bold
                                        background: Rectangle {
                                            radius: N.NeoConstants.radiusS
                                            color: "transparent"
                                            border.color: N.NeoConstants.borderCard
                                            border.width: 1.5
                                        }
                                        contentItem: Text {
                                            text: parent.text; font: parent.font
                                            color: N.NeoConstants.brightPrimary
                                            horizontalAlignment: Text.AlignHCenter
                                        }
                                        onClicked: {
                                            appController.retry_upload(modelData.mp4_path)
                                            uploadToast.show(root.mainLabel(
                                                "Đang tải lên lại...", "Retrying upload..."))
                                        }
                                    }

                                    Button {
                                        text: root.mainLabel("▶ Xem", "▶ Play")
                                        font.family: N.NeoConstants.fontFamily
                                        font.pixelSize: 13
                                        font.weight: Font.Bold
                                        background: Rectangle { radius: N.NeoConstants.radiusS; color: N.NeoConstants.brightPrimary }
                                        contentItem: Text {
                                            text: parent.text; font: parent.font
                                            color: "#FFFFFF"
                                            horizontalAlignment: Text.AlignHCenter
                                        }
                                        onClicked: root.playEntry = modelData
                                    }

                                    // GIỮ xoá phim (icon-only, không có trong redline hình ảnh
                                    // nhưng task yêu cầu giữ tính năng — xác nhận 2 bước).
                                    Rectangle {
                                        width: 32; height: 32
                                        radius: N.NeoConstants.radiusS
                                        color: delMouse.containsMouse ? N.NeoConstants.dangerBg : "transparent"
                                        Text {
                                            anchors.centerIn: parent
                                            text: "🗑"
                                            font.pixelSize: 14
                                        }
                                        MouseArea {
                                            id: delMouse
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: { root.deleteEntry = modelData; root.deleteStep = 1 }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // "HÔM NAY · THỨ SÁU, 10/7" / "HÔM QUA · THỨ NĂM, 9/7" / "THỨ BA, 30/6" (redline 1g)
    function _dayHeaderVi(dateObj) {
        var days = ["CHỦ NHẬT", "THỨ HAI", "THỨ BA", "THỨ TƯ", "THỨ NĂM", "THỨ SÁU", "THỨ BẢY"]
        var daysEn = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        var now = new Date()
        var yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        var isToday = dateObj.toDateString() === now.toDateString()
        var isYesterday = dateObj.toDateString() === yesterday.toDateString()
        var dayName = root.mainLabel(days[dateObj.getDay()], daysEn[dateObj.getDay()])
        var dm = dateObj.getDate() + "/" + (dateObj.getMonth() + 1)
        if (isToday) return root.mainLabel("HÔM NAY", "TODAY") + " · " + dayName + ", " + dm
        if (isYesterday) return root.mainLabel("HÔM QUA", "YESTERDAY") + " · " + dayName + ", " + dm
        return dayName + ", " + dm
    }

    function _groupedByDay(list) {
        var groups = []
        var byKey = {}
        for (var i = 0; i < list.length; i++) {
            var entry = list[i]
            var d = new Date(entry.created_at)
            var key = d.toDateString()
            if (!byKey[key]) {
                byKey[key] = { header: root._dayHeaderVi(d), sortKey: d.getTime(), items: [] }
                groups.push(byKey[key])
            }
            byKey[key].items.push(entry)
        }
        groups.sort(function(a, b) { return b.sortKey - a.sortKey })
        return groups
    }

    // ------------------------------------------------------------------
    // QR modal (F7 — TS-BS-21)
    // ------------------------------------------------------------------
    Rectangle {
        anchors.fill: parent
        color: "#80101E33"
        visible: root.qrEntry !== null
        MouseArea { anchors.fill: parent; onClicked: root.qrEntry = null }

        Rectangle {
            anchors.centerIn: parent
            width: 320
            height: qrCol.implicitHeight + 40
            radius: N.NeoConstants.radiusXXL
            color: N.NeoConstants.surfaceCard

            ColumnLayout {
                id: qrCol
                anchors.centerIn: parent
                width: parent.width - 40
                spacing: 12

                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 200; height: 200
                    radius: N.NeoConstants.radiusM
                    border.color: N.NeoConstants.borderCard
                    border.width: 1
                    Image {
                        anchors.fill: parent
                        anchors.margins: 8
                        source: root.qrEntry ? "file://" + root.qrEntry.qr_path : ""
                        fillMode: Image.PreserveAspectFit
                        cache: false
                    }
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.qrEntry ? root.qrEntry.title : ""
                    font.family: N.NeoConstants.fontFamily
                    font.weight: Font.Bold
                    color: N.NeoConstants.navy
                }
                Button {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.mainLabel("Đóng", "Close")
                    onClicked: root.qrEntry = null
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Player modal
    // ------------------------------------------------------------------
    Rectangle {
        anchors.fill: parent
        color: "#80101E33"
        visible: root.playEntry !== null
        MouseArea { anchors.fill: parent; onClicked: { root._stopPlayer(); root.playEntry = null } }

        Rectangle {
            anchors.centerIn: parent
            width: 640; height: 420
            radius: N.NeoConstants.radiusXXL
            color: N.NeoConstants.previewBg
            clip: true

            MediaPlayer {
                id: videoPlayer
                source: root.playEntry ? "file://" + root.playEntry.mp4_path : ""
                videoOutput: videoOutput
                audioOutput: AudioOutput { volume: 0 }
                loops: MediaPlayer.Infinite
                onSourceChanged: if (root.playEntry) play()
            }
            VideoOutput { id: videoOutput; anchors.fill: parent }
        }
    }

    function _stopPlayer() {
        videoPlayer.stop()
        videoPlayer.source = ""
    }

    // ------------------------------------------------------------------
    // Delete confirm (2-step, GIỮ nguyên)
    // ------------------------------------------------------------------
    Rectangle {
        anchors.fill: parent
        color: "#80101E33"
        visible: root.deleteStep > 0

        Rectangle {
            anchors.centerIn: parent
            width: 420
            height: delCol.implicitHeight + 40
            radius: N.NeoConstants.radiusXXL
            color: N.NeoConstants.surfaceCard

            ColumnLayout {
                id: delCol
                anchors.centerIn: parent
                width: parent.width - 40
                spacing: 16

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.deleteStep === 1 ? "🗑️ " + root.mainLabel("Xoá phim này?", "Delete this movie?")
                                                 : "⚠️ " + root.mainLabel("Chắc chắn xoá?", "Are you sure?")
                    font.family: N.NeoConstants.fontFamily
                    font.pixelSize: 20
                    font.weight: Font.ExtraBold
                    color: root.deleteStep === 1 ? N.NeoConstants.navy : N.NeoConstants.dangerRed
                }
                Text {
                    Layout.alignment: Qt.AlignHCenter
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                    horizontalAlignment: Text.AlignHCenter
                    text: root.deleteStep === 1
                        ? root.mainLabel("Con có muốn xoá phim \"" + (root.deleteEntry ? root.deleteEntry.title : "") + "\" không?",
                                          "Do you want to delete \"" + (root.deleteEntry ? root.deleteEntry.title : "") + "\"?")
                        : root.mainLabel("Xoá phim này sẽ mất vĩnh viễn, không lấy lại được.",
                                          "This cannot be undone.")
                    font.family: N.NeoConstants.fontFamily
                    color: N.NeoConstants.slate
                }
                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 12
                    Button {
                        text: root.mainLabel("Thôi", "Cancel")
                        onClicked: { root.deleteStep = 0; root.deleteEntry = null }
                    }
                    Button {
                        text: root.deleteStep === 1 ? root.mainLabel("Xoá", "Delete") : root.mainLabel("Xoá thật", "Delete for good")
                        background: Rectangle { radius: N.NeoConstants.radiusS; color: N.NeoConstants.dangerRed }
                        contentItem: Text { text: parent.text; color: "#FFFFFF"; horizontalAlignment: Text.AlignHCenter }
                        onClicked: {
                            if (root.deleteStep === 1) {
                                root.deleteStep = 2
                            } else {
                                var sid = root.deleteEntry.session_id
                                var ok = appController.library_delete_session(sid)
                                root.deleteStep = 0
                                root.deleteEntry = null
                                if (ok) root._loadSessions()
                            }
                        }
                    }
                }
            }
        }
    }

    Rectangle {
        id: uploadToast
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: N.NeoConstants.spacingL
        width: uploadToastText.implicitWidth + 32
        height: 44
        radius: N.NeoConstants.radiusM
        color: N.NeoConstants.navy
        opacity: 0
        visible: opacity > 0
        property string _msg: ""
        function show(msg) { _msg = msg; opacity = 0.95; uploadToastTimer.restart() }
        Text {
            id: uploadToastText
            anchors.centerIn: parent
            text: uploadToast._msg
            color: "#FFFFFF"
            font.family: N.NeoConstants.fontFamily
        }
        Timer { id: uploadToastTimer; interval: 3000; onTriggered: uploadToast.opacity = 0 }
        Behavior on opacity { NumberAnimation { duration: 200 } }
    }

    Connections {
        target: signalBusBridge
        function onShareUrlReady(url, qr) {
            if (url !== "") {
                uploadToast.show(root.mainLabel("Đã tải lên! Làm mới danh sách...", "Uploaded! Refreshing list..."))
                root._loadSessions()
            } else {
                uploadToast.show(root.mainLabel("Tải lên vẫn chưa được.", "Upload still failed."))
            }
        }
    }

    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
            if (root.playEntry !== null) { root._stopPlayer(); root.playEntry = null }
            else if (root.qrEntry !== null) { root.qrEntry = null }
            else if (root.deleteStep > 0) { root.deleteStep = 0; root.deleteEntry = null }
            else { root.navigateBack() }
            event.accepted = true
        }
    }
}
