import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const platform = process.argv[2];
if (!["android", "ios"].includes(platform))
  throw new Error("Choose android or ios");
const origin = process.env.VITE_API_ORIGIN;
if (
  !origin ||
  !origin.startsWith("https://") ||
  new URL(origin).origin !== origin
) {
  throw new Error(
    "Set VITE_API_ORIGIN to the deployed HTTPS API origin, without a trailing slash"
  );
}
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
run("npm", ["run", "build"]);
if (!existsSync(platform)) run("npx", ["cap", "add", platform]);
run("npx", ["cap", "sync", platform]);
if (platform === "android") {
  const manifest = "android/app/src/main/AndroidManifest.xml";
  let xml = readFileSync(manifest, "utf8").replace(
    'android:allowBackup="true"',
    'android:allowBackup="false"'
  );
  for (const permission of [
    "RECORD_AUDIO",
    "CAMERA",
    "MODIFY_AUDIO_SETTINGS",
    "WAKE_LOCK",
  ]) {
    if (!xml.includes("android.permission." + permission))
      xml = xml.replace(
        "</manifest>",
        `<uses-permission android:name="android.permission.${permission}" />\n</manifest>`
      );
  }
  writeFileSync(manifest, xml);
  for (const file of ["MainActivity.java", "CallAudioPlugin.java"])
    copyFileSync(
      "native/android/" + file,
      "android/app/src/main/java/app/quickchat/preview/" + file
    );
} else {
  const delegate = "ios/App/App/AppDelegate.swift";
  const marker = "// QUICK_CHAT_CALL_AUDIO";
  const original = readFileSync(delegate, "utf8").split(marker)[0];
  writeFileSync(
    delegate,
    original +
      "\n" +
      marker +
      "\n" +
      readFileSync("native/ios/CallAudio.swift", "utf8")
  );
  const storyboard = "ios/App/App/Base.lproj/Main.storyboard";
  writeFileSync(
    storyboard,
    readFileSync(storyboard, "utf8").replace(
      'customClass="CAPBridgeViewController" customModule="Capacitor"',
      'customClass="CallViewController" customModule="App"'
    )
  );
  const plist = "ios/App/App/Info.plist";
  let xml = readFileSync(plist, "utf8");
  for (const [key, description] of Object.entries({
    NSMicrophoneUsageDescription:
      "Use your microphone for Quick Chat calls and voice messages.",
    NSCameraUsageDescription:
      "Use your camera for Quick Chat video calls and photos.",
  })) {
    if (!xml.includes("<key>" + key + "</key>"))
      xml = xml.replace(
        "</dict>",
        "<key>" + key + "</key><string>" + description + "</string>\n</dict>"
      );
  }
  writeFileSync(plist, xml);
}
console.log(
  `${platform} project prepared. Open it with npx cap open ${platform}; device build/signing is a separate step.`
);
