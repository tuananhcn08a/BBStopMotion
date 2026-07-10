#!/usr/bin/env bash
#
# verify/grab-qml.sh — chụp cửa sổ app desktop (PyQt6/QML) THẬT ra PNG, dùng
# làm input cho gate.mjs (--platform qml --app-image <out.png>).
#
# Nguyên tắc: đây là QQuickWindow.grabWindow() của app đang CHẠY THẬT (xem
# NEO_STOPMOTION_GRAB trong src/neo_stopmotion/app.py) — không phải ảnh dựng/ghép.
# NEO_STOPMOTION_CAPTURE=synthetic chỉ thay webcam thật bằng test pattern (không
# có webcam trên máy CI/devops) — không ảnh hưởng tới việc UI có render thật hay không.
#
# Usage:
#   verify/grab-qml.sh <out.png> [delay_ms]
#   NEO_STOPMOTION_GRAB_HEADLESS=1 verify/grab-qml.sh <out.png>   # QT_QPA_PLATFORM=offscreen (CI không màn hình)
#
# Yêu cầu: chạy trong venv đã `pip install -e .` của neo-stopmotion (repo root,
# không phải trong web/). Ví dụ:
#   cd neo-stopmotion && source .venv/bin/activate && web/verify/grab-qml.sh /tmp/qml-2a.png
set -euo pipefail

OUT_PATH="${1:?Usage: grab-qml.sh <out.png> [delay_ms]}"
DELAY_MS="${2:-3500}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

mkdir -p "$(dirname "${OUT_PATH}")"

echo "[grab-qml] repo_root=${REPO_ROOT}"
echo "[grab-qml] out=${OUT_PATH} delay_ms=${DELAY_MS}"

if ! python -c "import neo_stopmotion" >/dev/null 2>&1; then
  echo "[grab-qml] LỖI: 'import neo_stopmotion' thất bại. Kích hoạt venv + 'pip install -e .' trong ${REPO_ROOT} trước." >&2
  exit 1
fi

ENV_ARGS=(
  "NEO_STOPMOTION_CAPTURE=synthetic"
  "NEO_STOPMOTION_GRAB=${OUT_PATH}"
  "NEO_STOPMOTION_GRAB_DELAY_MS=${DELAY_MS}"
)

if [[ "${NEO_STOPMOTION_GRAB_HEADLESS:-0}" == "1" ]]; then
  ENV_ARGS+=("QT_QPA_PLATFORM=offscreen")
  echo "[grab-qml] chế độ headless: QT_QPA_PLATFORM=offscreen (vẫn là render Qt thật, chỉ không hiện lên màn hình)"
fi

(cd "${REPO_ROOT}" && env "${ENV_ARGS[@]}" python -m neo_stopmotion)

if [[ ! -f "${OUT_PATH}" ]]; then
  echo "[grab-qml] LỖI: không thấy file output sau khi chạy app: ${OUT_PATH}" >&2
  exit 1
fi

echo "[grab-qml] OK: ${OUT_PATH}"
