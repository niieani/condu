#!/bin/bash

# Ensure the correct number of arguments
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <date: YYYY-MM-DD> <file1> [file2] ... [fileN]"
  exit 1
fi

# Extract date and file list
DATE="$1"
shift
FILES=("$@")

# Function to get file contents from a specific date
get_file_contents() {
  local file=$1
  local date=$2
  local commit_hash

  commit_hash=$(git log -1 --before="$date" --pretty=format:"%H" -- "$file")
  if [[ -n $commit_hash ]]; then
    git --no-pager show "$commit_hash:$file"
  else
    echo "// File not found in history before $date"
  fi
}

# Generate markdown
for file in "${FILES[@]}"; do
  echo "# $file"

  echo ""
  echo "## before"
  echo '```ts'
  get_file_contents "$file" "$DATE"
  echo '```'

  echo ""
  echo "## after"
  echo '```ts'
  if [[ -f "$file" ]]; then
    cat "$file"
  else
    echo "// File does not exist in the current state"
  fi
  echo '```'
  echo ""
done
