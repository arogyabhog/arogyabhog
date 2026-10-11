#!/usr/bin/env bash
# Regenerates .project-os/10_HISTORY_GRAPH.md — the cheap-to-refresh map of
# "where the project has been": commit graph + tracked tree + milestones.
# Run: npm run graph   (after any commit worth remembering)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=.project-os/10_HISTORY_GRAPH.md
{
  echo "# 10 — HISTORY GRAPH (regenerate: \`npm run graph\`)"
  echo
  echo "_Generated $(date -u +%Y-%m-%dT%H:%MZ) from git. Cheap context for any new session:_"
  echo "_read this + 01_CURRENT_STATE.md instead of re-deriving the project from scratch._"
  echo
  echo "## Commit graph"
  echo
  echo '```'
  git log --graph --all --date=short --pretty=format:'%h %d %s (%ad)' | sed 's/ ([0-9-]*)$//' | head -60
  echo
  echo '```'
  echo
  echo "## Milestones (feat / decide / add commits)"
  echo
  git log --reverse --date=short --pretty=format:'- **%ad** %h — %s' | awk -F' — ' '$2 ~ /^(feat|decide|add)/'
  echo
  echo
  echo "## Tracked tree"
  echo
  echo '```'
  git ls-files | sort | awk -F/ '{
    indent="";
    for (i=1;i<NF;i++) indent=indent "  ";
    print indent $NF;
  }'
  echo '```'
  echo
  echo "## Head"
  echo
  git log -1 --pretty=format:'%H%n%ad%n%s' --date=iso
  echo
} > "$OUT"
echo "wrote $OUT"
