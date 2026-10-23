#!/usr/bin/env bash
#
# Build the Android app (debug APK) for one deployment — `npm run apk`.
#
# The APK carries the web app's static export, and the export has the relay,
# district service and assistant addresses (and its Content Security Policy)
# fixed at build time. So each deployment builds its own APK:
#
#   NEXT_PUBLIC_MESH_URL        relay, e.g. https://<relay>.vercel.app or
#                               http://<facility LAN IP>:3001 (required)
#   NEXT_PUBLIC_REPORTING_URL   district service (optional)
#   NEXT_PUBLIC_CHAT_URL        assistant (optional)
#   NEXT_PUBLIC_MESH_TRANSPORT  "http" for a hosted relay (no websockets)
#   NEXT_PUBLIC_DEPLOYMENT_MODE "production" for a production APK
#
# The export is built in a scratch copy so a running `next dev` keeps its .next;
# plain-HTTP hosts above are the only cleartext the APK may use
# (scripts/android-network-config.mts). Needs a JDK: Android Studio's is used
# when JAVA_HOME is unset. Output: dist/NalamMesh-<mode>-debug.apk
#
# Usage: NEXT_PUBLIC_MESH_URL=http://10.0.2.2:3001 bash scripts/build-apk.sh

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${NEXT_PUBLIC_MESH_URL:?Set NEXT_PUBLIC_MESH_URL to the relay this APK should use}"
MODE="${NEXT_PUBLIC_DEPLOYMENT_MODE:-evaluation}"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/nalammesh-apk.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

if [ -z "${JAVA_HOME:-}" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
: "${JAVA_HOME:?Set JAVA_HOME to a JDK (Android Studio ships one)}"

echo "▸ Static export ($MODE) for relay $NEXT_PUBLIC_MESH_URL"
rsync -a --exclude node_modules --exclude .next --exclude out --exclude android --exclude .git --exclude dist "$REPO/" "$STAGE/"
ln -s "$REPO/node_modules" "$STAGE/node_modules"
(cd "$STAGE" && npx next build >"$STAGE/build.log" 2>&1) || { tail -40 "$STAGE/build.log"; exit 1; }

echo "▸ Android project"
rm -rf "$REPO/out" && cp -R "$STAGE/out" "$REPO/out"
cd "$REPO"
npx tsx scripts/android-network-config.mts
npx cap sync android >/dev/null

echo "▸ Gradle"
(cd android && ./gradlew assembleDebug -q)
mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk "dist/NalamMesh-$MODE-debug.apk"
echo "✓ dist/NalamMesh-$MODE-debug.apk ($(du -h "dist/NalamMesh-$MODE-debug.apk" | cut -f1))"
