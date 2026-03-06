#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/.claude/skills"
DEST_DIR="$REPO_ROOT/.agents/skills"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$REPO_ROOT/.agents"

if [[ -L "$DEST_DIR" ]]; then
  rm "$DEST_DIR"
fi

if [[ -e "$DEST_DIR" && ! -d "$DEST_DIR" ]]; then
  echo "Destination exists but is not a directory: $DEST_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Fully managed directory: remove everything before re-creating links.
find "$DEST_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

linked_count=0
skipped_count=0

for skill_dir in "$SOURCE_DIR"/*; do
  [[ -d "$skill_dir" ]] || continue
  [[ -f "$skill_dir/SKILL.md" ]] || continue

  skill_name="$(basename "$skill_dir")"
  link_path="$DEST_DIR/$skill_name"

  if [[ -e "$link_path" ]]; then
    echo "Skipping '$skill_name': $link_path already exists." >&2
    skipped_count=$((skipped_count + 1))
    continue
  fi

  ln -s "../../.claude/skills/$skill_name" "$link_path"
  linked_count=$((linked_count + 1))
done

echo "Agents skills sync complete."
echo "Linked: $linked_count"
echo "Skipped: $skipped_count"
echo "Destination: $DEST_DIR"
