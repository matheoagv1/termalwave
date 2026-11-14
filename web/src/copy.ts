// Textos visibles que no vienen de app-config.json. ES-AR-SGO.
// Si el VPS los quiere en config/santiago.toml [web], se mueven sin tocar la lógica.
export const COPY = {
  play: "Reproducir",
  pause: "Pausar",
  frameMissing: (layer: string, year: number): string =>
    `No hay imagen de ${layer} para ${year}.`,
  aoi: (name: string): string => `Área de estudio: ${name}`,
  opacity: "Opacidad de la capa",
  resetView: "Volver al área de estudio",
  captionSeparator: " · ",
} as const;
