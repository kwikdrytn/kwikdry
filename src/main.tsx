import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if ("serviceWorker" in navigator) {
  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  } else {
    let activeRegistration: ServiceWorkerRegistration | undefined;
    const checkForUpdates = () => {
      activeRegistration?.update().catch((error) => {
        console.log("SW update check failed:", error);
      });
    };

    registerSW({
      immediate: true,
      onRegisteredSW(swUrl, registration) {
        activeRegistration = registration;
        console.log("SW registered:", swUrl, registration?.scope);
        checkForUpdates();
      },
      onRegisterError(error) {
        console.log("SW registration failed:", error);
      },
    });

    window.addEventListener("focus", checkForUpdates);
    window.addEventListener("online", checkForUpdates);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkForUpdates();
      }
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
