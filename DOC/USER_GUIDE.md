<div align="center">
  <img src="../src/neo_stopmotion/resources/images/maker_viet_logo.png" width="120"/>

  # Hướng dẫn Sử dụng — Thợ Cả

  **BBStopMotion v1.0 · NEO One

  Tài liệu này dành cho Thợ Cả (mentor) vận hành trạm tại Làng Maker.
  Học sinh không cần đọc — chỉ cần biết bấm 2 nút.
</div>

---

## 1. Trạm gồm những gì?

```
                  ┌──────────────────────┐
                  │  Màn hình NEO One    │
                  │  (1280×800, fullscr) │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
   ┌────────▼─────────┐               ┌──────▼──────────┐
   │  USB Webcam       │               │  NEO One         │
   │  (chiếu xuống     │               │  (Linux ARM,     │
   │   sân khấu)       │               │   chạy app)      │
   └───────────────────┘               └──────▲───────────┘
                                                │ USB-Serial
                                       ┌──────┴──────────┐
                                       │  ThingBot board   │
                                       │  ┌──────┐ ┌─────┐ │
                                       │  │ IO1  │ │ IO2 │ │
                                       │  │ xanh │ │ đỏ  │ │
                                       │  └──────┘ └─────┘ │
                                       │   CHỤP    TẠO PHIM│
                                       └───────────────────┘

   ┌───────────────────────────────────────────────────────┐
   │  Sân khấu phim (60×60cm)                              │
   │  • Hộp A: hình học cho HS 6-9 tuổi                    │
   │  • Hộp B: vật liệu mở (gỗ, vải, pom-poms…) HS 10-14   │
   │  • 2 đèn LED 5500K chiếu sáng đều                     │
   └───────────────────────────────────────────────────────┘
```

## 2. 2 nút trên ThingBot

| Nút | Màu | Ý nghĩa | Phím tương đương |
|---|---|---|---|
| **IO1** | Xanh lá | Chụp 1 frame | `Space` |
| **IO2** | Đỏ | Tạo phim từ tất cả frame đã chụp | `Enter` |

Phím phụ trên bàn phím (Thợ Cả dùng nếu HS bấm sai):

| Phím | Hành động |
|---|---|
| `Z` | Xoá frame mới nhất (khi HS không hài lòng frame vừa chụp) |

## 3. Trải nghiệm đầy đủ 25-30 phút

### Phút 0-3: Đón tiếp HS

- Chào, hỏi tên + tuổi
- Chỉ Showcase Wall (TV phụ phát phim mẫu của bạn khác)
- Lật flipbook 20 trang để giải thích "nhiều ảnh tĩnh chiếu nhanh = chuyển động"

### Phút 3-5: Chọn vật liệu

- Hộp A (đơn giản) cho HS 6-9 tuổi
- Hộp B (mở) cho HS 10-14 tuổi
- Storyboard 4 ô giấy: bắt đầu → có chuyện → đỉnh điểm → kết thúc

### Phút 5-8: Sắp đặt sân khấu

- HS đặt nhân vật ở vị trí 1
- Thợ Cả kiểm tra ánh sáng (đủ sáng, không đổ bóng nhiễu)

### Phút 8-22: Quay phim (pha chính)

```
[HS sắp đặt] → [Bấm IO1 xanh] → [Frame mới + tiếng "tách"]
                 ↓
        [Onion skin: frame trước hiện mờ chồng lên]
                 ↓
        [HS dịch chuyển nhân vật một chút]
                 ↓
                 ↻ Lặp lại 30-50 lần
```

**Quy tắc Thợ Cả 70-30**: Hỏi 70%, giải thích 30%

> "Con đang muốn nhân vật làm gì tiếp theo nhỉ?"
> "Hình như bước này hơi xa, con thử nghĩ chia làm 2 frame nhỏ hơn không?"
> "Con thấy onion skin (cái bóng mờ) giúp con thế nào?"

### Phút 22-25: Tạo phim & xem lại

1. HS bấm **IO2 đỏ** (hoặc Thợ Cả bấm Enter)
2. Màn hình hiện **ExportingPage** với progress bar (~5-10s)
3. Chuyển sang **SuccessPage**:
   - Phim phát loop (có watermark BBStopMotion góc dưới phải)
   - QR code lớn để PH quét
   - URL phim trên cloud (catbox.moe)

### Phút 25-30: PH tải phim & mời quay lại

- PH dùng **iPhone Camera** hoặc **Zalo** quét QR
- Mở link trong trình duyệt → tải MP4 về điện thoại
- Đóng stamp Thẻ Hành Trình của HS
- Mời tuần sau quay lại làm phim 2 phần

### Làm phim kế tiếp

HS muốn làm phim mới? Có 2 cách:

1. **Bấm IO1 (xanh)** lần nữa — app tự động reset session, frame counter về 0, và chụp luôn frame đầu tiên của phim mới.
2. **Click nút "🔁 Làm phim mới"** trên SuccessPage.

Cả hai cách đều giữ phim cũ trong `~/projects/session_*/` (không xoá, có thể gửi lại link cũ).

## 4. Trước buổi (10 phút)

```
☐ Bật NEO One (chờ ~30s tới khi splash hiện)
☐ Cắm webcam USB → đợi live preview hiện trên màn hình
☐ Cắm ThingBot USB → banner xanh "Nút bấm sẵn sàng" hiện trong 2-4s
☐ Bật 2 đèn LED chiếu sáng sân khấu
☐ Sắp xếp 2 hộp vật liệu A/B đầy đủ
☐ Bật Showcase Wall (TV phụ phát loop phim mẫu)
☐ Chuẩn bị stamp + sổ ký Thẻ Hành Trình
```

## 5. Sau mỗi HS (3 phút)

```
☐ Click "Làm phim mới" hoặc bấm IO1 (app tự reset)
☐ Dọn vật liệu về hộp gốc
☐ Đóng stamp Thẻ Hành Trình
☐ Ghi sổ:
    - Tên HS, tuổi
    - SĐT phụ huynh (nếu có)
    - Link phim đã upload (copy từ SuccessPage)
    - Số frame đã chụp
```

## 6. Cuối ngày (10 phút)

```
☐ Đóng app: Cmd+Q (macOS) hoặc Alt+F4 (Linux)
☐ Tắt webcam, ThingBot
☐ Backup folder ~/projects/ qua USB nếu cần
☐ Báo cáo ngày: số HS, sự cố, feedback nổi bật
☐ Bổ sung vật liệu nếu thiếu
```

## 7. Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Live preview đen | Webcam chưa cấp quyền (macOS) | System Settings → Privacy → Camera → bật Terminal/Python |
| Webcam đen + log "synthetic" | Webcam không kết nối hoặc không cấp quyền | App tự fallback sang vân pattern test. Cắm lại USB + restart app |
| Banner amber "Nút bấm tạm nghỉ" | ThingBot rút USB | Cắm lại USB. Banner sẽ chuyển xanh sau 2-4s. Trong lúc đó dùng Space/Enter |
| Bấm IO1 không có gì xảy ra | Cửa sổ app mất focus | Click vào cửa sổ app trước, rồi thử lại |
| Nút "🎬 TẠO PHIM" mờ (disabled) | Chưa đủ 5 frame | Bấm IO1 thêm vài lần |
| Export báo lỗi "ffmpeg failed" | ffmpeg chưa cài hoặc binary sai path | `which ffmpeg` trên NEO One; sửa `ffmpeg_binary` trong `~/.config/neostopmotion/config.toml` |
| QR không quét được | catbox.moe block hoặc mất internet | URL vẫn lưu trong `~/projects/session_*/project.json` (`download_url`); copy ra điện thoại bằng tay |
| App đóng đột ngột giữa session | Crash (hiếm) | Frame đã chụp vẫn còn trong `~/projects/session_*/frames/`. Bật lại app, copy frames sang session mới rồi export |
| HS bấm IO1 quá nhanh, ra 2 frame y hệt | Bình thường (debounce 50+200ms) | Bấm Z xoá 1 frame trùng |
| Tiếng "tách" không nghe | Sound disabled hoặc volume 0 | `~/.config/neostopmotion/config.toml`: `[ui] sound_enabled = true`; check macOS/Linux volume |

## 8. Câu hỏi PH thường hỏi

**"Phim có nặng không, có tốn data Zalo nhà tôi không?"**
- MP4 ~200KB-2MB cho phim 5-10s. Tải qua 4G chỉ vài giây.

**"File phim có vĩnh viễn không?"**
- Có. catbox.moe lưu vô thời hạn. URL có thể chia sẻ lại bất cứ lúc nào.

**"Tôi muốn upload lên YouTube nhà tôi được không?"**
- Được. Tải MP4 về máy → upload thủ công lên kênh PH. (Phase 2 sẽ có auto-upload kênh chung BBStopMotion.)

**"Có phim mẫu nào cho tôi xem không?"**
- Có Showcase Wall (TV phụ) đang phát loop. Xem mục "Tham khảo" cuối tài liệu.

## 9. Tham khảo

- Spec gốc: `/Users/tuanln/Downloads/NEO_StopMotion_Tram6_Spec.md`
- Kiến trúc kỹ thuật: [ARCHITECTURE.md](ARCHITECTURE.md)
- Hướng dẫn hệ thống: [SYSTEM_GUIDE.md](SYSTEM_GUIDE.md)
- Animation Station Exploratorium: [youtube.com/user/AnimationStationBeta](https://www.youtube.com/user/AnimationStationBeta)
- Repo: [github.com/makerviet/NeoStopMotion](https://github.com/makerviet/NeoStopMotion)

---

> *"Chúng ta không chỉ làm một ứng dụng làm phim. Chúng ta đang trao cho một đứa trẻ 8 tuổi quyền lực kể câu chuyện của riêng mình bằng công nghệ."*

**BBStopMotion — 05/2026**
