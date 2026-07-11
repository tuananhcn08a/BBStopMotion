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

   ⚠️ **Gotcha stale bundle/process (T-BS37)** — round-1 gate iPhone từng báo nhầm 2 finding vì
   chụp trúng `.app` bundle/process **CŨ**. Nguyên nhân: `xcrun simctl launch` trên một process
   **đang chạy sẵn** trên sim là **no-op** đối với launch-arg mới — process cũ vẫn giữ nguyên args
   từ lần khởi động trước (vd còn kẹt ở `-VerifyScreen capture` dù bạn vừa đổi sang `library`),
   KHÔNG tự restart để nhận args mới, kể cả khi bạn vừa build+install bản mới đè lên. Vì vậy
   `grab-ios.sh` LUÔN, ở mỗi lần chạy (mỗi lần đổi màn cần chụp):
   1. `xcodebuild build` bản mới nhất (không skip, không cache).
   2. `xcrun simctl terminate` process cũ (nếu đang chạy).
   3. `xcrun simctl install` bản vừa build **đè lên** (upgrade in-place — xem gotcha #2 vì sao
      KHÔNG `uninstall` trước).
   4. `xcrun simctl launch ... ${LAUNCH_ARGS[@]}` — process khởi động MỚI hoàn toàn nên launch-arg
      luôn được áp dụng.

   Hệ quả cho người gọi script: **gọi `grab-ios.sh` riêng cho MỖI màn cần chụp** (vd một lần
   `--launch-arg "-VerifyScreen capture"`, một lần khác `--launch-arg "-VerifyScreen library"`) —
   KHÔNG launch app 1 lần rồi tự điều hướng thủ công rồi chụp nhiều lần, vì mỗi lời gọi script đã
   tự đảm bảo process sạch cho đúng args truyền vào lần đó.

   ⚠️ **Gotcha #2 — cố ý KHÔNG `simctl uninstall` trước khi install lại:** thử `uninstall` +
   `install` (thay vì chỉ `install` đè) trong lúc làm T-BS37 cho thấy tác dụng phụ: `uninstall` xoá
   luôn data container + quyền hệ thống (Camera...) đã cấp cho app trên sim này — lần launch kế
   tiếp iOS bật lại hộp thoại hệ thống "would like to access the Camera", hộp thoại này **che kín**
   màn app phía dưới nên 2 ảnh chụp liên tiếp (`capture` vs `library`) trông **giống hệt nhau** dù
   `-VerifyScreen` đã áp đúng bên dưới — trông giống hệt bug stale-bundle ban đầu nhưng nguyên nhân
   khác hẳn. Xcode ở máy dev hiện tại **không hỗ trợ** `xcrun simctl privacy grant camera` (không
   nằm trong danh sách service của `simctl privacy --help`) nên không thể auto-grant lại quyền sau
   uninstall. Do đó script chỉ `install` đè (**upgrade in-place**, không uninstall trước): binary/code
   luôn là bản mới nhất, nhưng data container + quyền Camera đã Allow thủ công 1 lần từ trước trên
   sim này được **giữ nguyên** qua các lần chạy script sau — hộp thoại quyền không che ảnh nữa.
   ⇒ Trên máy mới/sim mới chưa từng Allow Camera, cần **bấm Allow thủ công một lần** trước khi dùng
   `grab-ios.sh` cho các màn cần camera; các lần sau không cần lặp lại.
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

## Cách chạy — nền macOS

macOS chạy **trực tiếp trên máy** (không phải simulator — macOS không có "virtual device" như iOS,
virtual device policy không áp dụng ở đây). Máy build/QA gate không có camera thật → app đã hỗ trợ
launch-arg `-VerifyScreen <capture|library|settings|success|export>` tương tự iOS (T-BS55,
`bbstopmotion-apple/macOS/Support/VerifySeedMac.swift`) để mở khoá Export/Success mà không cần camera.

1. Chụp cửa sổ app THẬT:
   ```bash
   cd neo-stopmotion
   web/verify/grab-macos.sh --out /tmp/macos-export.png --launch-arg "-VerifyScreen export"
   # repo bbstopmotion-apple mặc định: sibling của neo-stopmotion (../bbstopmotion-apple)
   # đổi bằng --repo <path> hoặc MACOS_APP_REPO_ROOT=<path>
   ```

   ⚠️ **Cần quyền "Screen Recording"** cho app chạy shell này (Terminal/iTerm...) trong
   System Settings > Privacy & Security > Screen Recording — thiếu quyền này `screencapture` vẫn
   thoát mã 0 (không lỗi) nhưng trả về **ảnh đen tuyền**. Cấp quyền là thao tác người dùng bấm 1 lần,
   script không tự cấp được. Màn hình bị khoá (lock screen) cho ra ảnh đen giống hệt — kiểm tra
   bằng `python3 -c "import Quartz; print(Quartz.CGSessionCopyCurrentDictionary())"`, tìm key
   `CGSSessionScreenIsLocked`.

   Cùng gotcha stale-process như `grab-ios.sh` (T-BS37): `open` trên app **đang chạy sẵn** không áp
   launch-arg mới — script LUÔN `pkill` process cũ trước khi build + launch lại, gọi riêng cho mỗi
   màn cần chụp.

2. So với mockup khung macOS (kích thước cửa sổ tối thiểu `900×600`, xem `RootShellMac.swift`):
   ```bash
   cd web
   node verify/gate.mjs \
     --screen export --platform macos \
     --mockup <mockup macOS export> --mockup-viewport 900x600 \
     --app-image /tmp/macos-export.png \
     --landmarks <landmarks-export-macos.json> \
     --threshold 4 \
     --out-dir verify/.out/export-macos
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
├── grab-macos.sh               # build+launch+chụp cửa sổ macOS thật (chạy trực tiếp, không sim)
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
- **`grab-ios.sh`** build+terminate+uninstall+install+launch **lại từ đầu ở mỗi lần gọi** (xem gotcha
  T-BS37 phía trên) rồi chờ `--wait-seconds` rồi chụp màn HIỆN TẠI. Điều hướng tới đúng màn con dùng
  `--launch-arg "-VerifyScreen <capture|library|...>"` — app đã hỗ trợ (T-BS20,
  `iOS/Support/VerifySeediOS.swift`). Gọi script riêng cho mỗi màn cần chụp, KHÔNG launch 1 lần rồi
  chụp nhiều màn từ cùng 1 process.
- **`grab-qml.sh`** dùng `NEO_STOPMOTION_GRAB` sẵn có trong `app.py` — `grabWindow()` chụp đúng
  frame hiện tại lúc timer bắn (mặc định delay 3500ms cho qua splash); nếu app cần thao tác điều
  hướng trước khi tới đúng màn (vd bấm "Xuất phim"), script hiện CHƯA tự động hoá thao tác đó —
  cần chạy app ở đúng state trước hoặc mở rộng bằng `NEO_STOPMOTION_AUTOSHOOT`/`AUTOEXPORT`.
- **`grab-macos.sh`** build+kill process cũ+launch **lại từ đầu ở mỗi lần gọi** (cùng gotcha
  stale-process như `grab-ios.sh`, T-BS55) rồi chờ `--wait-seconds` rồi chụp cửa sổ app qua
  `screencapture -l<windowID>` (tìm window id bằng Quartz, không cần quyền Accessibility). Cần
  quyền Screen Recording đã cấp cho app chạy shell + màn hình không bị khoá, nếu không
  `screencapture` trả ảnh đen mà không báo lỗi (xem gotcha trong phần "Cách chạy — nền macOS").
- **Overlay resize** dùng nearest-neighbor tự viết (không dùng `sharp`/canvas, giữ dependency tối
  giản) — đủ để soi lệch bằng mắt, không dùng để đo màu chính xác trên overlay.
- Web self-test dùng Chrome cài sẵn qua `puppeteer-core` (không tải Chromium riêng) — path mặc định
  macOS `/Applications/Google Chrome.app/...`; máy khác set `PUPPETEER_EXECUTABLE_PATH`.
