#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
THREAD_ID="${THREAD_ID:-1}"
OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/results}"

mkdir -p "$OUTPUT_DIR"

echo "=== 4chan v2 Load Tests ==="
echo "API Base URL: $API_BASE_URL"
echo "Output Dir:   $OUTPUT_DIR"
echo ""

# Check k6 is installed
if ! command -v k6 &> /dev/null; then
  echo "Error: k6 is not installed. Install from https://k6.io/docs/get-started/installation/"
  exit 1
fi

run_test() {
  local test_name="$1"
  local test_file="$2"
  echo "--- Running: $test_name ---"
  k6 run \
    --env API_BASE_URL="$API_BASE_URL" \
    --env AUTH_TOKEN="$AUTH_TOKEN" \
    --env THREAD_ID="$THREAD_ID" \
    --out json="$OUTPUT_DIR/${test_name}.json" \
    --summary-export="$OUTPUT_DIR/${test_name}-summary.json" \
    "$test_file" || true
  echo ""
}

# Run all load tests sequentially
run_test "board-listing" "$SCRIPT_DIR/board-listing.js"
run_test "thread-viewing" "$SCRIPT_DIR/thread-viewing.js"
run_test "file-upload" "$SCRIPT_DIR/file-upload.js"
run_test "post-creation" "$SCRIPT_DIR/post-creation.js"

echo "=== Load Tests Complete ==="
echo "Results saved to: $OUTPUT_DIR"
