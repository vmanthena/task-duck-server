#!/usr/bin/env bash
set -euo pipefail

# ── Colors & symbols ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
CHECK="${GREEN}✔${NC}"; CROSS="${RED}✘${NC}"; ARROW="${CYAN}➜${NC}"

# ── OCI build-args (auto-populated from git + package.json) ──
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "4.0.0")

OCI_ARGS=(
  --build-arg "BUILD_DATE=${BUILD_DATE}"
  --build-arg "VCS_REF=${VCS_REF}"
  --build-arg "VERSION=${VERSION}"
)

# ── Tracking ──
BUILT_IMAGES=()
SCAN_RESULTS=""

print_header() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${BLUE}║       Task Duck — Docker Builder     ║${NC}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════╝${NC}"
  echo -e "  ${ARROW} Version: ${BOLD}${VERSION}${NC}  Commit: ${BOLD}${VCS_REF}${NC}"
  echo ""
}

build_image() {
  local target=$1 tag=$2
  echo -e "\n${ARROW} Building ${BOLD}${tag}${NC} (target: ${target})..."
  if docker build --target "$target" "${OCI_ARGS[@]}" -t "$tag" .; then
    echo -e "  ${CHECK} ${tag} built successfully"
    BUILT_IMAGES+=("$tag")
  else
    echo -e "  ${CROSS} ${tag} build failed"
    return 1
  fi
}

build_slim() {
  echo -e "\n${ARROW} Slimming ${BOLD}task-duck:latest${NC} → ${BOLD}task-duck:slim${NC}..."
  if ! command -v slim &>/dev/null; then
    echo -e "  ${CROSS} SlimToolkit not installed — skipping (https://slimtoolkit.org)"
    return 0
  fi
  if [[ ! " ${BUILT_IMAGES[*]} " =~ " task-duck:latest " ]]; then
    echo -e "  ${YELLOW}⚠ task-duck:latest not built yet — building first${NC}"
    build_image production task-duck:latest
  fi
  if slim build task-duck:latest \
    --target task-duck:slim \
    --http-probe-cmd /api/health \
    --expose 3000; then
    echo -e "  ${CHECK} task-duck:slim built successfully"
    BUILT_IMAGES+=("task-duck:slim")
  else
    echo -e "  ${CROSS} slim build failed"
    return 1
  fi
}

run_trivy_scan() {
  echo -e "\n${ARROW} Running Trivy vulnerability scan..."

  # Determine which images to scan
  local targets=()
  if [[ ${#BUILT_IMAGES[@]} -gt 0 ]]; then
    targets=("${BUILT_IMAGES[@]}")
  else
    echo -e "  ${YELLOW}⚠ No images built yet — building task-duck:latest first${NC}"
    build_image production task-duck:latest
    targets=("task-duck:latest")
  fi

  SCAN_RESULTS=""
  local scan_cmd=""

  # Use local trivy CLI if available, otherwise docker run
  if command -v trivy &>/dev/null; then
    scan_cmd="trivy"
  else
    echo -e "  ${YELLOW}ℹ Trivy CLI not found — using docker run aquasec/trivy${NC}"
    scan_cmd="docker_trivy"
  fi

  for img in "${targets[@]}"; do
    echo -e "\n  ${ARROW} Scanning ${BOLD}${img}${NC}..."
    local result
    if [[ "$scan_cmd" == "trivy" ]]; then
      if result=$(trivy image --severity HIGH,CRITICAL --ignore-unfixed "$img" 2>&1); then
        SCAN_RESULTS+="  ${CHECK} ${img}: no HIGH/CRITICAL vulnerabilities\n"
      else
        SCAN_RESULTS+="  ${CROSS} ${img}: vulnerabilities found\n"
        echo "$result"
      fi
    else
      if result=$(docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        aquasec/trivy image --severity HIGH,CRITICAL --ignore-unfixed "$img" 2>&1); then
        SCAN_RESULTS+="  ${CHECK} ${img}: no HIGH/CRITICAL vulnerabilities\n"
      else
        SCAN_RESULTS+="  ${CROSS} ${img}: vulnerabilities found\n"
        echo "$result"
      fi
    fi
  done
}

print_results() {
  echo -e "\n${BOLD}${BLUE}═══ Results ═══${NC}"

  if [[ ${#BUILT_IMAGES[@]} -gt 0 ]]; then
    echo -e "\n${BOLD}Images built:${NC}"
    docker images task-duck --format 'table {{.Tag}}\t{{.Size}}'
  fi

  if [[ -n "$SCAN_RESULTS" ]]; then
    echo -e "\n${BOLD}Scan results:${NC}"
    echo -e "$SCAN_RESULTS"
  fi
}

# ── Main menu ──
print_header

PS3=$'\n'"Select an option: "
options=(
  "Build production image"
  "Build UPX image"
  "Build slim image"
  "Build ALL images"
  "Scan with Trivy"
  "Build ALL + Scan"
  "Quit"
)

select opt in "${options[@]}"; do
  case $REPLY in
    1) build_image production task-duck:latest ;;
    2) build_image upx task-duck:upx ;;
    3) build_slim ;;
    4)
      build_image production task-duck:latest
      build_image upx task-duck:upx
      build_slim
      ;;
    5) run_trivy_scan ;;
    6)
      build_image production task-duck:latest
      build_image upx task-duck:upx
      build_slim
      run_trivy_scan
      ;;
    7) echo -e "\n${CHECK} Done."; exit 0 ;;
    *) echo -e "${CROSS} Invalid option"; continue ;;
  esac
  print_results
  echo ""
  # Show menu again
  REPLY=
done
