# Manual completo de la consola Nodus

Esta guía describe la gramática y los efectos implementados por la consola de Nodus Flow. Los comandos son acciones semánticas de la aplicación: no son comandos del sistema operativo y no ejecutan programas externos.

## Alcance y disponibilidad

La consola está montada en la aplicación y se puede abrir durante el inicio de sesión, el registro, la validación de licencia, el lobby y el editor. Que la consola esté visible no significa que todos los comandos estén disponibles en todas las pantallas:

- `app inspect`, `auth`, `license`, `toast`, `console`, `help` y `clear` son controles globales, sujetos a los requisitos específicos de cada acción.
- Los comandos `project` requieren una sesión con licencia válida y estar en el lobby o en el editor.
- `editor`, `node`, `connection`, `canvas`, `generate` y `eval` requieren un proyecto abierto y la pantalla del editor.
- Las operaciones que cambian el diagrama exigen rol `owner` o `editor`. Un `viewer` puede consultar y seleccionar datos, inspeccionar el estado, mover la cámara, compartir y exportar, pero no editar.
- Las acciones administrativas de salas se envían a los servicios de Nodus. Los permisos del servidor siguen siendo definitivos; que un comando exista en la consola no concede permisos.
- Esta consola no es una API para agentes externos y no permite ejecutar scripts arbitrarios.

## Abrir, escribir y editar comandos

### Acceso y atajo

El atajo inicial es `Ctrl + Backquote` (la tecla ~) y alterna abrir/cerrar la consola. Se puede cambiar con el botón **Shortcut** de la consola o mediante `console shortcut`. Para asignarlo, pulsa una combinación que incluya `Ctrl`, `Meta` o `Alt` y luego una tecla. `Escape` cancela la asignación.

El atajo guardado se conserva localmente. También se conserva localmente la altura del panel.

### Envío e historial de entrada

- Pulsa `Enter` para ejecutar la línea.
- Usa `ArrowUp` y `ArrowDown` para recorrer el historial de comandos de entrada.
- `Escape` cierra la consola. Si hay una solicitud de contraseña activa, cancela esa solicitud en lugar de cerrar la consola.
- El historial en memoria está limitado a las últimas 100 entradas y no persiste al reiniciar la aplicación.
- `console history` muestra las líneas de comandos guardadas en memoria; no muestra las salidas.
- `clear` borra la transcripción visible, pero no borra el historial de entrada.
- El botón `×` y `console close` cierran el panel; no cierran sesión ni cancelan por sí mismos una acción ya iniciada.

### Nombres, espacios y comillas

Los comandos no distinguen mayúsculas de minúsculas en los nombres de dominio/acción que se comparan como literales, aunque se recomienda escribirlos en minúsculas. Los valores como IDs, nombres, propiedades o expresiones conservan su contenido.

Los espacios separan argumentos. Para tratar una secuencia con espacios como un único argumento, usa comillas simples o dobles:

```text
node get "Customer Account"
project create "Modelo de ventas"
project member add "ana maria"
```

Dentro de una cadena entrecomillada se puede escapar la comilla delimitadora o una barra inversa precediéndola con `\`, por ejemplo `"nombre \"nuevo\""`. Las comillas sin pareja producen un error. No hay expansión de variables ni sustitución de comandos.

Los nombres de proyecto y algunos selectores aceptan además varios argumentos sin comillas; la consola los vuelve a unir con espacios en esos comandos concretos. Aun así, se recomienda citar nombres con espacios para que el comando sea inequívoco.

### Opciones

Las opciones empiezan por `--` y se pueden colocar antes o después de los argumentos, siempre que el comando admita la opción:

```text
project create "Diagrama" --visibility private
project create --visibility=private "Diagrama"
node update "Customer" --x 160 --locked false
node update "Customer" --x=160 --locked=false
```

- `--json`: pide que la respuesta correcta de la consola se serialice como JSON. No cambia la acción ni convierte una exportación de archivo en JSON. En operaciones con datos, la salida contiene esos datos; en operaciones sin datos, contiene un objeto con `message`. Los errores de validación/ejecución se muestran como texto de error normal y no se envuelven como JSON.
- `--yes`: omite el cuadro de confirmación solamente en acciones que lo solicitan. No concede permisos adicionales. Úsalo solo cuando se quiera ejecutar conscientemente una acción destructiva.
- `--visibility <private|shared|public>`: solo está disponible en `project create`.
- `--project <id>`: selecciona una sala para ciertas operaciones administrativas; si se omite, se usa la sala actualmente activa.
- Las opciones de `node update` se describen en su sección.

Una opción con valor puede escribirse como `--opcion valor` o `--opcion=valor`. Las opciones booleanas `--json` y `--yes` no aceptan valor. Las opciones repetidas, vacías o desconocidas producen error. Los valores numéricos deben ser finitos.

`--yes` es reconocido por el parser global, pero no tiene efecto en comandos que no llaman a una confirmación. `--json` está disponible para envolver la respuesta de la mayoría de los comandos.

## Comandos generales

### `help`, `?`

```text
help
?
```

Muestra el listado de sintaxis integrado en la consola. No recibe argumentos. Este manual amplía ese listado con las descripciones y restricciones de cada acción.

### `clear`

```text
clear
```

Borra la transcripción que se muestra en el panel. No borra el historial de comandos, no modifica diagramas ni elimina notificaciones.

## Aplicación: `app`

### `app inspect` y `app status`

```text
app inspect
app inspect --json
app status
```

`status` es alias de `inspect`. No recibe argumentos. Informa la pantalla actual, el estado de autenticación y, cuando existe, el usuario autenticado. También agrega datos propios de la vista actual:

- **Licencia:** agrega el estado de licencia cuando la pantalla es de licencia.
- **Editor:** agrega ID, nombre, rol, visibilidad y cantidades de nodos/conexiones del proyecto activo.
- **Lobby:** consulta y agrega las salas propias/unidas y las salas públicas.
- **Controles visibles:** enumera los controles que la consola considera disponibles en la pantalla actual.
- **Comandos disponibles:** presenta las familias de comandos asociadas a pantalla y rol.
- **Consola:** incluye el estado disponible de la consola cuando está conectado el controlador.

`--json` produce la respuesta en formato JSON. Esta inspección enumera controles conocidos; no es una captura completa de todos los píxeles ni de todos los elementos de la interfaz.

### `app home`

```text
app home
```

Desde el editor vuelve al lobby. Desde el lobby no hace cambios y avisa que ya se encuentra allí. En otras pantallas falla: la vuelta al lobby solo se ofrece desde lobby/editor.

### `app ping`

```text
app ping
```

Solo funciona en el editor. Envía un ping colaborativo en el centro del área visible, usando el nombre y color del usuario conectado (o el color predeterminado si no se encuentra color). No recibe coordenadas ni argumentos.

### `app fullscreen`

```text
app fullscreen
app fullscreen toggle
app fullscreen status
app fullscreen on
app fullscreen off
```

- Sin modo o con `toggle`: invierte el estado de pantalla completa.
- `status`: consulta el estado y devuelve `fullscreen: true|false`.
- `on`: activa pantalla completa.
- `off`: la desactiva.

No acepta más de un argumento. El control depende de que la integración de ventana esté disponible.

## Autenticación: `auth`

Las contraseñas no se escriben como argumentos de comandos. La consola solicita el secreto en un campo de tipo contraseña, enmascarado visualmente. El texto introducido en ese prompt no se agrega a la línea de comandos ni al historial. Se guarda temporalmente en memoria durante el flujo de registro para comparar la confirmación y enviar el formulario.

### `auth status`

```text
auth status
auth status --json
```

Muestra si hay sesión iniciada, si la autenticación está cargando, el ID/correo/apodo del usuario (si existe) y el error actual de autenticación (si existe).

### `auth view login|signup`

```text
auth view login
auth view signup
```

Cambia la pantalla de autenticación mostrada. No acepta argumentos adicionales. No se puede cambiar de pantalla de autenticación mientras ya se está conectado; primero hay que cerrar sesión.

### `auth login <email>`

```text
auth login persona@example.com
```

Inicia el proceso de inicio de sesión con el correo indicado y abre el prompt enmascarado para la contraseña. El comando requiere que no haya una sesión ya autenticada. El resultado depende del servicio de autenticación y puede devolver su mensaje de error.

Durante el prompt:

- Escribe la contraseña y pulsa `Enter` para enviarla.
- `Escape` o `:cancel` cancela el prompt.
- La contraseña no se imprime en la transcripción ni se conserva en el historial.

### `auth signup <email> <nickname>`

```text
auth signup persona@example.com ana_01
```

Inicia el registro; no se puede registrar otra cuenta si ya hay una sesión autenticada. El apodo debe tener entre 3 y 24 caracteres y contener únicamente letras ASCII, números o `_`. Después solicita:

1. Contraseña enmascarada de al menos 6 caracteres.
2. Repetición enmascarada de la misma contraseña.

Si no coinciden, vuelve a solicitar la contraseña. `Escape` o `:cancel` cancela cualquier etapa del prompt. Al completarse, la aplicación indica que se debe confirmar el correo.

### `auth logout [--yes]`

```text
auth logout
auth logout --yes
```

Cierra la sesión activa. Si no se especifica `--yes`, muestra un cuadro de confirmación. `--yes` omite ese cuadro; no hace falta ni tiene efecto si el usuario no está autenticado, ya que el comando falla en ese caso.

## Licencia: `license`

### `license status`

```text
license status
license status --json
```

Devuelve el objeto de estado proporcionado por el controlador de licencia. Falla si el controlador no está disponible.

### `license retry`

```text
license retry
```

Vuelve a intentar validar la licencia y devuelve el resultado del intento junto con el estado actualizado. Una validación negativa se presenta como resultado ejecutado (“sigue siendo inválida”), no como excepción del comando.

### `license contact`

```text
license contact
```

Abre el contacto de soporte asociado a la licencia (la acción de correo del sistema). No recibe argumentos.

## Notificaciones: `toast`

### `toast list`

```text
toast list
toast list --json
```

Lista las notificaciones activas con su ID numérico, tipo, texto y etiqueta de acción (o `null` si no tienen acción).

### `toast dismiss <id>`

```text
toast dismiss 12
```

Cierra la notificación activa identificada por su ID. El ID debe ser numérico y corresponder a una notificación existente.

### `toast click <id>`

```text
toast click 12
```

Ejecuta la acción asociada a la notificación. Falla si la notificación no existe o no tiene acción. Esta operación puede navegar o provocar el mismo efecto que pulsar la acción visible de esa notificación.

## Consola: `console`

### `console status`

```text
console status
console status --json
```

Devuelve si la consola está abierta, su altura actual, el atajo visible y si se está grabando un nuevo atajo. Si el controlador no está disponible, informa `available: false`.

### `console open`, `console close` y `console toggle`

```text
console open
console close
console toggle
```

Abren, cierran o invierten la visibilidad del panel. No afectan la sesión de usuario ni el proyecto.

### `console resize <height>`

```text
console resize 300
```

Define la altura del panel en píxeles. Debe estar entre 180 y el 80 % de la altura actual de la ventana (el máximo nunca es inferior a 180). El valor se guarda localmente. Los números decimales finitos son aceptados.

### `console shortcut`

```text
console shortcut
```

Empieza a grabar el atajo. Luego pulsa una tecla junto con `Ctrl`, `Meta` o `Alt`; también se puede añadir `Shift`. `Escape` cancela. La combinación se guarda localmente. No recibe parámetros.

### `console history`

```text
console history
console history --json
```

Muestra el historial de líneas enviadas (hasta 100). No incluye las salidas ni las contraseñas introducidas en prompts. El historial reside en memoria y se elimina al reiniciar la aplicación.

## Proyectos y salas: `project`

Todos los comandos de esta sección requieren sesión con licencia válida y estar en lobby o editor. Los comandos que no indiquen otro alcance se ejecutan contra la sala activa cuando corresponde.

### `project list`

```text
project list
project list --json
```

Lista las salas propias o a las que pertenece el usuario, con nombre, ID, visibilidad y la marca `archived` si corresponde.

### `project public`

```text
project public
project public --json
```

Lista salas públicas con nombre, ID y apodo de propietario (o `Unknown owner` si no hay apodo disponible).

### `project resume`

```text
project resume
```

Abre la última sala guardada como usada recientemente. Si no existe una sala recordada, falla. Internamente ejecuta el mismo flujo de `project open <id>`.

### `project info`

```text
project info
project info --json
```

Requiere un proyecto abierto. Devuelve su ID, nombre, rol actual, propietario, visibilidad, propiedades del proyecto y colaboradores actualmente conectados con sus roles.

### `project create <name> [--visibility <value>]`

```text
project create "Modelo de inventario"
project create "Modelo privado" --visibility private
project create "Modelo público" --visibility=public
```

Crea una sala y navega al editor. `name` es obligatorio; puede escribirse entre comillas o como varios argumentos. `--visibility` acepta `private`, `shared` o `public`; por defecto es `shared`. El servidor crea la sala y determina sus datos finales.

### `project open <id>`

```text
project open room-123
```

Se une a la sala indicada por ID, prepara la navegación y abre el editor con el rol devuelto por el servicio. El acceso depende de la sala, la cuenta y los permisos del servidor.

### `project rename <new-name> [--project <id>]`

```text
project rename "Nuevo nombre"
project rename "Nombre de otra sala" --project room-123
```

Renombra la sala indicada por `--project`; si se omite, usa la sala actual. Para la sala actualmente abierta, el comando comprueba localmente que el rol sea `owner`. La autorización del servicio/servidor sigue siendo obligatoria para cualquier sala. El nombre es obligatorio y puede componerse de varios argumentos.

### `project visibility set <private|shared|public> [--project <id>]`

```text
project visibility set private
project visibility set public --project room-123
```

Cambia la visibilidad de la sala activa o de la sala especificada. El valor debe ser exactamente `private`, `shared` o `public`. Para la sala actual se requiere localmente rol `owner`; el servidor valida la operación.

### `project lock <id>` y `project archive <id>`

```text
project lock room-123
project archive room-123
project lock room-123 --yes
```

Ambos nombres archivan la sala y bloquean el acceso. Muestran confirmación salvo que se use `--yes`. Para archivar la sala actualmente abierta se prepara la navegación y se vuelve al lobby. Para una sala distinta, no se navega fuera de la sala actual. El servicio valida permisos y estado.

### `project unlock <id>` y `project restore <id>`

```text
project unlock room-123
project restore room-123
```

Ambos nombres restauran/desarchivan la sala. No muestran confirmación. La restauración requiere el permiso del propietario en el servicio.

### `project delete <id> [--yes]`

```text
project delete room-123
project delete room-123 --yes
```

Elimina permanentemente la sala y sus datos de diagrama. Solicita confirmación salvo con `--yes`. Si se elimina la sala actualmente abierta, limpia los datos locales de sala y vuelve al lobby. La operación requiere autorización del servidor; para la sala activa también se comprueba localmente el rol `owner`.

### `project member list [--project <id>]`

```text
project member list
project member list --project room-123
```

Lista miembros con apodo/ID y rol, además de usuarios bloqueados marcados como `blocked`. Para la sala activa, la consola exige rol `owner`; el servicio también puede limitar el acceso. Si se consulta otra sala, el acceso depende del servicio.

### `project member add <nickname> [--project <id>]`

```text
project member add "ana"
project member add "ana maria" --project room-123
```

Agrega a un miembro identificado por apodo, asignándolo como editor. La consola comprueba localmente rol `owner` si la sala objetivo es la sala activa. El servicio valida el usuario y el permiso.

### `project member ban <member>` y `project member block <member>`

```text
project member ban "ana"
project member block user-123 --project room-123
project member ban "ana" --yes
```

`ban` y `block` son alias. El selector puede ser apodo o ID de usuario y debe coincidir con un miembro activo. La consola consulta la membresía, muestra confirmación y después retira/bloquea al usuario. `--yes` omite la confirmación. Se requiere autorización de propietario.

### `project member unban <member>` y `project member unblock <member>`

```text
project member unban "ana"
project member unblock user-123 --project room-123
```

`unban` y `unblock` son alias. Busca el usuario en la lista de bloqueados por apodo o ID y lo vuelve a agregar usando su apodo. Si el usuario bloqueado no tiene apodo, la consola no puede readmitirlo por esta vía. No muestra confirmación; requiere autorización de propietario.

### `project member role <member> <editor|viewer> [--project <id>]`

```text
project member role "ana" viewer
project member role user-123 editor --project room-123
```

Cambia el rol del miembro activo identificado por apodo o ID. Los únicos valores aceptados son `editor` y `viewer`; el propietario no se asigna mediante este comando. Requiere autorización de propietario.

### `project member owner transfer <member> [--project <id>]`

```text
project member owner transfer "ana"
project member owner transfer user-123 --project room-123 --yes
```

Transfiere la propiedad a un miembro activo localizado por apodo o ID. Solicita confirmación salvo con `--yes`. Si se transfiere la sala activa, actualiza localmente los datos de propietario y el rol del usuario actual a `editor`. El servidor determina si la transferencia es válida.

### `project request access <project-id>`

```text
project request access room-123
```

Envía una solicitud de acceso a la sala. No necesita que la sala sea la activa y no solicita confirmación. El resultado depende del servicio (por ejemplo, si la sala admite solicitudes).

### `project request list [--project <id>]`

```text
project request list
project request list --project room-123
```

Lista solicitudes de acceso pendientes con apodo/ID. Para la sala activa se requiere rol `owner`; el servidor aplica sus propias comprobaciones para la sala objetivo.

### `project request approve <user-id> [--project <id>]`

```text
project request approve user-123
project request approve user-123 --project room-123
```

Aprueba la solicitud del ID de usuario en la sala activa o indicada. Requiere permisos administrativos del propietario. No muestra confirmación.

### `project request reject <user-id> [--project <id>]`

```text
project request reject user-123
project request reject user-123 --project room-123
```

Rechaza la solicitud del ID de usuario en la sala activa o indicada. Requiere permisos administrativos del propietario. No muestra confirmación.

### `project activity list [--project <id>]`

```text
project activity list
project activity list --project room-123
project activity list --json
```

Consulta la actividad reciente de la sala activa o indicada. Cada entrada incluye fecha, apodo del actor, acción y detalles serializados. La disponibilidad de entradas depende del servicio.

### `project prop list`

```text
project prop list
project prop list --json
```

Requiere un proyecto abierto. Lee todas las propiedades del proyecto activo. Las propiedades son pares clave/valor; si no hay ninguna, la consola informa que el proyecto no tiene propiedades.

### `project prop set <key> <value>`

```text
project prop set status active
project prop set settings "{\"compact\":true}"
project prop set retries 3
```

Define una propiedad de la sala activa y requiere rol `owner` o `editor`. Los valores `true`, `false` y `null` se convierten en booleano/nulo; números finitos se convierten en número; cadenas que empiezan por `{` o `[` deben ser JSON válido y se convierten en objeto/arreglo. El resto permanece como texto. Para valores JSON con espacios, cita el argumento y escapa las comillas internas.

### `project prop del <key>` y `project prop delete <key>`

```text
project prop del status
project prop delete settings
```

`del` y `delete` eliminan una propiedad existente del proyecto activo. Requieren rol `owner` o `editor`. Un nombre de propiedad inexistente produce error.

## Editor: `editor`

Todos los comandos `editor` requieren proyecto abierto y pantalla del editor. Las operaciones que modifican el diagrama requieren rol `owner` o `editor`; las consultas, selección, cámara, compartir y exportación están disponibles también para lectores salvo que el servicio o el sistema operativo lo impidan.

### `editor status`

```text
editor status
editor status --json
```

Devuelve pantalla, rol, ID/nombre de proyecto, cantidades de nodos y conexiones, propiedades del proyecto, colaboradores activos, selección de nodos y conexión seleccionada, herramienta activa, vista de capas, estado de paneles, zoom/desplazamiento/posición mundial del cursor e indicadores de deshacer/rehacer.

### `editor home`

```text
editor home
```

Vuelve al lobby desde el editor. Equivale a `app home`.

### `editor ping`

```text
editor ping
```

Envía un ping en el centro de la vista, como `app ping`.

### `editor fullscreen`

```text
editor fullscreen
```

Alterna pantalla completa. Para consultar el estado o especificar `on`/`off`, usa `app fullscreen`.

### `editor undo` y `editor redo`

```text
editor undo
editor redo
```

Deshace o rehace la operación correspondiente a la pila local de historial. Requieren permisos de edición. Si no hay operaciones disponibles, el comportamiento depende de la pila de historial.

### `editor run`

```text
editor run
```

Ejecuta la simulación de flujo de datos. Requiere permisos de edición y que la propiedad `enableDataFlowMode` esté habilitada en la configuración del proyecto; si no lo está, el comando falla con una indicación para activarla.

### `editor panel list`

```text
editor panel list
editor panel list --json
```

Devuelve el estado abierto/cerrado de `properties`, `layers`, `palette`, `configuration` y `autosaves`.

### `editor panel open|close|toggle <panel>`

```text
editor panel open layers
editor panel close properties
editor panel toggle configuration
```

`<panel>` debe ser uno de:

- `properties`: panel de propiedades.
- `layers`: panel de capas.
- `palette`: paleta de comandos.
- `configuration`: configuración del proyecto.
- `autosaves`: panel de autoguardados.

`open` fuerza apertura, `close` fuerza cierre y `toggle` invierte el estado. Para `properties`, `layers`, `palette` y `autosaves` se requiere rol `owner` o `editor`; `configuration` no exige ese rol en este handler.

### `editor autosaves list`

```text
editor autosaves list
editor autosaves list --json
```

Lista los autoguardados locales del proyecto con timestamp numérico, fecha ISO, nombre del proyecto y cantidades de nodos/conexiones. Se ordenan del más reciente al más antiguo. La consulta requiere estar en el editor con un proyecto.

### `editor autosaves restore <timestamp> [--yes]`

```text
editor autosaves restore 1793651234567
editor autosaves restore 1793651234567 --yes
```

Busca una instantánea cuyo timestamp coincida exactamente con el valor numérico. Requiere permisos de edición y muestra confirmación porque reemplaza el diagrama actual. `--yes` omite la confirmación. Restaura nodos, conexiones, nombre, propiedades guardadas y estado de cámara disponible. Si no se encuentra o no puede restaurarse, devuelve error.

### `editor tool list`

```text
editor tool list
```

Muestra la herramienta activa. No requiere rol de edición.

### `editor tool set <select|move|connect|create>`

```text
editor tool set select
editor tool set connect
```

Cambia la herramienta activa. Los valores son `select`, `move`, `connect` y `create`. Requiere permisos de edición.

### `editor layer-view <nodes|connections>`

```text
editor layer-view nodes
editor layer-view connections
```

Cambia qué tipo de elemento muestra el panel de capas. Requiere permisos de edición.

### `editor selection list`

```text
editor selection list
editor selection list --json
```

Lista nodos seleccionados con ID y título. Una conexión seleccionada se consulta en `editor status` (campo `selectedConnection`).

### `editor selection clear`

```text
editor selection clear
```

Quita la selección de nodos y de conexión. No modifica los elementos del diagrama.

### `editor selection all`

```text
editor selection all
```

Selecciona todos los nodos.

### `editor selection invert`

```text
editor selection invert
```

Invierte la selección de nodos con respecto a los nodos del diagrama.

### `editor selection unconnected`

```text
editor selection unconnected
```

Selecciona nodos que no tienen conexiones.

### `editor selection select <node>...`

```text
editor selection select "Customer"
editor selection select "Customer" "Invoice"
```

Selecciona uno o varios nodos por ID o título exacto. Los valores repetidos se deduplican por ID. La operación reemplaza la selección actual y deselecciona cualquier conexión. No exige rol de edición.

### Acciones sobre la selección

```text
editor selection fit-height
editor selection copy
editor selection front
editor selection back
editor selection lock
editor selection unlock
editor selection delete
editor selection duplicate
```

Todas estas operaciones requieren rol `owner` o `editor`:

- `fit-height`: aplica el ajuste de altura masivo de la aplicación a los nodos seleccionados.
- `copy`: copia la selección usando la acción de copia masiva de la aplicación.
- `front`: lleva los nodos seleccionados al frente.
- `back`: envía los nodos seleccionados al fondo.
- `lock`: bloquea los nodos seleccionados.
- `unlock`: desbloquea los nodos seleccionados.
- `delete`: elimina los nodos seleccionados y confirma antes; `--yes` permite omitir el cuadro.
- `duplicate`: duplica los nodos seleccionados.

Si no hay nodos seleccionados, el comando se ejecuta con la selección vacía; no elige nodos por defecto.

### `editor clipboard copy|cut|paste|duplicate`

```text
editor clipboard copy
editor clipboard cut
editor clipboard paste
editor clipboard duplicate
```

Todas las variantes requieren rol `owner` o `editor`:

- `copy`: copia los nodos seleccionados al portapapeles interno de la aplicación.
- `cut`: copia y elimina los nodos seleccionados; muestra confirmación, que se omite con `--yes`.
- `paste`: pega los nodos copiados previamente.
- `duplicate`: duplica la selección sin depender de un ciclo copiar/pegar explícito.

El comando no recibe contenido de portapapeles como argumento; `paste` usa el estado interno gestionado por la aplicación.

### `editor camera center`

```text
editor camera center
```

Centra la cámara en el diagrama. No modifica coordenadas de nodos.

### `editor camera zoom <0.1..5>`

```text
editor camera zoom 1
editor camera zoom 0.5
```

Establece el zoom directamente. Acepta números finitos entre `0.1` y `5`, incluidos los límites.

### `editor camera pan <x> <y>`

```text
editor camera pan 120 -40
```

Establece los dos offsets de la cámara usando valores numéricos finitos. Son coordenadas de desplazamiento de vista, no coordenadas de un nodo.

### `editor share`

```text
editor share
```

Abre el diálogo nativo de compartir si `navigator.share` está disponible. Si no, copia al portapapeles el texto de invitación y el enlace de la sala. No acepta argumentos.

### `editor export png [scale]`

```text
editor export png
editor export png 2
```

Exporta el diagrama como PNG. `scale` es opcional; si se indica debe ser entero entre 1 y 10. El comando inicia la descarga/exportación con el renderer existente.

### `editor export svg`

```text
editor export svg
```

Exporta el diagrama como SVG. No admite escala.

### `editor export json`

```text
editor export json
```

Exporta el estado del diagrama usando la descarga JSON existente. No admite escala.

### `editor import json`

```text
editor import json
```

Abre el selector de archivos de JSON de la aplicación. La importación modifica el diagrama y requiere permisos de edición. La selección y validación del archivo se realiza en el flujo de importación existente, no como una ruta escrita en el comando.

## Alias de diagrama: `diagram`

`diagram` se enruta al mismo handler que `editor`. Los alias documentados expresamente son:

```text
diagram export png [scale]
diagram export svg
diagram export json
diagram import json
```

Admiten los mismos argumentos, restricciones, permisos y efectos descritos en la sección de exportación/importación del editor. El alias de importación requiere rol `owner` o `editor`; las exportaciones siguen las reglas de exportación del editor. El prefijo `diagram` se transforma internamente en `editor`, por lo que también llega al handler general del editor, aunque `help` solo recomienda usar `diagram` para exportar e importar.

## Nodos: `node`

Estos comandos requieren estar en la pantalla del editor y tener un proyecto abierto. Las consultas y la selección se permiten a lectores; las modificaciones requieren rol `owner` o `editor`.

### `node list`

```text
node list
node list --json
```

Lista nodos mostrando título (o `(untitled)`), ID y posición `x,y`.

### `node get <selector>` y `node show <selector>`

```text
node get "Customer"
node show node-id-123
```

`show` es alias de `get`. Devuelve todos los datos del nodo seleccionado por ID exacto o por título exacto. Si hay varios nodos con el mismo título, se debe usar el ID.

### `node create <title>`

```text
node create "Customer"
```

Crea un nodo en el centro del área visible y lo titula con el texto indicado. El tamaño/posición inicial los determina la acción estándar de creación. Requiere rol de edición. El título puede escribirse entre comillas o como varios argumentos.

### `node select <selector>`

```text
node select "Customer"
```

Agrega el nodo a la selección actual; no elimina otros nodos seleccionados. Al seleccionar un nodo, se deselecciona una conexión activa. Se permite a lectores.

### `node deselect <selector>`

```text
node deselect "Customer"
```

Quita ese nodo de la selección actual. No altera otros elementos ni requiere rol de edición.

### `node lock all` y `node unlock all`

```text
node lock all
node unlock all
```

Bloquea o desbloquea todos los nodos del diagrama. La palabra `all` es obligatoria; se requiere rol de edición. No tiene confirmación.

### `node update <selector> [fields...]`

```text
node update "Customer" --name "Client"
node update "Client" --x 160 --y 240 --width 220 --height 100
node update "Client" --color "#336699" --opacity 0.8 --radius 12 --style 2 --locked true
node update "Client" --locked false
```

Requiere rol de edición. `<selector>` es un ID exacto o título exacto; títulos duplicados requieren ID. Se debe especificar al menos un campo y no se admiten argumentos posicionales después del selector.

Campos:

- `--name <text>`: cambia el título. El texto puede incluir espacios usando comillas.
- `--x <number>` y `--y <number>`: establecen la coordenada horizontal/vertical del nodo. Se puede usar uno sin el otro; el otro conserva su valor actual.
- `--width <number>`: establece el ancho. Debe ser al menos `60`.
- `--height <number>`: establece el alto. Debe ser al menos `40`.
- `--color <hex>`: admite formato hexadecimal de 3, 6 u 8 dígitos, con `#`, por ejemplo `#abc`, `#336699` o `#336699ff`.
- `--opacity <number>`: opacidad entre `0` y `1`, incluidos.
- `--radius <number>`: radio no negativo.
- `--style <number>`: forma del nodo; `1` = cuadrado, `2` = elipse, `3` = diamante. Debe ser uno de esos números.
- `--locked <true|false>`: establece el estado de bloqueo explícitamente. Solo acepta los textos `true` y `false`.

Los números deben ser finitos. `--name`, `--color`, `--x`, `--y`, `--width`, `--height`, `--opacity`, `--radius`, `--style` y `--locked` pueden combinarse en una misma llamada. Cada cambio usa las acciones de edición existentes.

### `node delete <selector> [--yes]`

```text
node delete "Customer"
node delete node-id-123 --yes
```

Elimina el nodo y sus conexiones adjuntas. Muestra confirmación con el número de conexiones que se eliminarán; `--yes` la omite. Requiere rol de edición.

### Eliminaciones masivas de nodos

```text
node delete all
node delete selected
node delete disconnected
node delete disconnected --yes
```

Las tres variantes requieren rol de edición, muestran confirmación y admiten `--yes`:

- `all`: elimina todos los nodos.
- `selected`: elimina los nodos actualmente seleccionados.
- `disconnected`: elimina nodos que no tienen conexiones.

La salida informa el número calculado antes de ejecutar la eliminación.

### `node prop list <node>`

```text
node prop list "Customer"
node prop list node-id-123 --json
```

Lee las propiedades de un nodo. Si no tiene propiedades, lo indica. La consulta no requiere rol de edición.

### `node prop set <node> <key> <value>`

```text
node prop set "Customer" status active
node prop set "Customer" retries 3
node prop set "Customer" options "{\"enabled\":true}"
```

Define una propiedad del nodo y requiere rol de edición. El valor se convierte con las mismas reglas que las propiedades de proyecto: `true`, `false`, `null`, número finito, objeto/arreglo JSON válido cuando empieza con `{`/`[`, o texto en los demás casos. `node` puede ser ID o título exactos.

### `node prop del <node> <key>` y `node prop delete <node> <key>`

```text
node prop del "Customer" status
node prop delete node-id-123 status
```

Elimina una propiedad existente. `delete` es alias de `del`. Requiere rol de edición; si la propiedad no existe, la consola informa error.

## Conexiones: `connection`

Estos comandos requieren editor y proyecto abierto. Las consultas y selección son de lectura; creación/cambio/eliminación requieren rol `owner` o `editor`.

### `connection list`

```text
connection list
connection list --json
```

Lista conexiones mostrando título/ID del nodo de origen, título/ID del destino e ID de conexión.

### `connection get <id>` y `connection show <id>`

```text
connection get connection-id-1
connection show connection-id-1 --json
```

`show` es alias de `get`. Devuelve todos los datos de la conexión identificada por ID exacto.

### `connection select <id>`

```text
connection select connection-id-1
```

Selecciona la conexión y quita la selección de nodos. No modifica el diagrama ni exige rol de edición.

### `connection create <from-node> <to-node>`

```text
connection create "Customer" "Invoice"
connection create node-id-a node-id-b
```

Crea una conexión dirigida entre los nodos indicados por ID o título exacto. Requiere rol de edición. Si no puede crearse (por ejemplo, por una conexión duplicada), informa error.

### `connection complete`

```text
connection complete
```

Conecta los nodos seleccionados como un grafo completo mediante la acción existente. Requiere rol de edición y al menos dos nodos seleccionados.

### `connection style <id> <1..7>`

```text
connection style connection-id-1 3
```

Cambia el estilo de la conexión. El estilo debe ser un entero de `1` a `7`, incluidos. Requiere rol de edición.

### `connection delete <id> [--yes]`

```text
connection delete connection-id-1
connection delete connection-id-1 --yes
```

Elimina una conexión por ID. Solicita confirmación salvo con `--yes`. Requiere rol de edición.

### `connection delete all [--yes]`

```text
connection delete all
connection delete all --yes
```

Elimina todas las conexiones y solicita confirmación salvo con `--yes`. Requiere rol de edición.

### `connection prop list <id>`

```text
connection prop list connection-id-1
connection prop list connection-id-1 --json
```

Lista las propiedades de la conexión; si no tiene propiedades, lo indica.

### `connection prop set <id> <key> <value>`

```text
connection prop set connection-id-1 label contains
connection prop set connection-id-1 weight 2.5
```

Define una propiedad de conexión. Requiere rol de edición y aplica las reglas de conversión de valores descritas en `project prop set`.

### `connection prop del <id> <key>` y `connection prop delete <id> <key>`

```text
connection prop del connection-id-1 label
connection prop delete connection-id-1 label
```

Elimina una propiedad existente. `delete` es alias de `del`. Requiere rol de edición.

## Lienzo: `canvas`

Todos los comandos requieren editor y proyecto abierto.

### `canvas clear [--yes]`

```text
canvas clear
canvas clear --yes
```

Elimina todos los nodos y conexiones del lienzo. Requiere rol de edición y confirmación; `--yes` la omite.

### `canvas reset` y `canvas center`

```text
canvas reset
canvas center
```

Ambos centran la cámara sobre el diagrama; no borran ni reorganizan elementos. No requieren rol de edición.

### `canvas zoom <0.1..5>`

```text
canvas zoom 1.25
```

Establece el zoom a un número finito entre `0.1` y `5`, incluidos. No requiere rol de edición.

## Generación: `generate`

### `generate MR2ER`

```text
generate MR2ER
```

Inicia el generador MR-to-ER de la aplicación. `MR2ER` es el único generador admitido y debe escribirse con esa forma. Requiere editor, proyecto abierto y rol `owner` o `editor`.

## Evaluación Heza: `eval`

### `eval <Heza expression>`

```text
eval <expresión-Heza>
```

Envía el texto restante al evaluador Heza interno y devuelve su resultado. La expresión es obligatoria. Requiere editor, proyecto abierto y rol de edición. No evalúa JavaScript ni código arbitrario del sistema. Si el evaluador devuelve `Error` o ningún resultado, el comando falla.

## Confirmaciones y operaciones sensibles

La confirmación normal usa el diálogo de confirmación de la aplicación. Cancelar termina la operación sin ejecutarla. `--yes` omite el diálogo solo donde se describe abajo:

| Acción | Confirmación |
|---|---|
| `auth logout` | Cerrar sesión |
| `project lock`, `project archive` | Archivar/bloquear sala |
| `project delete` | Eliminar sala y datos |
| `project member ban`, `project member block` | Bloquear miembro |
| `project member owner transfer` | Transferir propiedad |
| `editor autosaves restore` | Reemplazar el estado actual por un autoguardado |
| `editor selection delete` | Eliminar nodos seleccionados |
| `editor clipboard cut` | Cortar/eliminar selección |
| `node delete` y sus variantes masivas | Eliminar nodos |
| `connection delete` y `connection delete all` | Eliminar conexiones |
| `canvas clear` | Vaciar el lienzo |

`--yes` no elimina las validaciones de rol, licencia, sesión, argumentos o existencia de los elementos.

## Errores y límites prácticos

- Un dominio o subcomando desconocido produce un error y, cuando es posible, sugiere `help`.
- Un argumento faltante, sobrante, una opción inválida o un valor fuera de rango impide ejecutar esa acción.
- Los nombres/títulos se buscan de forma exacta. Para títulos duplicados, usa ID.
- La consola ejecuta un comando por envío. No admite encadenamiento de comandos, redirecciones, tuberías ni sintaxis de Bash/PowerShell.
- El resultado del comando describe la acción solicitada; una acción remota puede además fallar por red, sesión, licencia o autorización del servicio.
- Los diálogos nativos de compartir, confirmación y selector de archivos son interfaces del sistema/aplicación: el comando los abre, pero no introduce automáticamente los datos que el usuario debe elegir.
- Los comandos disponibles para automatización externa/IA no forman parte de esta versión del producto.
