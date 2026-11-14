// Textos visibles que no vienen de app-config.json. ES-AR-SGO.
// Si el VPS los quiere en config/santiago.toml [web], se mueven sin tocar la lógica.
export const COPY = {
  play: "Reproducir",
  pause: "Pausar",
  frameMissing: (layer: string, year: number): string =>
    `No hay imagen de ${layer} para ${year}.`,
  captionSeparator: " · ",
} as const;
