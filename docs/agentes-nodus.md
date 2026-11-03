# Referencia de Nodus para agentes

Esta referencia describe las herramientas MCP y el comportamiento del editor para que un agente pueda operar Nodus sin inspeccionar el código fuente. La herramienta MCP `nodus_get_manual` expone estas secciones desde la aplicación que está ejecutándose:

- `overview`: procedimiento y mapa de temas.
- `commands`: manual completo de la consola, con sintaxis, parámetros, permisos y ejemplos.
- `nodes`: campos, estilos y propiedades avanzadas de nodos.
- `connections`: rutas, estilos y propiedades avanzadas de conexiones.
- `workflows`: procedimientos para construir y verificar diagramas.

En clientes MCP los nombres se muestran con guion bajo, por ejemplo `nodus_get_manual`; JSON-RPC directo usa el nombre interno `nodus.get_manual`.

<!-- MCP_TOPIC:overview:START -->
## Cómo trabajar con Nodus

Antes de diseñar o editar un diagrama, consulta `nodus_get_manual` con el tema que necesites. Si no sabes qué tema aplica, consulta `overview` y luego `nodes`, `connections` o `workflows`. Para una tarea que implique comandos poco comunes, consulta también `commands`.

La aplicación ejecuta las operaciones en la sala abierta y bajo la sesión actual. Primero inspecciona el estado y confirma el proyecto activo. No cambies ni borres contenido existente si la petición no lo autoriza. En tareas de prueba, crea un proyecto temporal con nombre explícito y no lo elimines hasta confirmar su identidad.

Flujo recomendado:

1. Llama `nodus_inspect_app` para identificar pantalla, sesión y controles disponibles.
2. En lobby, usa `nodus_list_projects` y `nodus_open_project` o `nodus_create_project` solo según la petición.
3. En editor, usa `nodus_inspect_diagram`, `nodus_list_nodes` y `nodus_list_connections` antes de editar.
4. Construye el diagrama con las herramientas tipadas. Para propiedades avanzadas, estilos de conexión u otras funciones cubiertas solo por la consola, usa `nodus_command` con una sola instrucción de Nodus.
5. Vuelve a listar y leer los objetos relevantes; no des por verificado un cambio solo porque la operación de escritura devolvió éxito.
6. Si una respuesta incluye `structuredContent.items`, es una lista de objetos. Conserva los IDs exactos al realizar cambios posteriores.

Las herramientas disponibles dependen de la pantalla y del rol. La ausencia de una herramienta puede ser intencional; no intentes eludir permisos. Nodus pide confirmación visible para ciertas acciones sensibles. No uses `--yes` con llamadas externas: está bloqueado.

### Herramientas MCP actuales

- `nodus_inspect_app`: pantalla, sesión y datos generales de la vista.
- `nodus_list_projects`, `nodus_create_project`, `nodus_open_project`: proyectos y salas.
- `nodus_inspect_diagram`: estado del editor, selección, cámara, propiedades del proyecto e historial.
- `nodus_list_nodes`, `nodus_get_node`, `nodus_create_node`, `nodus_update_node`, `nodus_delete_node`: nodos.
- `nodus_list_connections`, `nodus_create_connection`, `nodus_delete_connection`: conexiones.
- `nodus_export_diagram`: exportar como PNG, SVG o JSON.
- `nodus_command`: una instrucción semántica de la consola. No es una terminal.
- `nodus_get_manual`: consultar esta referencia o la guía completa de comandos.

La lista concreta de cada momento se obtiene llamando `tools/list`; prevalece sobre este resumen. Solo se ofrecen las herramientas de edición en una sala donde el usuario tenga rol `owner` o `editor`.

### Límites de las herramientas tipadas

- `nodus_create_node` crea un nodo en el centro de la vista; no recibe coordenadas. Después puede colocarse con `nodus_update_node` (`x`, `y`).
- `nodus_update_node` solo edita los campos básicos anunciados en su esquema. Propiedades avanzadas se cambian con `nodus_command` y `node prop set`.
- No hay herramientas tipadas independientes para cambiar propiedades de conexión ni estilo de ruta. Usa `connection style` y `connection prop set` a través de `nodus_command`.
- Los selectores de nodos aceptan ID exacto o título exacto. Usa el ID cuando los títulos puedan repetirse.
- Crear una conexión entre dos nodos ya conectados puede fallar. No reintentes en bucle: lista las conexiones y comprueba primero.
<!-- MCP_TOPIC:overview:END -->

<!-- MCP_TOPIC:nodes:START -->
## Nodos: campos básicos y geometría

Las coordenadas se expresan en el espacio del diagrama, no en píxeles de pantalla. El zoom de la cámara no modifica las coordenadas del objeto.

| Campo | Qué representa | Restricciones y recomendaciones |
|---|---|---|
| `id` | Identificador único generado por Nodus. | No se cambia. Guarda el ID devuelto para referirte inequívocamente al objeto. |
| `title` / `name` | Texto centrado dentro del nodo. `name` es el nombre del argumento de `nodus_update_node`; en el modelo se guarda como `title`. | Puede estar vacío. Usa frases cortas; aumenta ancho/alto si el texto necesita espacio. |
| `x`, `y` | Esquina superior izquierda del nodo en coordenadas del diagrama. | Números finitos; posiciones finales se ajustan a la cuadrícula. |
| `width`, `height` | Ancho y alto del nodo. | Mínimo 60 × 40; el tamaño final se ajusta a la cuadrícula. Para mapas conceptuales, asigna tamaños coherentes y deja espacio al texto. |
| `color` | Color hexadecimal del relleno y color base de algunas decoraciones. | `#RGB`, `#RRGGBB` o `#RRGGBBAA`. En el editor básico suele elegirse un color RGB. |
| `opacity` | Opacidad del relleno y de las formas del nodo, de transparente a opaco. | De 0 a 1. Para que el nodo y su texto sean legibles, normalmente usa 1. |
| `radius` | Radio de las esquinas cuando `style` es 1. | No negativo; tiene efecto visual solo en rectángulos. Valor inicial 8. |
| `style` | Forma geométrica del nodo. | 1 rectángulo redondeado, 2 elipse, 3 diamante. Para modelado ER, el generador interpreta elipses como atributos y diamantes como relaciones. |
| `locked` / `lock` | Bloqueo para impedir manipulación accidental en el editor. | Booleano. `nodus_update_node` recibe `locked`; el modelo almacena `lock`. |
| `properties` | Diccionario de propiedades extra. | No tiene un esquema cerrado. Solo las claves reconocidas por Nodus tienen efecto visual o funcional; las demás se conservan como metadatos. |

Ejemplo de edición básica mediante MCP:

```json
{
  "name": "nodus_update_node",
  "arguments": {
    "selector": "ID-o-titulo-exacto",
    "x": 240,
    "y": 120,
    "width": 180,
    "height": 90,
    "color": "#336699",
    "opacity": 1,
    "radius": 10,
    "style": 1
  }
}
```

### Estilos geométricos de nodo

1. **`style: 1` — Rectangle:** rectángulo con esquinas redondeadas. `radius` controla el redondeo. Es el estilo normal para conceptos o entidades.
2. **`style: 2` — Ellipse:** elipse inscrita en el rectángulo `width × height`. El radio no cambia su forma.
3. **`style: 3` — Diamond:** rombo cuyos vértices están en el centro de cada lado del rectángulo `width × height`. El radio no cambia su forma.

El color y opacidad afectan al relleno. Si el nodo tiene propiedades de borde avanzadas, pueden sustituir el relleno o dibujar contornos adicionales; consulta la siguiente sección.

### Propiedades avanzadas de nodos

Las propiedades avanzadas se guardan en `properties`. Para cambiar una desde una herramienta MCP, usa por ejemplo `nodus_command` con `node prop set "ID-o-titulo" dashedBorder 3`. La consola interpreta `true`, `false`, `null`, números y objetos/arreglos JSON como sus tipos correspondientes; otros valores quedan como texto. En la UI de propiedades avanzadas los valores se editan como texto, así que para booleanos escribe `true` o `false`.

#### Borde y semántica de modelado

| Clave | Valor y efecto |
|---|---|
| `dashedBorder` | Activa el borde discontinuo. Su valor numérico indica la longitud de cada segmento; si falta o no es un número distinto de cero, se usa 3. En el render del canvas esta opción dibuja el contorno en lugar del relleno; no la combines esperando un relleno normal. En exportación SVG el comportamiento puede diferir. En la generación ER representa un atributo derivado cuando el nodo es una elipse. |
| `borderWidth` | Grosor del borde discontinuo; valor predeterminado 2. Solo se usa junto con `dashedBorder`. |
| `doubleBorder` | Dibuja un contorno exterior adicional si `dashedBorder` no está activo. Se usa como semántica de elemento débil o atributo multivaluado al generar ER, según el tipo de nodo. |
| `disjointMembership` | Dibuja bajo el nodo un arco curvo de generalización disjunta. Para el generador ER marca una generalización padre disjunta. |
| `overlappingMembership` | Dibuja bajo el nodo una línea discontinua de generalización solapada. Para el generador ER marca una generalización padre solapada. Si ambas claves están activas, `disjointMembership` tiene prioridad en la decoración dibujada. |
| `isSon` | Marca una entidad hija para el generador ER. Se combina con una conexión dirigida entre la entidad padre y la hija para asignar la jerarquía. |
| `widespread` | Aparece en la lista de claves sugeridas del panel avanzado, pero no tiene un efecto de render o acción identificado en la implementación actual. No lo uses esperando un cambio visible. |
| `code` | Muestra un control “Play Code” en la barra contextual de un nodo seleccionado; el manejador actual no ejecuta ninguna acción. No es un medio para ejecutar código. |

`doubleBorder`, `dashedBorder`, `underline`, `isSon` y las claves de membresía se interpretan por su verdad/falsedad en el generador/render. Para activarlas usa `true`; para desactivarlas, establece `false` o elimina la propiedad. La propiedad de falso puede seguir presente como metadato.

#### Texto del nodo

| Clave | Efecto |
|---|---|
| `fontSize` | Tamaño del título del nodo; predeterminado 15. |
| `underline` | Subraya el título. En generación ER identifica una clave primaria para un atributo (elipse). |
| `dashedUnderline` | Cambia a línea discontinua el subrayado del título. Requiere `underline: true`. |
| `textAbove` | Texto adicional centrado encima del nodo. |
| `textBelow` | Texto adicional centrado debajo del nodo. |
| `textLeft` | Texto adicional a la izquierda, alineado hacia el nodo. |
| `textRight` | Texto adicional a la derecha, alineado hacia el nodo. |
| `textOffset` | Separación entre el nodo y cualquiera de los cuatro textos adicionales; predeterminado 5. |
| `textAboveColor`, `textBelowColor`, `textLeftColor`, `textRightColor` | Color hexadecimal del texto de esa posición. Si falta, usa el color del nodo. |
| `textAboveFontSize`, `textBelowFontSize`, `textLeftFontSize`, `textRightFontSize` | Tamaño de texto de esa posición; predeterminado 12. |

Para representar una cardinalidad o una nota breve, configura `textLeft`/`textRight` o `textAbove`/`textBelow`. Usa colores legibles y no coloques una etiqueta grande sin aumentar el espacio alrededor del nodo.

Ejemplos:

```text
node prop set "Customer" fontSize 18
node prop set "Customer" underline true
node prop set "Customer" textBelow "Entidad principal"
node prop set "Customer" textBelowColor "#ffffff"
node prop set "Customer" textOffset 10
node prop set "Customer" dashedBorder 4
node prop set "Customer" doubleBorder true
```

Propiedades de proyecto o nodo pueden incluir claves personalizadas para metadata de dominio. No asumas que una clave desconocida cambia el dibujo o activa una función. Usa `node prop list <selector>` para leer lo guardado.
<!-- MCP_TOPIC:nodes:END -->

<!-- MCP_TOPIC:connections:START -->
## Conexiones: campos, rutas y propiedades

| Campo | Qué representa |
|---|---|
| `id` | Identificador único de la conexión, generado por Nodus. |
| `from` | ID del nodo de origen. |
| `to` | ID del nodo de destino. La conexión es dirigida para semántica y exportación, aunque el dibujo no siempre muestra una punta de flecha. |
| `tipo` / `style` | Número de estilo de ruta, de 1 a 7. El nombre MCP `nodus_command` permite ajustarlo con `connection style <id> <1..7>`. |
| `properties` | Diccionario de presentación y anclaje descrito abajo. |

Las rutas 1 y 3–7 salen/llegan desde el borde de los nodos. Nodus calcula automáticamente el lado más conveniente hacia el otro nodo, salvo que se indiquen `fromPoint` o `toPoint`. La ruta 2 une directamente los centros e ignora dichos puntos.

### Siete estilos de conexión

1. **Curva (`style: 1`):** curva cúbica de borde a borde; sus tangentes se calculan automáticamente según los lados de salida/entrada. Es el estilo inicial y suele ser adecuado para relaciones fluidas.
2. **Centros (`style: 2`):** línea recta del centro de un nodo al centro del otro. Cruza el interior de las formas y no usa anclajes.
3. **Ángulo recto, tramo vertical primero (`style: 3`):** desde el borde de origen, va verticalmente hasta la altura del destino y luego horizontal hasta este.
4. **Ángulo recto, tramo horizontal primero (`style: 4`):** desde el borde de origen, va horizontalmente hasta la coordenada X del destino y luego vertical.
5. **Escalera horizontal primero (`style: 5`):** baja/sube hasta la mitad vertical, cruza horizontalmente y luego termina vertical.
6. **Escalera vertical primero (`style: 6`):** cruza hasta la mitad horizontal, sube/baja y luego termina horizontal.
7. **Recta de borde a borde (`style: 7`):** segmento directo entre los anclajes calculados; no es la conexión entre centros. Al ciclar estilos desde el panel de capas, el siguiente estilo de 7 vuelve a 1.

### Propiedades avanzadas de conexión

| Clave | Valor y efecto |
|---|---|
| `label` | Texto centrado cerca del punto medio entre los centros de los nodos. |
| `labelColor` | Color hexadecimal de la etiqueta; predeterminado blanco (`#ffffff`). |
| `fontSize` | Tamaño de la etiqueta; predeterminado 14. |
| `labelPosition` | Desplazamiento vertical de la etiqueta respecto al centro de la conexión. Un número positivo la mueve hacia arriba; predeterminado 5. |
| `color` | Color hexadecimal fijo del trazo. Si falta, la línea usa el degradado animado entre los colores de los nodos. |
| `thickness` | Grosor base del trazo; predeterminado 4. Usa valores positivos moderados. |
| `dashed` | Si es verdadero, dibuja el trazo discontinuo con patrón 10/5. |
| `noFlow` | Si es verdadero junto a `dashed`, congela el desplazamiento del patrón. Si no, el patrón puede animarse con el flujo de conexiones. |
| `fromPoint` | Anclaje de salida fijo del nodo `from`. Valores: `TOP`, `BOTTOM`, `LEFT`, `RIGHT`, `TOP_LEFT`, `TOP_RIGHT`, `BOTTOM_LEFT`, `BOTTOM_RIGHT`. |
| `toPoint` | Anclaje de llegada fijo del nodo `to`, con los mismos valores que `fromPoint`. |

Para cambiar anclajes, usa exactamente mayúsculas, por ejemplo:

```text
connection prop set CONNECTION_ID fromPoint RIGHT
connection prop set CONNECTION_ID toPoint LEFT
connection prop set CONNECTION_ID label "envía pedido"
connection prop set CONNECTION_ID dashed true
connection prop set CONNECTION_ID noFlow true
connection prop set CONNECTION_ID thickness 3
connection prop set CONNECTION_ID color "#94a3b8"
connection style CONNECTION_ID 5
```

`connection prop set` interpreta `true`, `false`, `null`, números y JSON válido como tipos; `fromPoint`, `toPoint`, etiquetas y colores son texto. Una etiqueta legible debe contrastar con el fondo. El trazo seleccionado tiene una representación de selección especial; evalúa el estilo normal una vez que dejes de seleccionarlo.
<!-- MCP_TOPIC:connections:END -->

<!-- MCP_TOPIC:workflows:START -->
## Procedimientos para crear y verificar diagramas

### Antes de dibujar

1. Inspecciona la app y el diagrama actual.
2. Confirma cuál es la sala abierta y si contiene datos. Si la petición no dice claramente que se puede editarla, pregunta antes.
3. Si el usuario autoriza una sala nueva, crea una con nombre descriptivo y visibilidad solicitada. No elijas `public` a menos que lo pidan.
4. Lista nodos y conexiones y usa IDs estables para ediciones posteriores.
5. Si el usuario pide un formato concreto (mapa conceptual, ER, árbol), decide primero qué representa cada nodo y qué significado tiene cada enlace.

### Mapa conceptual o árbol

1. Crea un nodo por concepto. Usa `style: 1` normalmente; reserva elipse o diamante para semántica que realmente corresponda.
2. Coloca el concepto principal separado de sus grupos. `nodus_create_node` crea en el centro visible; tras cada creación, mueve el nodo con `nodus_update_node` usando coordenadas `x`, `y`.
3. Conecta padre → hijo usando `nodus_create_connection`. La ruta es dirigida aunque la visualización puede no mostrar una flecha.
4. Ajusta la conexión si el diseño lo pide: por ejemplo, `style: 1` para una curva, `5` para escalera horizontal primero, o `7` para recta entre bordes.
5. Usa `label` en una conexión para nombrar una relación; usa texto adicional del nodo para notas o cardinalidades.
6. Vuelve a consultar ambos listados. Confirma que cada concepto aparece una sola vez, los extremos de cada enlace son correctos y el grafo refleja la jerarquía pedida.

No uses repetidamente `nodus_create_node` sin mover los nodos: todos nacen cerca del centro visible y pueden superponerse. Escribe valores `x`,`y` coherentes y aumenta `width`,`height` para etiquetas largas.

### Usar propiedades avanzadas

Usa `nodus_command` con una sola instrucción. Ejemplos:

```text
node prop set "Concepto" textBelow "Ejemplo"
node prop set "Concepto" textBelowFontSize 12
node prop set "Concepto" doubleBorder true
connection prop set CONNECTION_ID label "depende de"
connection prop set CONNECTION_ID fromPoint BOTTOM
connection style CONNECTION_ID 6
```

Después de escribir, lee el nodo (`nodus_get_node` o `node get`) o la conexión (`connection get`) y valida que `properties` contiene lo esperado. Las propiedades visuales aparecen en el lienzo; consulta también el estado/listado de nuevo.

### Generación de modelo relacional desde ER

El comando `generate MR2ER` genera un modelo relacional desde un diagrama ER según convenciones de Nodus. En el diagrama de origen:

- rectángulo (`style: 1`) representa una entidad;
- elipse (`style: 2`) representa un atributo;
- rombo (`style: 3`) representa una relación;
- `underline: true` marca clave primaria en un atributo;
- `dashedBorder` en atributo marca atributo derivado;
- `doubleBorder` representa entidad débil, relación débil o atributo multivaluado según el estilo;
- `disjointMembership`/`overlappingMembership` en una entidad marca el tipo de generalización;
- `isSon: true` identifica la entidad hija y la conexión debe vincularla con su padre.

El generador depende de la topología y los extremos de las conexiones, no solo de la apariencia. Revisa el diagrama ER y guarda/usa el resultado únicamente después de verificarlo. `generate MR2ER` está disponible para usuarios con permiso de edición; no lo ejecutes sobre un diagrama que no se pidió transformar.

### Reglas de seguridad y calidad

- Nunca llames a `eval`; no se publica como herramienta de IA y ejecuta un intérprete no auditado.
- Nunca uses `--yes` desde integraciones externas.
- Login y registro no reciben credenciales mediante MCP.
- Antes de borrar nodos, recuerda que se eliminan también sus conexiones incidentales.
- No borres una sala, vacíes un canvas, restaures un autosave, transfieras propiedad ni cambies miembros sin autorización explícita y confirmación de Nodus.
- Tras cualquier error de respuesta, verifica el estado antes de repetir una escritura. La operación podría haberse completado aun si falló la conversión de su respuesta.
- No asumas que exportar ha guardado un archivo sin completar la interacción del diálogo del sistema.
<!-- MCP_TOPIC:workflows:END -->
