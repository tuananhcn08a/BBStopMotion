#!/usr/bin/env bash
#
# verify/grab-ios.sh — build + install + chụp màn hình iPhone THẬT trên
# Simulator, dùng làm input cho gate.mjs (--platform ios --app-image <out.png>).
#
# ⚠️ Virtual device policy (bắt buộc, xem CLAUDE.md người dùng):
#   - CHỈ dùng iPhone 17, UDID cố định 6BF6C097-A2F1-42BA-80D0-AD4FF2ABAEA0.
#   - TUYỆT ĐỐI KHÔNG `xcrun simctl create` — nếu UDID không tồn tại, script
#     THẤT BẠI thay vì tự tạo sim mới.
#   - Không xoá/erase sim khác.
#   - Nếu sau này thêm `xcodebuild test` (vd để điều hướng màn qua XCUITest),
#     PHẢI thêm `-parallel-testing-enabled NO` (tránh spawn "Clone N of ...").
#
# Giới hạn hiện tại: BBStopMotion-apple (T-A03) mới ở mức scaffold — script
# build+install+launch app rồi chụp màn HIỆN TẠI sau --wait-seconds. Điều hướng
# tới đúng màn cụ thể (vd "màn Capture") cần app hỗ trợ deep-link hoặc
# launch argument (`--verify-screen <id>`) — TODO khi apple-dev thêm màn thật
# (T-BS20). Cho tới đó, dùng --launch-arg để tự truyền nếu app đã hỗ trợ.
#
# Usage:
#   verify/grab-ios.sh --out <shot.png> \
#     [--repo <path to bbstopmotion-apple>] [--scheme BBStopMotioniOS] \
#     [--wait-seconds 3] [--launch-arg "-VerifyScreen capture"]
set -euo pipefail

UDID="6BF6C097-A2F1-42BA-80D0-AD4FF2ABAEA0"   # iPhone 17 — KHÔNG đổi, KHÔNG tạo sim khác

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEO_REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_IOS_REPO="$(cd "${NEO_REPO_ROOT}/.." 2>/dev/null && pwd)/bbstopmotion-apple"

OUT_PATH=""
IOS_REPO="${IOS_APP_REPO_ROOT:-${DEFAULT_IOS_REPO}}"
SCHEME="BBStopMotioniOS"
WAIT_SECONDS=3
LAUNCH_ARGS=()

die() { echo "[grab-ios] LỖI: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) OUT_PATH="$2"; shift 2 ;;
    --repo) IOS_REPO="$2"; shift 2 ;;
    --scheme) SCHEME="$2"; shift 2 ;;
    --wait-seconds) WAIT_SECONDS="$2"; shift 2 ;;
    --launch-arg) LAUNCH_ARGS+=("$2"); shift 2 ;;
    -h|--help)
      echo "Usage: grab-ios.sh --out <shot.png> [--repo <path>] [--scheme NAME] [--wait-seconds N] [--launch-arg ARG]"
      exit 0
      ;;
    *) die "tham số không hỗ trợ: $1" ;;
  esac
done

[[ -n "${OUT_PATH}" ]] || die "thiếu --out <shot.png>"
[[ -d "${IOS_REPO}" ]] || die "không thấy repo iOS: ${IOS_REPO} (đặt --repo hoặc IOS_APP_REPO_ROOT)"

command -v xcrun >/dev/null 2>&1 || die "thiếu xcrun (cần Xcode)"
command -v xcodebuild >/dev/null 2>&1 || die "thiếu xcodebuild"

echo "[grab-ios] repo=${IOS_REPO} scheme=${SCHEME} udid=${UDID}"

# --- 1. Xác nhận UDID cố định TỒN TẠI SẴN (không tạo mới) ---
DEVICE_LINE="$(xcrun simctl list devices | grep -F "${UDID}" || true)"
[[ -n "${DEVICE_LINE}" ]] || die "Không tìm thấy simulator UDID ${UDID} (iPhone 17). KHÔNG tự tạo sim mới — kiểm tra Xcode > Devices."
echo "[grab-ios] simulator: ${DEVICE_LINE}"

if ! echo "${DEVICE_LINE}" | grep -q "(Booted)"; then
  echo "[grab-ios] boot simulator (không tạo mới, chỉ boot cái đã có)"
  xcrun simctl boot "${UDID}" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "${UDID}" -b
fi

# --- 2. Tìm project/workspace trong repo ---
PROJECT_ARG=()
if [[ -d "${IOS_REPO}/BBStopMotion.xcworkspace" ]]; then
  PROJECT_ARG=(-workspace "${IOS_REPO}/BBStopMotion.xcworkspace")
elif [[ -d "${IOS_REPO}/BBStopMotion.xcodeproj" ]]; then
  PROJECT_ARG=(-project "${IOS_REPO}/BBStopMotion.xcodeproj")
else
  die "không thấy .xcworkspace/.xcodeproj trong ${IOS_REPO}"
fi

# --- 3. Build cho simulator (không code signing — chỉ chạy trên sim) ---
echo "[grab-ios] xcodebuild build (scheme=${SCHEME})..."
xcodebuild \
  "${PROJECT_ARG[@]}" \
  -scheme "${SCHEME}" \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=${UDID}" \
  -parallel-testing-enabled NO \
  build \
  CODE_SIGNING_ALLOWED=NO \
  | tail -n 40

BUILD_SETTINGS="$(
  xcodebuild \
    "${PROJECT_ARG[@]}" \
    -scheme "${SCHEME}" \
    -sdk iphonesimulator \
    -destination "platform=iOS Simulator,id=${UDID}" \
    -showBuildSettings
)"
TARGET_BUILD_DIR="$(echo "${BUILD_SETTINGS}" | awk -F' = ' '$1 ~ "^ *TARGET_BUILD_DIR$" { print $2; exit }')"
WRAPPER_NAME="$(echo "${BUILD_SETTINGS}" | awk -F' = ' '$1 ~ "^ *WRAPPER_NAME$" { print $2; exit }')"
APP_PATH="${TARGET_BUILD_DIR}/${WRAPPER_NAME}"
[[ -d "${APP_PATH}" ]] || die "không thấy app đã build: ${APP_PATH}"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${APP_PATH}/Info.plist")"
echo "[grab-ios] app=${APP_PATH} bundle_id=${BUNDLE_ID}"

# --- 4. Install + launch app THẬT trên sim ---
xcrun simctl install "${UDID}" "${APP_PATH}"
# Lưu ý: macOS /bin/bash mặc định là 3.2 — "${arr[@]}" trên mảng RỖNG dưới
# `set -u` báo "unbound variable". Dùng idiom ${arr[@]+"${arr[@]}"} để an toàn.
xcrun simctl launch "${UDID}" "${BUNDLE_ID}" ${LAUNCH_ARGS[@]+"${LAUNCH_ARGS[@]}"} >/dev/null

echo "[grab-ios] chờ ${WAIT_SECONDS}s cho UI render xong..."
sleep "${WAIT_SECONDS}"

# --- 5. Chụp màn hình THẬT ---
mkdir -p "$(dirname "${OUT_PATH}")"
xcrun simctl io "${UDID}" screenshot "${OUT_PATH}"
[[ -f "${OUT_PATH}" ]] || die "screenshot thất bại: ${OUT_PATH}"

echo "[grab-ios] OK: ${OUT_PATH}"
