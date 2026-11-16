# Lista completa de revisión de diseño

De: cricri
Para: carne
Estado: abierto

## Pedido del usuario

1. **Introducción con el mago.** Al abrir la aplicación, el mago aparece en primer plano, saluda y pregunta el nombre y el rubro. Debe animarse mientras interactúa.

2. **Fondo durante la introducción.** La Tierra y el espacio aparecen detrás del mago, difuminados.

3. **Transición al mapa.** Al terminar la introducción, el fondo recupera nitidez y el mago se minimiza en una esquina.

4. **Área de estudio.** Eliminar el recuadro actual porque ocupa espacio y genera ruido visual.

5. **Sonido.** Agregar efectos sencillos para acciones del mago, el planeta, el zoom y otros controles. Propongo que puedan desactivarse.

6. **Branding.** Para la esquina superior izquierda, elegir la variante del logo sin texto, que sea legible en ese espacio. Ajustar su tamaño, formato y composición con el resto de la interfaz.

7. **Atribución NASA GIBS.** Corregir el texto negro de la esquina inferior derecha y mostrarlo en blanco para que sea legible.

8. **PWA y adaptación.** Preparar el frontend como aplicación web progresiva, con una base de código compartida y una interfaz adaptada a computadoras, tablets y teléfonos. La arquitectura debe evitar duplicaciones y facilitar el mantenimiento. La disponibilidad sin conexión deberá definirse según los datos y recursos que puedan guardarse.

9. **Transiciones.** Agregar animaciones 3D suaves y coherentes, con rotación cuando corresponda. Deben ayudar a entender los cambios de vista y permitir que el usuario siga trabajando. El mago conserva su estilo pixel art.

10. **Capas y ayuda.** Rediseñar el menú de capas para que se comprenda qué muestra cada una. Incorporar ayudas contextuales conectadas al mago, que aparezcan cuando puedan orientar al usuario.

11. **Mago minimizado.** Después de la introducción, queda en una esquina. Vuelve a aparecer cuando tiene información útil, una sugerencia o una pregunta que ayude a refinar la exploración.

12. **Rubros.** La pregunta inicial sirve para conocer si el usuario trabaja en un área relacionada. Según su respuesta, la aplicación puede destacar capas e interpretaciones de interés. Debe seguir siendo posible explorar más proveedores y resultados, incluidas estimaciones o predicciones cuando existan y estén sustentadas por los datos.

13. **Línea de tiempo.** Rediseñarla para que se entienda qué fecha o período está seleccionado, cómo comparar momentos y qué datos existen en cada punto. La revisión debe guiarse por las prácticas de la skill de frontend de Claude.

Rubros disponibles en el repositorio: Agricultura; Ganadería y pasturas; Gestión del agua; Ambiente y conservación; Gestión de emergencias; Ordenamiento territorial; Infraestructura; Ciencia y educación.

## Skill solicitada

Skill oficial frontend-design de Anthropic: https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md

La referencia fue consultada para este pedido. Para la línea de tiempo, aplicá su proceso de planificar con contenido real, revisar el diseño frente al pedido, implementar y evaluar. Considerá foco visible, adaptación móvil y movimiento reducido. La skill no está instalada localmente en esta sesión: consultá el enlace antes de implementar.

## Respuesta esperada

Confirmar recepción de los 13 puntos y coordinar la implementación con el equipo.