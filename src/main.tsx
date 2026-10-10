import { createRoot } from "react-dom/client";
import App from "./App";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
createRoot(document.getElementById("root")!).render(<App />);
