# ⚡ Nodus Flow v1.0

### The Engineering-First Diagramming Station.

Nodus Flow es un editor de diagramas de alto rendimiento diseñado para arquitectos de software y desarrolladores de backend. Construido sobre un motor de renderizado gráfico de bajo nivel y una arquitectura de estado granular, ofrece una experiencia de usuario fluida, minimalista y estética Cyberpunk.

---
### 🚀 Core Tech Stack
Para lograr la máxima eficiencia y reactividad, el proyecto utiliza:

- Tauri + Rust: El core de la aplicación, proporcionando un entorno ligero y seguro.

- SolidJS: Gestión de estado ultra-eficiente mediante señales y stores, eliminando el overhead del Virtual DOM.

 - Skia (Canvas API): Motor de renderizado 2D de alto rendimiento para el manejo de miles de nodos y conexiones con efectos visuales avanzados.

 - Websockets: Integración nativa para colaboración rápida.

---
### 🛠️ Key Features (v1.0)
#### 1. Omni-Bar & Command Palette (Ctrl + K)
El cerebro de la aplicación. Una barra de búsqueda híbrida que permite:

    - Renombrado: Cambia el nombre del proyecto en tiempo real.

    - Comandos: Usa el prefijo > para ejecutar acciones (Export, Share, Create).

    - Teletransporte: Navegación instantánea hacia cualquier nodo mediante filtros inteligentes.

#### 2. Multi-Tab Layers Panel
Gestión organizada de la complejidad del diagrama. Dividido en tres contextos:

    - Nodes: Control de visibilidad y bloqueo de elementos.

    - Connections: Gestión de flujos y cables.

    - Groups: (Próximamente) Organización lógica de módulos.

#### 3. Reactive Properties Panel
Ajuste preciso de cada entidad del canvas. Cambia colores neón, opacidad, radio de bordes y dimensiones con actualización instantánea mediante Solid Stores.

#### 4. Advanced Render Engine
    - Snap-to-Grid: Alineación automática para diagramas perfectamente ordenados.

    - Neon Flow Effects: Cables con animaciones de flujo que indican la dirección de la lógica.

    - Z-Index Management: Sistema de capas dinámico para evitar solapamientos visuales.

---
### 🎨 UI/UX Design
La interfaz ha sido diseñada bajo el principio de _"Zero Clutter"_:

- Glassmorphism: Paneles traslúcidos que no interrumpen la visión del canvas.

- Custom Scrollbars: Barras de desplazamiento estilizadas que respetan el border-radius del diseño.

 - Adaptive HUD: Los paneles se ocultan o transforman según el contexto de uso para maximizar el espacio de trabajo.

---
### Screenshots

![UI](<screenshots/Captura de pantalla 2026-04-12 163224.png>)

![Home](<screenshots/image.png>)