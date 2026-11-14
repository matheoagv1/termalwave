import { createRoot } from "react-dom/client";
import "./app/theme.css";
import { App } from "./app/App";
import { hashParams } from "./app/hash";
import { ConfigProvider } from "./data/config-provider";
import { MockProvider } from "./tw/mock-provider.js";
import { MockScene } from "./tw/mock-scene.js";
import type { DataProvider, SceneApi } from "./tw/contract";

// Modo demo: #mock=1 o cualquier #escenario=... usa los datos de ejemplo.
// Sin eso la app lee el backend (dataset.json o app-config.json).
const params = hashParams();
const demo = params.mock === "1" || !!params.escenario;

const makeProvider = (scenario: string): DataProvider =>
  demo ? (new MockProvider({ scenario }) as unknown as DataProvider) : new ConfigProvider("./");

// Interino: la escena DOM del diseño dibuja el globo y el territorio.
// MapLibreScene la reemplaza detrás de la misma interfaz SceneApi.
const makeScene = (opts: ConstructorParameters<typeof MockScene>[0]): SceneApi =>
  new MockScene(opts) as unknown as SceneApi;

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <App
      makeProvider={makeProvider}
      makeScene={makeScene}
      allowScenarios={demo}
      theme="dark"
      reducedMotion={false}
    />,
  );
}
