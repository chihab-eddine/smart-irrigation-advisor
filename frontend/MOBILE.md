# Building the mobile app with Capacitor

The web app is already structured so that the **same React code** that runs in
the browser also runs inside a Capacitor (iOS/Android) shell. The camera
helper at `lib/camera.js` chooses the right path automatically:

| Environment | Camera path |
|---|---|
| Web on desktop | HTML file picker (gallery only) |
| Web on mobile browser | `<input capture="environment">` opens the OS camera |
| Capacitor on iOS/Android | `@capacitor/camera` plugin → native camera UI |

No frontend code change is needed to switch between web and native.

## What's already in place

- [`lib/camera.js`](lib/camera.js) — `pickImage({ source: "camera" | "gallery" })`. Dynamically imports `@capacitor/camera` if installed; falls back to the hidden `<input>` if not. Safe to deploy to web before installing Capacitor.
- [`capacitor.config.json`](capacitor.config.json) — app id `ma.smartirrigation.app`, web dir `out`, Camera permission text in FR + AR.
- The disease detection page exposes **two buttons**: "Prendre une photo" (camera) and "Importer" (gallery). Both call the same helper.

## What you need to do (one-time)

The mobile build needs Next.js to **statically export** the frontend so
Capacitor can bundle the resulting files into the native shell.

### 1. Install Capacitor

```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/camera
npm install @capacitor/android @capacitor/ios
```

### 2. Configure Next.js for static export

For the mobile build, the frontend must talk to a **deployed backend** (no
Next API routes in the static bundle). Create a separate config file or set
`output: "export"` in `next.config.mjs` for the mobile build target:

```js
// next.config.mjs (for mobile build)
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
```

> ⚠️ This conflicts with API routes used in dev. Either:
> - Use environment-conditional config: `output: process.env.MOBILE_BUILD === "1" ? "export" : undefined`
> - Or maintain a separate `mobile/next.config.mjs`.

### 3. Set NEXT_PUBLIC_API_URL to your deployed backend

```bash
echo "NEXT_PUBLIC_API_URL=https://api.your-domain.com" > .env.production
```

### 4. Build the static bundle

```bash
MOBILE_BUILD=1 npm run build      # produces ./out/
```

### 5. Add native platforms

```bash
npx cap init    # only once — confirms the appId/appName from capacitor.config.json
npx cap add android
npx cap add ios   # macOS only
```

### 6. Sync and open in native IDE

```bash
npx cap sync        # copies ./out into the native projects
npx cap open android   # opens Android Studio
npx cap open ios       # opens Xcode (macOS only)
```

From there you build and sign as usual through the native IDE.

## Camera permissions on native

### Android
Edit `android/app/src/main/AndroidManifest.xml` and add:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### iOS
Edit `ios/App/App/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Autorisez l'accès à la caméra pour photographier vos feuilles.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Sélectionnez une photo existante depuis votre galerie.</string>
```

## Testing the camera flow

### On the web (right now)

- Desktop Chrome/Firefox: the "Prendre une photo" button opens the system file picker (no camera on desktop without WebRTC stream — that's the OS limitation).
- Mobile Chrome/Safari on a real device: the same button opens the device camera directly thanks to `capture="environment"`.

### Inside Capacitor

After `npx cap run android` or `npx cap run ios`, the native camera UI appears
instead. Cancelling, denying permission, or returning no photo all resolve
gracefully (no crash).

## Updating after frontend changes

Each time you change React code:

```bash
MOBILE_BUILD=1 npm run build && npx cap sync
```

That's it. No native code changes needed for typical UI work.

## Live reload during native dev (optional)

Run the web app locally with `npm run dev`, then point Capacitor at it for hot
reload during native debugging:

```bash
# In capacitor.config.json, temporarily add:
"server": { "url": "http://<your-machine-LAN-ip>:3000", "cleartext": true }
```

Sync, then `npx cap run android`. Edits to React code reload instantly on the
device. Remove the `server.url` line before doing a release build.
