#!/usr/bin/env bash
#
# Conformance against the authoritative parser's own corpus.
#
# `cratestack-parser` (chumsky) decides what `.cstack` *means*; this grammar
# only has to agree with it about *shape*. The cheapest way to stop the two
# drifting is to point this grammar at every `.cstack` file the cratestack repo
# ships and require that none produce an ERROR node.
#
# Note what this deliberately does NOT do: the repo's `semantic_error_*`
# fixtures (unknown relation, duplicate field, out-of-range status) are
# *syntactically* well-formed and must parse cleanly here. Rejecting them would
# mean this grammar had started doing semantic analysis, which is the
# authoritative parser's job — and an editor that stops highlighting because a
# relation target does not exist yet is an editor that stops highlighting
# constantly. Only files that are genuinely malformed *as syntax* are expected
# to fail, and they are listed explicitly below rather than matched by name,
# because the `semantic_error_` prefix says nothing about which kind of error
# a fixture carries.
#
# Usage: test/conformance.sh /path/to/cratestack
set -uo pipefail

REPO="${1:-}"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  echo "usage: $0 /path/to/cratestack-checkout" >&2
  exit 2
fi

TS="${TREE_SITTER:-npx --yes tree-sitter-cli@0.26.13}"

# Fixtures that are malformed as SYNTAX and must therefore fail to parse.
# `semantic_error_malformed_policy.cstack` closes an attribute with an
# unbalanced paren: `@@allow("read", (banned)`.
SYNTACTICALLY_INVALID=(
  "crates/cratestack-macros/tests/fixtures/semantic_error_malformed_policy.cstack"
)

is_expected_failure() {
  local relative="$1"
  local candidate
  for candidate in "${SYNTACTICALLY_INVALID[@]}"; do
    [ "$relative" = "$candidate" ] && return 0
  done
  return 1
}

total=0
failed=0
expected_failures=0
wrongly_accepted=0

while IFS= read -r file; do
  total=$((total + 1))
  relative="${file#"$REPO"/}"

  if $TS parse "$file" --quiet >/dev/null 2>&1; then
    parsed=0
  else
    parsed=1
  fi

  if is_expected_failure "$relative"; then
    expected_failures=$((expected_failures + 1))
    if [ "$parsed" -eq 0 ]; then
      wrongly_accepted=$((wrongly_accepted + 1))
      echo "UNEXPECTEDLY ACCEPTED (malformed syntax): $relative"
    fi
  elif [ "$parsed" -ne 0 ]; then
    failed=$((failed + 1))
    echo "FAILED TO PARSE: $relative"
    $TS parse "$file" 2>/dev/null | grep -E "ERROR|MISSING" | head -3 | sed 's/^/    /'
  fi
done < <(find "$REPO" -name "*.cstack" -not -path "*/target/*" | sort)

echo "---"
echo "schemas parsed:       $((total - expected_failures))"
echo "expected failures:    $expected_failures"
echo "unexpected errors:    $failed"
echo "wrongly accepted:     $wrongly_accepted"

if [ "$total" -eq 0 ]; then
  echo "no .cstack files found — wrong path?" >&2
  exit 2
fi
if [ "$failed" -ne 0 ] || [ "$wrongly_accepted" -ne 0 ]; then
  exit 1
fi
echo "OK"
