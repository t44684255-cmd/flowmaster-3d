// Loads the Cesium runtime from the official CDN and configures the ion token.
// The token is a client-side ion key; it is never surfaced in the UI.

const CESIUM_VERSION = "1.126.0";
const BASE = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;

const ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNLZHJQd0k0SFByX3FVM2giLCJqdGkiOiI1OTdlYWUzZS1jZTU0LTRhNzAtOGUyYy1hMGU5OWYxZDU2MDgiLCJpZCI6NDgzMjQ3LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODg4NTMxNDZ9.ET4es_fLEsgLR_LJstEtcoNDwBpHhnp2kosqHSvAj0M";

/* eslint-disable @typescript-eslint/no-explicit-any */
let loader: Promise<any> | null = null;

export function loadCesium(): Promise<any> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cesium can only load in the browser"));
      return;
    }
    const w = window as any;
    if (w.Cesium) {
      w.Cesium.Ion.defaultAccessToken = ION_TOKEN;
      resolve(w.Cesium);
      return;
    }
    w.CESIUM_BASE_URL = BASE;

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${BASE}Widgets/widgets.css`;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = `${BASE}Cesium.js`;
    script.async = true;
    script.onload = () => {
      const C = w.Cesium;
      if (!C) {
        reject(new Error("Cesium runtime unavailable"));
        return;
      }
      C.Ion.defaultAccessToken = ION_TOKEN;
      resolve(C);
    };
    script.onerror = () => reject(new Error("Failed to load the Cesium runtime"));
    document.head.appendChild(script);
  });
  return loader;
}
