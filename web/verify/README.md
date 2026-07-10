# Visual Diff Gate — `web/verify/`

Harness verify thị giác cho BBStopMotion (T-BS03), tái lập triết lý **miwiz**:

1. **Chụp bản chạy THẬT** — Chrome thật (web), cửa sổ Qt thật (`grabWindow()`, desktop),
   `xcrun simctl io screenshot` (iPhone). **Không** render server-side, **không** ghép/composite ảnh giả.
2. **Đo hình học từng phần tử**, không "cảm giác": web đo bằng DOM `getBoundingClientRect()` +
   `getComputedStyle()` (chính xác nhất — đo được cả 2 phía mockup lẫn app); QML/iPhone chỉ có ảnh
   nên đo bằng **pixel-scan biên/màu** trong một `searchBox` khai trước.
3. Sinh **bảng lệch** `element | mockup | app | Δ | PASS?` + **overlay.png** (mockup | app cạnh nhau,
   cùng chiều rộng) + **exit code** (0 = mọi Δ PASS, 1 = có FAIL).
4. **Chuẩn hoá theo chiều rộng**: nếu app được chụp ở độ rộng khác mockup (QML window khác 1280px,
   iPhone screenshot @3x…), toạ độ đo được của app được nhân với `scale = mockupWidth / appWidth`
   trước khi so — không bao giờ so trực tiếp 2 hệ độ phân giải khác nhau.
5. **Người đo (QA) ≠ người code implement màn đó** — harness chỉ là công cụ, không thay việc QA chạy
   độc lập (xem `docs/02-architecture/working-modes-policy.md` §Mô hình vận hành v2 §B).

Ngưỡng mặc định: **Δ ≤ 2px** cho `--platform web` (khung cố định, đo DOM chính xác), **Δ ≤ 4px** cho
`--platform qml|ios` (ảnh + pixel-scan có sai số lấy mẫu). Override bằng `--threshold <px>`.

## Quy ước landmark (bắt buộc để đo được)

Phần tử cần đo phải mang `data-landmark="ten-landmark"` trong cả mockup HTML (T-BS02) lẫn app implement
(T-BS10 web). Mockup và app **phải dùng chung tên landmark** để harness so khớp được. Ví dụ:

```html
<div data-landmark="sidebar-nav">...</div>
<button data-landmark="capture-btn">...</button>
```

Không sửa được DOM (vd đo nguyên khối)? Dùng `--selectors sel.json`:
```json
{ "capture-btn": "#app button.capture" }
```

Với QML/iPhone (ảnh, không DOM): khai `--landmarks landmarks.json` — mỗi landmark có `searchBox`
(vùng tìm sơ bộ, px thật trên ảnh) + `color` (hex) + `tolerance` (dung sai/kênh RGB, mặc định 24).
Xem ví dụ: `fixtures/landmarks-image-example.json`.

## Cách chạy — nền WEB

App cũng là DOM → đo cả 2 bên bằng DOM, chính xác nhất, không cần landmarks.json riêng.

```bash
cd neo-stopmotion/web
npm install                      # đảm bảo puppeteer-core + pngjs sẵn sàng
npm run dev                      # (terminal khác) chạy app tại http://localhost:5173

node verify/gate.mjs \
  --screen 2a --platform web \
  --mockup <path/hoặc/url mockup T-BS02, vd file:///.../mockups/2a-capture.html> \
  --app-url http://localhost:5173 \
  --viewport 1280x820 \
  --threshold 2 \
  --out-dir verify/.out/2a-web
```

Kết quả: `verify/.out/2a-web/{report.md, overlay.png, mockup.png, app.png}` + exit code.
`--mockup`/`--app-url` chấp nhận cả URL đầy đủ (`file://`, `http://`) lẫn đường dẫn tương đối trần
(tự quy về `file://` tuyệt đối) — tiện gõ trong npm script.

## Cách chạy — nền QML / NEO One (desktop)

1. Chụp cửa sổ app THẬT (real Qt render, không phải ảnh dựng):
   ```bash
   cd neo-stopmotion
   source .venv/bin/activate        # venv đã `pip install -e .`
   web/verify/grab-qml.sh /tmp/qml-2a.png 3500
   # CI không màn hình: NEO_STOPMOTION_GRAB_HEADLESS=1 web/verify/grab-qml.sh /tmp/qml-2a.png
   ```
2. So với mockup (đo mockup bằng DOM, đo app bằng pixel-scan trên PNG vừa chụp):
   ```bash
   cd web
   node verify/gate.mjs \
     --screen 2a --platform qml \
     --mockup <mockup 2a> --mockup-viewport 1280x820 \
     --app-image /tmp/qml-2a.png \
     --landmarks <landmarks-2a-qml.json> \
     --threshold 4 \
     --out-dir verify/.out/2a-qml
   ```

## Cách chạy — nền iPhone

1. Chụp màn hình THẬT trên **iPhone 17, UDID cố định `6BF6C097-A2F1-42BA-80D0-AD4FF2ABAEA0`**
   (virtual device policy: **TUYỆT ĐỐI không** `simctl create`, không dùng sim khác):
   ```bash
   cd neo-stopmotion
   web/verify/grab-ios.sh --out /tmp/ios-capture.png --wait-seconds 3
   # repo BBStopMotion-apple mặc định: sibling của neo-stopmotion (../bbstopmotion-apple)
   # đổi bằng --repo <path> hoặc IOS_APP_REPO_ROOT=<path>
   ```
2. So với mockup khung 390×844:
   ```bash
   cd web
   node verify/gate.mjs \
     --screen 1i-capture --platform ios \
     --mockup <mockup iPhone capture> --mockup-viewport 390x844 \
     --app-image /tmp/ios-capture.png \
     --landmarks <landmarks-1i-ios.json> \
     --threshold 4 \
     --out-dir verify/.out/1i-ios
   ```

## Self-test (chứng minh harness hoạt động đúng — AC1/AC2 của T-BS03)

Mockup T-BS02 (11 màn chuẩn) chưa có ở thời điểm dựng harness này → dùng fixture tối giản tự tạo
(`fixtures/self-test.html` + `fixtures/self-test-fail.html`, cố ý lệch padding 24px→40px) để tự kiểm:

```bash
cd neo-stopmotion/web
npm run verify:selftest
```

Chạy 2 gate:
- **AC1** — so `self-test.html` với CHÍNH nó → mọi landmark Δ=0 → PASS → exit 0.
- **AC2** — so `self-test.html` (mockup) với `self-test-fail.html` (app, lệch padding) → báo đúng
  dòng FAIL cho `sidebar`/`main`/`capture-btn` (Δx=Δy=16px) và `app-root` (Δh=32px) → exit 1 bên
  trong, nhưng script wrap bằng `--expect-fail` nên **script tổng thoát 0** (chứng minh harness PHÁT
  HIỆN ĐÚNG lỗi — không phải harness bị hỏng).

Xem log AC1/AC2 thật trong session log T-BS03 (`docs/04-phases/neo-stopmotion/phase-04-bright-studio-redesign/session-log.md`).

## Cấu trúc file

```
verify/
├── capture.mjs               # chụp 1 URL bằng Chrome thật → PNG
├── measure.mjs                # đo DOM (mockup + web app) → JSON landmark
├── measure-image.mjs          # đo pixel-scan trên PNG (QML/iPhone) → JSON landmark
├── report.mjs                 # JSON đo → report.md + overlay.png + exit code
├── gate.mjs                   # orchestrator: --screen --platform --app-url|--app-image --mockup
├── grab-qml.sh                # chụp cửa sổ app desktop (PyQt6/QML) thật
├── grab-ios.sh                # build+install+chụp màn iPhone 17 sim (UDID cố định)
├── lib/
│   ├── chrome.mjs              # resolve Chrome/Chromium thật cho puppeteer-core
│   ├── args.mjs                 # parser --flag value tối giản
│   └── url.mjs                   # chấp nhận path trần lẫn URL đầy đủ
└── fixtures/
    ├── self-test.html                     # self-test AC1/AC2 (không phải mockup sản phẩm)
    ├── self-test-fail.html                # bản lệch padding cố ý (AC2)
    ├── landmarks-selftest-image.json      # smoke-test platform=qml cho self-test.html
    └── landmarks-image-example.json       # ví dụ định dạng landmarks cho platform ảnh
```

## Giới hạn đã biết

- **Màu**: `measure.mjs` đọc `getComputedStyle().backgroundColor/color` — đây là màu CSS tính toán
  (rgb/rgba string), so sánh màu hiện KHÔNG nằm trong bảng Δ số (chỉ hiển thị tham khảo trong cột
  mockup/app). Nếu cần gate cứng theo màu, so sánh thủ công cột `bg`/`color` trong `report.md` hoặc
  mở rộng `computeDiff()` để thêm rule màu.
- **Pixel-scan (`measure-image.mjs`)** kém chính xác hơn đo DOM: phụ thuộc `searchBox`/`color`/
  `tolerance` khai đúng; nếu 2 phần tử liền kề cùng màu trong searchBox, bounding box đo được có thể
  bao trùm cả 2 (lem biên). Luôn khai `searchBox` sát vùng thật + `tolerance` nhỏ nhất đủ dùng.
  Không đo được font/chữ qua ảnh — chỉ đo được hình khối theo màu.
- **`grab-ios.sh`** hiện chỉ launch app rồi chờ `--wait-seconds` rồi chụp màn HIỆN TẠI — CHƯA điều
  hướng tới đúng màn con (vd "Capture" vs "Library") vì BBStopMotion-apple (T-A03) mới ở mức scaffold,
  chưa có deep-link/launch-argument. `--launch-arg` đã có sẵn để truyền cờ khi app hỗ trợ điều hướng
  (T-BS20 sẽ bổ sung).
- **`grab-qml.sh`** dùng `NEO_STOPMOTION_GRAB` sẵn có trong `app.py` — `grabWindow()` chụp đúng
  frame hiện tại lúc timer bắn (mặc định delay 3500ms cho qua splash); nếu app cần thao tác điều
  hướng trước khi tới đúng màn (vd bấm "Xuất phim"), script hiện CHƯA tự động hoá thao tác đó —
  cần chạy app ở đúng state trước hoặc mở rộng bằng `NEO_STOPMOTION_AUTOSHOOT`/`AUTOEXPORT`.
- **Overlay resize** dùng nearest-neighbor tự viết (không dùng `sharp`/canvas, giữ dependency tối
  giản) — đủ để soi lệch bằng mắt, không dùng để đo màu chính xác trên overlay.
- Web self-test dùng Chrome cài sẵn qua `puppeteer-core` (không tải Chromium riêng) — path mặc định
  macOS `/Applications/Google Chrome.app/...`; máy khác set `PUPPETEER_EXECUTABLE_PATH`.
