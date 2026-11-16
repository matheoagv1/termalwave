import type { Lang } from "../app/i18n";

const RULES: Record<Lang, Array<[RegExp, string]>> = {
  es: [
    [/reproducir|pausar/i, "Este botón pasa las fechas solas, una tras otra, como una película. Así ves cómo cambia el terreno con el tiempo sin tener que hacer clic. Podés pausar cuando quieras."],
    [/comparar/i, "Comparar muestra dos fechas de la capa activa. Podés ponerlas lado a lado, o separarlas con una cortina que se arrastra."],
    [/punto (anterior|siguiente)/i, "Cada punto de la línea de tiempo es una fecha con una imagen. Estas flechas te mueven de a una fecha."],
    [/tierra|volver a la tierra|orbit/i, "Te lleva de vuelta a la vista del planeta entero. Desde ahí podés volver a acercarte al área de estudio."],
    [/años|tiempo real|estás viendo|fecha seleccionada/i, "La barra de Años muestra todo el período con datos. El rombo marca en qué momento estás. Hacé clic en una fecha o usá las flechas."],
    [/inclinaci|relieve/i, "Inclina la cámara para ver el terreno en perspectiva. Si el relieve no está disponible, la vista queda plana."],
    [/norte/i, "Fija o suelta la orientación. Con el norte arriba, el mapa se lee como uno de papel."],
    [/interfaz|plegar|desplegar|ocultar|mostrar/i, "Los paneles se pueden plegar u ocultar para dejar más lugar al mapa."],
    [/capa|leyenda|mapa base/i, "Una capa es una forma de mirar la misma zona: radar, suelo, contaminación o incendios. La leyenda dice qué significan los colores."],
    [/ficha|fuente|lectura/i, "Acá hay datos del área: de dónde salen las imágenes, qué mide cada capa y cómo leerlas."],
    [/buscar|coordenadas/i, "Escribí el nombre de un lugar o unas coordenadas y el mapa te lleva hasta ahí."],
    [/sonido/i, "Activa o apaga los sonidos. Podés cambiarlo cuando quieras."],
  ],
  en: [
    [/play|pause/i, "This steps through the dates on its own, like a short film, so you can watch the ground change. Pause whenever you want."],
    [/compare/i, "Compare shows two dates of the active layer. You can place them side by side, or split them with a curtain you drag."],
    [/previous point|next point/i, "Each timeline point is a date with an image. These arrows move one date at a time."],
    [/back to earth|whole earth/i, "This returns you to the wide view of the planet. From there you can frame the study area again."],
    [/years|selected date|you are at/i, "The Years bar covers the whole period that has data. The diamond marks the moment you are on."],
    [/tilt|terrain/i, "Tilt the camera to see the ground in perspective. If terrain is unavailable, the view stays flat."],
    [/north/i, "Lock or free the map orientation. North up reads like a paper map."],
    [/interface|hide|show/i, "Panels can fold or hide so the map has more room."],
    [/layer|legend|basemap/i, "A layer is one way to look at the same place: radar, soil, contamination, or fire. The legend says what the colors mean."],
    [/card|source|insight/i, "This holds the area's data: where the images come from, what each layer measures, and how to read it."],
    [/search|coordinate/i, "Type a place name or coordinates and the map goes there."],
    [/sound/i, "Turn the sounds on or off. You can change that whenever you want."],
  ],
};

const FALLBACK: Record<Lang, (tip: string) => string> = {
  es: (tip) => `${tip}. Si no estás seguro de qué hace, probalo: mirar el mapa no cambia ningún dato.`,
  en: (tip) => `${tip}. If you are not sure what it does, try it. Looking at the map does not change any data.`,
};

export function longHelp(tip: string, lang: Lang): string {
  const rules = RULES[lang] ?? RULES.en;
  for (const [re, text] of rules) if (re.test(tip)) return text;
  return (FALLBACK[lang] ?? FALLBACK.en)(tip);
}
