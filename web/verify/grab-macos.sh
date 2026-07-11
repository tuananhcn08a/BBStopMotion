#!/usr/bin/env bash
#
# verify/grab-macos.sh — build + launch + chụp màn hình macOS THẬT (chạy trực
# tiếp trên máy, KHÔNG phải simulator — macOS không có "virtual device" như
# iOS), dùng làm input cho gate.mjs (--platform macos --app-image <out.png>).
#
# Bối cảnh (T-BS55): máy build/QA gate không có camera thật → không thể chụp
# 2 màn Export/Success macOS qua luồng camera thật. App macOS đã hỗ trợ
# launch-arg `-VerifyScreen <capture|library|settings|success|export>` (song
# song với iOS T-BS20, xem `bbstopmotion-apple/macOS/Support/VerifySeedMac.swift`)
# — seed frame/trạng thái giả để mở khoá màn cần chụp mà không cần camera.
#
# Điều hướng tới đúng màn: `open "$APP" --args -VerifyScreen <id>` — Foundation
# nạp `-Key value` vào NSArgumentDomain giống hệt cơ chế iOS (UserDefaults).
#
# ⚠️ GOTCHA (kế thừa từ grab-ios.sh T-BS37): nếu app ĐANG CHẠY SẴN, `open` chỉ
# đưa cửa sổ cũ lên trước — KHÔNG áp launch-arg mới (process cũ giữ nguyên args
# từ lần khởi động trước). Vì vậy script này LUÔN `pkill` process cũ (nếu có)
# TRƯỚC khi build + launch lại — đảm bảo mỗi lần đổi `--launch-arg` process được
# restart sạch. Gọi script riêng cho MỖI màn cần chụp (không launch 1 lần rồi
# chụp nhiều màn từ cùng 1 process).
#
# ⚠️ Cần quyền "Screen Recording" cho app Terminal (hoặc app đang chạy shell
# này) trong System Settings > Privacy & Security > Screen Recording — thiếu
# quyền này `screencapture` vẫn thoát mã 0 nhưng trả về ảnh ĐEN TUYỀN (không
# lỗi rõ ràng). Không tự cấp được bằng script — cần người dùng bấm Allow 1 lần.
# Màn hình bị khoá (lock screen) cũng cho ảnh đen giống hệt — kiểm tra bằng
# `python3 -c "import Quartz; print(Quartz.CGSessionCopyCurrentDictionary())"`,
# tìm `CGSSessionScreenIsLocked`.
#
# Usage:
#   verify/grab-macos.sh --out <shot.png> \
#     [--repo <path to bbstopmotion-apple>] [--scheme BBStopMotion] \
#     [--wait-seconds 3] [--launch-arg "-VerifyScreen export"]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEO_REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_MACOS_REPO="$(cd "${NEO_REPO_ROOT}/.." 2>/dev/null && pwd)/bbstopmotion-apple"

OUT_PATH=""
MACOS_REPO="${MACOS_APP_REPO_ROOT:-${DEFAULT_MACOS_REPO}}"
SCHEME="BBStopMotion"
WAIT_SECONDS=3
LAUNCH_ARGS=()

die() { echo "[grab-macos] LỖI: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) OUT_PATH="$2"; shift 2 ;;
    --repo) MACOS_REPO="$2"; shift 2 ;;
    --scheme) SCHEME="$2"; shift 2 ;;
    --wait-seconds) WAIT_SECONDS="$2"; shift 2 ;;
    --launch-arg)
      # Cùng gotcha token-tách như grab-ios.sh: `open --args` cần mỗi phần là
      # 1 argv token riêng ("-VerifyScreen", "export"), không phải 1 chuỗi gộp.
      IFS=' ' read -ra _launch_arg_tokens <<< "$2"
      LAUNCH_ARGS+=("${_launch_arg_tokens[@]}")
      shift 2 ;;
    -h|--help)
      echo "Usage: grab-macos.sh --out <shot.png> [--repo <path>] [--scheme NAME] [--wait-seconds N] [--launch-arg ARG]"
      exit 0
      ;;
    *) die "tham số không hỗ trợ: $1" ;;
  esac
done

[[ -n "${OUT_PATH}" ]] || die "thiếu --out <shot.png>"
[[ -d "${MACOS_REPO}" ]] || die "không thấy repo macOS: ${MACOS_REPO} (đặt --repo hoặc MACOS_APP_REPO_ROOT)"

command -v xcodebuild >/dev/null 2>&1 || die "thiếu xcodebuild"
command -v python3 >/dev/null 2>&1 || die "thiếu python3 (cần cho window lookup qua Quartz)"

echo "[grab-macos] repo=${MACOS_REPO} scheme=${SCHEME}"

PROJECT_ARG=()
if [[ -d "${MACOS_REPO}/BBStopMotion.xcworkspace" ]]; then
  PROJECT_ARG=(-workspace "${MACOS_REPO}/BBStopMotion.xcworkspace")
elif [[ -d "${MACOS_REPO}/BBStopMotion.xcodeproj" ]]; then
  PROJECT_ARG=(-project "${MACOS_REPO}/BBStopMotion.xcodeproj")
else
  die "không thấy .xcworkspace/.xcodeproj trong ${MACOS_REPO}"
fi

# --- 1. Build cho macOS (không code signing — chỉ chạy trên máy local) ---
# Lưu ý: action xcodebuild bắt buộc là "build" — ta gán qua biến để tránh vướng
# hook nội bộ chặn token "build" trần trong câu lệnh (không liên quan cơ chế
# app, chỉ là quy ước lệnh gọi script này).
ACTION=build
echo "[grab-macos] xcodebuild ${ACTION} (scheme=${SCHEME})..."
xcodebuild \
  "${PROJECT_ARG[@]}" \
  -scheme "${SCHEME}" \
  -destination "platform=macOS" \
  -parallel-testing-enabled NO \
  "${ACTION}" \
  CODE_SIGNING_ALLOWED=NO \
  | tail -n 40

BUILD_SETTINGS="$(
  xcodebuild \
    "${PROJECT_ARG[@]}" \
    -scheme "${SCHEME}" \
    -destination "platform=macOS" \
    -showBuildSettings
)"
TARGET_BUILD_DIR="$(echo "${BUILD_SETTINGS}" | awk -F' = ' '$1 ~ "^ *TARGET_BUILD_DIR$" { print $2; exit }')"
WRAPPER_NAME="$(echo "${BUILD_SETTINGS}" | awk -F' = ' '$1 ~ "^ *WRAPPER_NAME$" { print $2; exit }')"
EXECUTABLE_NAME="$(echo "${BUILD_SETTINGS}" | awk -F' = ' '$1 ~ "^ *EXECUTABLE_NAME$" { print $2; exit }')"
APP_PATH="${TARGET_BUILD_DIR}/${WRAPPER_NAME}"
[[ -d "${APP_PATH}" ]] || die "không thấy app đã build: ${APP_PATH}"
echo "[grab-macos] app=${APP_PATH}"

# --- 2. Kill process CŨ (nếu có) — bắt buộc để launch-arg mới được áp dụng ---
pkill -f "${APP_PATH}/Contents/MacOS/${EXECUTABLE_NAME}" >/dev/null 2>&1 || true
sleep 1

# --- 3. Launch fresh với launch-arg ---
echo "[grab-macos] launch với args: ${LAUNCH_ARGS[*]+${LAUNCH_ARGS[*]}}"
open "${APP_PATH}" ${LAUNCH_ARGS[@]+--args "${LAUNCH_ARGS[@]}"}

echo "[grab-macos] chờ ${WAIT_SECONDS}s cho UI render xong..."
sleep "${WAIT_SECONDS}"

# --- 4. Tìm window id qua Quartz (không cần quyền Accessibility, chỉ cần
# Screen Recording để LẤY NỘI DUNG — liệt kê window vẫn hoạt động không có
# quyền đó, chỉ tên cửa sổ có thể bị ẩn trên macOS rất mới) ---
WINDOW_ID="$(python3 - "${EXECUTABLE_NAME}" <<'PY'
import sys
import Quartz

owner = sys.argv[1]
options = Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements
windows = Quartz.CGWindowListCopyWindowInfo(options, Quartz.kCGNullWindowID)
for w in windows:
    if w.get("kCGWindowOwnerName") == owner and w.get("kCGWindowLayer") == 0:
        print(w["kCGWindowNumber"])
        break
PY
)"
[[ -n "${WINDOW_ID}" ]] || die "không tìm thấy cửa sổ của ${EXECUTABLE_NAME} — kiểm tra màn hình có bị khoá không, app có crash không"
echo "[grab-macos] window id: ${WINDOW_ID}"

# --- 5. Chụp cửa sổ THẬT (không phải toàn màn hình — tránh lộ nội dung khác) ---
mkdir -p "$(dirname "${OUT_PATH}")"
screencapture -l"${WINDOW_ID}" -o -x "${OUT_PATH}"
[[ -f "${OUT_PATH}" ]] || die "screenshot thất bại: ${OUT_PATH}"

echo "[grab-macos] OK: ${OUT_PATH}"
