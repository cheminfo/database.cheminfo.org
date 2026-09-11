#!/bin/sh
# The analytics snippet belongs to the deployment, not to the build: the page a
# visitor is handed carries whatever `TRACKING_SCRIPT` holds, and an unset
# variable means no counter is loaded at all — which is what a developer's
# checkout, and a staging container, want. Nothing analytics-shaped is in the
# sources or in the image.
set -e

BUILD=/public-src
SERVED=/public

if [ -n "$TRACKING_SCRIPT" ]; then
  # `-R`, not `-a`: the destination is a tmpfs the server user does not own,
  # so preserving times and ownership would fail on it for no gain.
  cp -R "$BUILD/." "$SERVED/"
  # One real HTML file per routed address is prerendered, so every one of them
  # has to carry the snippet — not only the home page.
  find "$SERVED" -name '*.html' -type f | while IFS= read -r file; do
    awk '
      !injected && index($0, "</head>") {
        at = index($0, "</head>")
        printf "%s%s\n%s\n", substr($0, 1, at - 1), ENVIRON["TRACKING_SCRIPT"], substr($0, at)
        injected = 1
        next
      }
      { print }
    ' "$file" >"$file.tmp" && mv "$file.tmp" "$file"
  done
  SERVER_ROOT="$SERVED"
else
  SERVER_ROOT="$BUILD"
fi
export SERVER_ROOT

exec /usr/local/bin/entrypoint.sh "$@"
