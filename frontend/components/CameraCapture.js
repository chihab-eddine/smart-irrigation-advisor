"use client";

/**
 * In-app camera modal using getUserMedia (WebRTC).
 *
 * Works on:
 *   - Desktop Chrome/Firefox/Edge/Safari → uses the webcam
 *   - Mobile browsers → uses the rear camera by default (facingMode: 'environment')
 *
 * On the Capacitor mobile build we DON'T use this modal — the caller checks
 * for a native context and routes to the native camera plugin instead (see
 * lib/camera.js). This component is the web-only fallback.
 *
 * Props:
 *   open      boolean   show/hide the modal
 *   onClose   ()=>void  called when the user cancels
 *   onCapture (File)=>void  called with a JPEG File when the user snaps
 */

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import Icon from "@/components/Icon";

export default function CameraCapture({ open, onClose, onCapture }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [facing, setFacing] = useState("environment");
  const [ready, setReady] = useState(false);

  // Start / restart the stream whenever the modal is opened or the facing flips
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setError("");
      setReady(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            ar
              ? "متصفحك لا يدعم الوصول إلى الكاميرا."
              : "Votre navigateur ne supporte pas l'accès caméra."
          );
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for first frame so the canvas size is meaningful when we snap
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.name === "NotAllowedError"
              ? ar
                ? "تم رفض إذن الكاميرا."
                : "Permission caméra refusée."
              : err?.name === "NotFoundError"
              ? ar
                ? "لم يتم العثور على كاميرا."
                : "Aucune caméra détectée."
              : err?.message || "Camera error"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [open, facing, ar]);

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    // Flip horizontally when using the front camera so the result matches what
    // the user saw on screen (selfie convention).
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `leaf-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  };

  const flipCamera = () => setFacing((f) => (f === "environment" ? "user" : "environment"));

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-white/10 hover:bg-white/20 text-sm"
          aria-label={ar ? "إغلاق" : "Fermer"}
        >
          <Icon name="close" className="h-4 w-4" />
          {ar ? "إلغاء" : "Annuler"}
        </button>
        <button
          type="button"
          onClick={flipCamera}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-white/10 hover:bg-white/20 text-sm"
          aria-label={ar ? "قلب الكاميرا" : "Inverser caméra"}
        >
          <Icon name="refresh" className="h-4 w-4" />
          {ar ? "قلب" : "Inverser"}
        </button>
      </div>

      {/* Video viewport */}
      <div className="flex-1 flex items-center justify-center px-4">
        {error ? (
          <div className="max-w-sm text-center text-white">
            <Icon name="alertTriangle" className="h-10 w-10 mx-auto text-amber-300 mb-3" />
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 inline-flex items-center justify-center h-10 px-4 rounded-md bg-white text-gray-900 text-sm font-medium hover:bg-gray-100"
            >
              {ar ? "العودة" : "Retour"}
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-2xl aspect-video bg-black rounded-md overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facing === "user" ? "scale-x-[-1]" : ""}`}
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                {ar ? "جاري فتح الكاميرا..." : "Ouverture de la caméra..."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Capture button */}
      <div className="p-6 flex justify-center">
        <button
          type="button"
          onClick={handleSnap}
          disabled={!ready || !!error}
          aria-label={ar ? "التقاط" : "Capturer"}
          className="h-16 w-16 rounded-full bg-white border-4 border-white/40 hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100"
        />
      </div>
    </div>
  );
}
