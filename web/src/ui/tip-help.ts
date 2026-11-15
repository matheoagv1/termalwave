// Explicaciones largas para el mago, pensadas para quien no conoce el tema.
// Se elige la primera regla cuyo patron coincide con el texto del tooltip.
const RULES: Array<[RegExp, string]> = [
  [/reproducir|pausar/i, "Este botón pasa las fechas solas, una tras otra, como una película. Así ves cómo cambia el terreno con el tiempo sin tener que hacer clic. Puedes pausar cuando quieras."],
  [/comparar/i, "Comparar sirve para ver dos fechas a la vez. Una cortina divide la imagen: a un lado queda una fecha y al otro la otra. Arrastra la cortina para ver qué cambió entre una y otra."],
  [/punto (anterior|siguiente)/i, "Cada punto de la línea de tiempo es una fecha con una imagen del satélite. Estas flechas te mueven de a una fecha, hacia atrás o hacia adelante."],
  [/tierra completa|volver a la tierra|orbit/i, "Te lleva de vuelta a la vista del planeta entero, como si lo miraras desde el espacio. Desde ahí puedes volver a acercarte al área de estudio."],
  [/años|tiempo real|estás viendo|fecha seleccionada/i, "La barra de Años muestra todo el período con datos, de la fecha más antigua a la más reciente. El rombo marca en qué momento estás parado. Haz clic en una fecha o usa las flechas para moverte en el tiempo."],
  [/ubicaci|dónde estás|zona de estudio/i, "Acá ves en qué lugar del mundo estás mirando: el área de estudio y sus coordenadas. Si quieres ir a otro sitio, usa el buscador."],
  [/inclinaci|relieve/i, "Inclina la cámara para ver el terreno en perspectiva, como si volaras. Si el relieve no está disponible, la vista queda plana."],
  [/norte/i, "Fija o suelta la orientación del mapa. Con el norte arriba, el mapa se lee como uno de papel."],
  [/interfaz|plegar|desplegar|ocultar|mostrar/i, "Los paneles se pueden plegar u ocultar para dejar más lugar al mapa. Puedes volver a abrirlos cuando los necesites."],
  [/capa|leyenda|mapa base/i, "Una capa es una forma de mirar la misma zona: radar, suelo, contaminación o incendios. Elige una y el mapa cambia. La leyenda te dice qué significan los colores."],
  [/ficha|fuente|lectura/i, "Acá hay datos y explicaciones del área: de dónde salen las imágenes, qué mide cada capa y cómo leerlas según tu oficio."],
  [/buscar|coordenadas/i, "Escribe el nombre de un lugar o unas coordenadas y el mapa te lleva hasta ahí."],
  [/sonido/i, "Activa o apaga los sonidos de la aplicación. Puedes cambiarlo cuando quieras."],
];

export function longHelp(tip: string): string {
  for (const [re, txt] of RULES) if (re.test(tip)) return txt;
  return `${tip}. Si no estás seguro de qué hace, pruébalo: mirar el mapa no cambia ningún dato.`;
}