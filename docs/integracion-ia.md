# Integración de Nodus con clientes de IA y otras herramientas

Nodus ofrece un puente local opcional para que un cliente MCP o un cliente propio pueda consultar y operar la instancia de escritorio abierta. No se conecta a un proveedor de IA por sí mismo: el cliente (por ejemplo, VS Code/Copilot) decide qué información enviar a su modelo.

## Alcance actual

- **MCP por `stdio`:** adaptador para clientes compatibles con Model Context Protocol, incluido VS Code.
- **JSON-RPC 2.0 por HTTP local:** interfaz directa para clientes que quieran implementar su propio conector.
- **Herramientas tipadas:** operaciones de uso frecuente para inspeccionar y editar proyectos/diagramas, exportar y administrar salas.
- **Manual integrado para agentes (`nodus_get_manual`):** devuelve desde la app una sección de capacidades, comandos, propiedades, estilos o flujos de trabajo; el agente no necesita inspeccionar el código fuente.
- **`nodus.command`:** herramienta semántica general que permite invocar el resto de la consola Nodus, con restricciones adicionales para llamadas externas.
- **Ejecución en la instancia activa:** las llamadas se reenvían a la ventana Tauri y usan los mismos servicios, stores y acciones de la aplicación.
- **Permisos existentes:** las acciones respetan sesión, licencia, sala y rol actual. La API no concede privilegios nuevos.

El puente se ejecuta en el dispositivo y solo mientras está habilitado en Nodus. El MVP no es un servicio remoto ni una API accesible por la red local.

## Requisito del ejecutable nativo

El proyecto incluye la configuración y el código fuente de Tauri, pero no distribuye el ejecutable sidecar Heza. La configuración de Tauri lo espera en `src-tauri/bin/heza_console-<target-triple>[.exe]`; para Windows x64, por ejemplo, el nombre es `heza_console-x86_64-pc-windows-msvc.exe`. Debe obtenerse por separado para compilar y ejecutar la aplicación nativa. Aunque `eval` no se expone a clientes externos, la aplicación inicia este sidecar al arrancar.

## Activar desde Nodus

1. Abre la **aplicación nativa Tauri** e inicia sesión de forma normal. El puente no está disponible en modo navegador/Vite.
2. Abre la consola Nodus y pulsa **AI Access**.
3. Pulsa **Enable local bridge**. Nodus enlaza el servicio solo a `127.0.0.1:47831`.
4. Asigna un nombre al cliente y pulsa **Pair client**.
5. Copia el token mostrado una sola vez. No lo compartas en un prompt de IA ni lo guardes en un archivo versionado.
6. Configura el cliente MCP o JSON-RPC y pega el token en su campo/almacenamiento secreto.
7. Para cortar el acceso inmediatamente, pulsa **Disable local bridge**. Para retirar el acceso de un cliente, pulsa **Revoke** junto a su nombre.

El token se genera con 256 bits aleatorios. Nodus guarda únicamente su hash SHA-256 y metadatos del cliente dentro del directorio de datos de la aplicación. La lista se conserva entre reinicios; el valor original no se puede volver a mostrar. Si se pierde, revoca ese cliente y emparéjalo de nuevo.

Al deshabilitar el puente, el servidor deja de aceptar llamadas; los clientes emparejados se conservan hasta revocarlos. El token no es un token de cuenta Nodus y no permite autenticarse como usuario fuera de esta interfaz local.

## Configuración de VS Code / MCP

El repositorio incluye [.vscode/mcp.json](../.vscode/mcp.json). VS Code solicita el token mediante un `promptString` protegido y ejecuta [tools/nodus-mcp.mjs](../tools/nodus-mcp.mjs) con Node.js.

Pasos:

1. Habilita el puente en la aplicación Tauri y empareja un cliente llamado, por ejemplo, `VS Code`.
2. En VS Code, inicia el servidor MCP `nodus-flow` desde la vista de herramientas MCP.
3. Cuando VS Code solicite **Nodus AI bridge pairing token**, pega el token que copiaste de Nodus.
4. La lista de herramientas se obtiene dinámicamente de la aplicación; cambia según la pantalla y el rol activo.

Si el servidor ya está en ejecución antes de habilitar Nodus, detén e inicia el servidor MCP después de habilitarlo. Si cambias o revocas el token, vuelve a iniciar el servidor y usa el token del nuevo emparejamiento.

El adaptador no usa `stdout` para mensajes de diagnóstico: ese canal pertenece al protocolo MCP. Los errores de conexión se devuelven al cliente MCP y los errores de arranque se escriben en `stderr`.

MCP permite solo letras minúsculas, números, guiones y guiones bajos en los nombres de herramientas. Por eso VS Code muestra los nombres con guion bajo, por ejemplo `nodus_inspect_app`; el adaptador los traduce al nombre interno `nodus.inspect_app` al llamar al puente. Los clientes JSON-RPC directos siguen usando los nombres con punto documentados en esta guía.

## API JSON-RPC local

URL:

```text
http://127.0.0.1:47831/v1/rpc
```

Cabeceras obligatorias:

```http
Authorization: Bearer <token-de-emparejamiento>
Content-Type: application/json
```

No se aceptan conexiones remotas, peticiones con cabecera `Origin`, hosts distintos de `127.0.0.1:47831`/`localhost:47831`, notificaciones JSON-RPC sin ID ni métodos que no sean `tools/list` y `tools/call`. El límite del cuerpo es 64 KiB y se aceptan hasta ocho llamadas simultáneas. El tiempo máximo de una llamada es de dos minutos.

### Enumerar herramientas

Solicitud:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

La respuesta contiene herramientas MCP con `name`, `description` e `inputSchema`. La lista depende de la vista actual y de los permisos del usuario. Hay que volver a consultarla al cambiar de sala o rol.

### Ejecutar una herramienta

Solicitud:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "nodus.create_node",
    "arguments": {
      "title": "Customer"
    }
  }
}
```

La respuesta contiene `result.content`, `result.isError` y, si está disponible, `result.structuredContent`. `structuredContent` siempre es un objeto, como exige MCP; cuando el resultado original es una lista, sus elementos están bajo `structuredContent.items`. Los errores de validación o ejecución se devuelven como contenido marcado con `isError`; los errores de protocolo/autenticación usan el objeto `error` de JSON-RPC o un estado HTTP no exitoso.

No se habilita CORS. Esta interfaz está pensada para procesos locales como el adaptador MCP y no para invocarse desde JavaScript de una página web.

## Herramientas disponibles

Las herramientas tipadas se anuncian solo en las vistas donde tienen sentido. Las operaciones de edición se anuncian únicamente a propietarios y editores. La herramienta general `nodus.command` facilita el acceso a las restantes funciones de la consola; cada comando vuelve a validar pantalla, sesión, licencia y rol al ejecutarse.

| Herramienta | Argumentos | Efecto |
|---|---|---|
| `nodus.command` | `command: string` | Ejecuta un solo comando semántico de la consola, con las restricciones externas descritas abajo. |
| `nodus.get_manual` | `topic?: overview \| commands \| nodes \| connections \| workflows` | Devuelve la documentación incluida en la versión activa de Nodus. Sin argumento devuelve el índice. `commands` devuelve la guía completa de la consola. |
| `nodus.inspect_app` | Ninguno | Consulta pantalla, sesión, controles y datos generales de la vista. |
| `nodus.list_projects` | Ninguno | Lista los proyectos disponibles para la cuenta. |
| `nodus.create_project` | `name: string`, `visibility?: private \| shared \| public` | Crea y abre una sala; visibilidad predeterminada `shared`. |
| `nodus.open_project` | `id: string` | Abre una sala por ID. |
| `nodus.inspect_diagram` | Ninguno | Devuelve el estado del editor, selección, colaboradores, cámara, paneles e historial. |
| `nodus.list_nodes` | Ninguno | Lista nodos del diagrama activo. |
| `nodus.get_node` | `selector: string` | Consulta un nodo por ID o título exacto. Los títulos duplicados requieren ID. |
| `nodus.create_node` | `title: string` | Crea un nodo en el centro de la vista. |
| `nodus.update_node` | `selector: string` y uno o más campos opcionales | Cambia título, posición, tamaño, color, opacidad, radio, forma o bloqueo. |
| `nodus.delete_node` | `selector: string` | Elimina nodo y conexiones adjuntas; solicita confirmación visible. |
| `nodus.list_connections` | Ninguno | Lista conexiones. |
| `nodus.create_connection` | `from: string`, `to: string` | Crea una conexión dirigida entre dos nodos identificados por ID o título exacto. |
| `nodus.delete_connection` | `id: string` | Elimina una conexión por ID; solicita confirmación visible. |
| `nodus.export_diagram` | `format: png \| svg \| json`, `scale?: integer` | Exporta el diagrama. `scale` solo se admite para PNG y va de 1 a 10. |

`nodus.update_node` comparte las validaciones de `node update`: `width >= 60`, `height >= 40`, `opacity` entre 0 y 1, `radius >= 0`, `style` 1/2/3 y color hexadecimal de 3, 6 u 8 dígitos. La herramienta tipada exige valores del tipo anunciado y rechaza argumentos desconocidos.

Para propiedades avanzadas de nodos, rutas de conexiones, estilos y procedimientos de diagramación, los agentes deben consultar `nodus.get_manual` antes de planificar la acción. El documento mantenido en el repositorio es [docs/agentes-nodus.md](./agentes-nodus.md); el tema `commands` devuelve [docs/consola.md](./consola.md) desde la aplicación.

## Herramienta semántica general

`nodus.command` toma exactamente un campo `command`, por ejemplo:

```json
{
  "name": "nodus.command",
  "arguments": {
    "command": "project member list"
  }
}
```

Admite la gramática documentada en el [manual de la consola](./consola.md), incluidos los comandos de sala, propiedades, selección, cámara, paneles, autoguardados, importación, exportación, notificaciones, pantalla completa y sesión. No es una terminal.

Las llamadas externas rechazan expresamente:

- `eval` y cualquier invocación del intérprete Heza.
- `auth login` y `auth signup`; la integración no recibe contraseñas ni confirmaciones de contraseña.
- `--yes`; ningún cliente puede saltarse una confirmación usando ese flag.

`auth logout` y las operaciones sensibles sí se pueden solicitar, pero necesitan confirmación en una ventana visible de Nodus. Entre ellas están borrar datos, vaciar el lienzo, archivar salas, bloquear miembros, transferir propiedad y restaurar autoguardados. Cancelar el diálogo cancela la operación. Las operaciones rutinarias se pueden ejecutar sin confirmación si el rol lo permite.

La confirmación es adicional a los permisos: no permite que un lector edite ni que una cuenta sin acceso cambie una sala.

## Datos y privacidad

El puente no transmite datos a un proveedor de IA directamente. Sin embargo, al usar un cliente de IA, los resultados de `inspect`, `list`, `get` o de cualquier herramienta pueden contener nombres, IDs, propiedades y contenido del diagrama; el propio cliente puede enviar esos resultados a su proveedor. Configura el proveedor de acuerdo con la política de privacidad del proyecto.

Las credenciales de cuenta y tokens de autenticación de Nodus no se incluyen en las herramientas. El token de emparejamiento solo autoriza la API local; no es una credencial de Nodus.

El nombre del cliente y el resultado resumido de las llamadas se anotan en la transcripción local de la consola mientras esta ventana siga abierta. No se guarda un registro remoto ni persistente de prompts/respuestas.

## Límites

- Nodus debe estar abierta y el puente activado. El puente no ejecuta acciones cuando la aplicación está cerrada.
- La integración se valida en la aplicación nativa Tauri; `npm run dev`/Vite no implementa un listener local.
- El editor, la licencia, la sesión, la red y los permisos del servidor siguen condicionando cada llamada.
- Selectores de archivos, diálogos de compartir y otras interfaces del sistema pueden abrirse, pero la herramienta no puede elegir automáticamente un archivo o completar una interacción humana.
- `eval` queda excluido hasta que el intérprete Heza y sus capacidades puedan auditarse.
- El adaptador MCP del repositorio requiere Node.js y las dependencias del proyecto. Otros clientes pueden usar JSON-RPC directamente con el token emparejado.
