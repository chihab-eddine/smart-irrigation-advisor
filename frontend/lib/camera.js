/**
 * Camera helper — Capacitor when wrapped as a native app, HTML5 otherwise.
 *
 * Why both?
 *   - In a regular web browser: `<input type="file" accept="image/*" capture="environment">`
 *     opens the device camera on mobile and the file picker on desktop. Zero deps.
 *   - Inside a Capacitor (iOS/Android) shell: `@capacitor/camera` gives a real
 *     native camera UI, proper permission prompts, and better integration.
 *
 * `isCapacitor()` is dynamic so this file works whether or not the Capacitor
 * packages are installed. The native imports are wrapped in try/catch so the
 * web build never blows up on a missing module.
 */

let _capacitorChecked = false;
let _isNative = false;

async function isCapacitor() {
  if (_capacitorChecked) return _isNative;
  _capacitorChecked = true;
  try {
    const { Capacitor } = await import("@capacitor/core");
    _isNative = Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  } catch {
    _isNative = false;
  }
  return _isNative;
}

/**
 * Sentinel returned by pickImage() when the caller should open the web camera
 * modal instead of receiving a File directly. This happens when source ===
 * "camera" and we're on the web (not native) — the actual UI is a React
 * component (CameraCapture) that the caller controls.
 */
export const USE_WEB_CAMERA = Symbol("USE_WEB_CAMERA");

/**
 * Open the device camera or gallery.
 *
 *   - Capacitor native (iOS / Android via wrapper): uses @capacitor/camera
 *   - Web, source="gallery": opens the file picker via the hidden <input>
 *   - Web, source="camera":  returns USE_WEB_CAMERA — the caller should open
 *                            its own <CameraCapture> modal (WebRTC-based).
 *                            This gives a real camera UI on desktop AND mobile
 *                            browsers, unlike `<input capture>` which falls
 *                            back to the file picker on desktop.
 *
 * Resolves with a File, null (cancelled), or USE_WEB_CAMERA.
 */
export async function pickImage({ fallbackInput, source = "camera" } = {}) {
  if (await isCapacitor()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: source === "gallery" ? CameraSource.Photos : CameraSource.Camera,
        quality: 85,
        allowEditing: false,
        saveToGallery: false,
      });
      if (!photo?.base64String) return null;
      const mime = `image/${photo.format || "jpeg"}`;
      const blob = base64ToBlob(photo.base64String, mime);
      return new File([blob], `capture.${photo.format || "jpg"}`, { type: mime });
    } catch (err) {
      if (err?.message?.toLowerCase().includes("cancel")) return null;
      throw err;
    }
  }

  // ---- Web path ----
  // Real camera UI: caller opens its own WebRTC modal.
  if (source === "camera") return USE_WEB_CAMERA;

  // Gallery → file picker.
  if (!fallbackInput) return null;
  fallbackInput.removeAttribute("capture");

  return new Promise((resolve) => {
    const onChange = () => {
      fallbackInput.removeEventListener("change", onChange);
      const file = fallbackInput.files?.[0] || null;
      resolve(file);
    };
    fallbackInput.addEventListener("change", onChange, { once: true });
    fallbackInput.click();
  });
}

function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export const __testing = { isCapacitor, base64ToBlob };
