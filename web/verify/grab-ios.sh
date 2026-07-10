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
# Điều hướng tới đúng màn: app đã hỗ trợ launch-arg `-VerifyScreen <id>` (T-BS20,
# xem bbstopmotion-apple/iOS/Support/VerifySeediOS.swift) — dùng --launch-arg.
#
# ⚠️ GOTCHA (T-BS37): `simctl launch` trên process ĐANG CHẠY SẴN là NO-OP đối với
# launch-arg mới (process cũ giữ nguyên args từ lần khởi động trước → chụp trúng
# màn CŨ dù build/launch-arg đã đổi — round-1 gate iPhone từng báo nhầm finding vì
# lý do này). Vì vậy script này LUÔN, ở MỌI lần chạy: rebuild bản mới → terminate +
# uninstall process/bundle cũ → install bản mới → launch fresh với launch-arg. Gọi
# script riêng cho MỖI màn cần chụp (không launch 1 lần rồi chụp nhiều màn).
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
    --launch-arg)
      # ⚠️ GOTCHA (T-BS37, bug #2 phát hiện khi verify AC1): người gọi truyền
      # --launch-arg "-VerifyScreen library" như 1 CHUỖI (tiện gõ, đúng README/
      # comment VerifySeediOS.swift) nhưng `simctl launch` cần forward dạng
      # NHIỀU argv token RIÊNG (`-VerifyScreen`, `library`) — Foundation chỉ nạp
      # được vào `NSArgumentDomain` khi `-Key` và `value` là 2 argv token tách
      # biệt. Nếu gộp thành 1 token (vd do "${LAUNCH_ARGS[@]}" giữ nguyên chuỗi
      # có khoảng trắng), `UserDefaults.standard.string(forKey: "VerifyScreen")`
      # trả về nil → app im lặng KHÔNG điều hướng, luôn hiện màn mặc định
      # (capture) — trông giống hệt bug "dính màn cũ" dù process đã restart
      # sạch. Tách theo khoảng trắng ở đây để mỗi từ thành 1 argv token riêng.
      IFS=' ' read -ra _launch_arg_tokens <<< "$2"
      LAUNCH_ARGS+=("${_launch_arg_tokens[@]}")
      shift 2 ;;
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

# --- 4. Terminate process CŨ, install bản MỚI đè lên, rồi launch fresh ---
# ⚠️ GOTCHA (T-BS37): nếu app đang chạy sẵn trên sim, `simctl launch` trên process
# LIVE là NO-OP đối với launch-arg mới — process cũ vẫn giữ nguyên args lúc nó khởi
# động lần trước (vd còn kẹt ở -VerifyScreen cũ), KHÔNG restart để nhận args mới.
# Round-1 gate iPhone từng báo nhầm 2 finding vì lý do này (chụp trúng bundle/process
# CŨ). Vì vậy LUÔN terminate (dừng process đang chạy, nếu có) TRƯỚC KHI install bản
# vừa build đè lên (upgrade in-place) rồi launch lại — đảm bảo mỗi lần đổi
# --launch-arg process được restart sạch với binary MỚI NHẤT, không bao giờ no-op.
#
# Cố ý KHÔNG dùng `simctl uninstall` trước install: uninstall xoá luôn data
# container + quyền hệ thống (Camera...) đã cấp cho app trên sim này — nếu xoá,
# lần launch kế tiếp iOS bật lại hộp thoại xin quyền Camera hệ thống, hộp thoại
# này CHE HẾT màn app phía dưới nên ảnh chụp không còn phản ánh đúng
# -VerifyScreen nữa (tự phát hiện khi verify AC1 harness này — xem README).
# `install` (không uninstall trước) là **upgrade in-place**: ghi đè binary/code
# mới nhưng giữ nguyên data container + quyền đã cấp trước đó cho sim này, đúng
# yêu cầu "luôn chạy bản mới" mà không phá quyền Camera đã được người dùng Allow
# (thủ công 1 lần) từ trước.
echo "[grab-ios] terminate process cũ (nếu có) rồi install đè bản mới..."
xcrun simctl terminate "${UDID}" "${BUNDLE_ID}" >/dev/null 2>&1 || true
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
