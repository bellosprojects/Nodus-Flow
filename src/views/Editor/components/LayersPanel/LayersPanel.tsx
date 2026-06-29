import { Show, Switch, Match, For } from "solid-js";
import {
  connections,
  selectedConnectionId,
  setSelectedConnectionId,
  Connection,
} from "../../../../models/connections";
import {
  nodes,
  Node,
  selectedNodesIds,
  jumpToNode,
  getNode,
  setSelectedNodesIds,
  ocupadoPor,
} from "../../../../models/nodes";
import { isLayersPanelOpen, layerView, setLayerView } from "../../Editor";
import {
  actionDeleteConnection,
  actionChangeConnectionStyle,
  actionToggleLockNodes,
} from "../../../../core/actions";

import styles from "./LayersPanel.module.css";

// Iconos inline (SVG)
const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const UnlockIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);
const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const StyleIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

export const LAYERS_PANEL = () => {
  return (
    <Show when={isLayersPanelOpen()}>
      <div class={styles.layersPanel}>
        {/* Cabecera con pestañas */}
        <div class={styles.tabs}>
          <button
            classList={{
              [styles.tab]: true,
              [styles.active]: layerView() === "nodes",
            }}
            onClick={() => setLayerView("nodes")}
          >
            <span>Nodes</span>
            <span class={styles.badge}>{nodes.length}</span>
          </button>
          <button
            classList={{
              [styles.tab]: true,
              [styles.active]: layerView() === "connections",
            }}
            onClick={() => setLayerView("connections")}
          >
            <span>Connections</span>
            <span class={styles.badge}>{connections.length}</span>
          </button>
        </div>

        {/* Lista de elementos */}
        <div class={styles.listContainer}>
          <Switch>
            <Match when={layerView() === "nodes"}>
              <For each={nodes.slice().reverse()}>
                {(node) => <NodeItem node={node} />}
              </For>
            </Match>
            <Match when={layerView() === "connections"}>
              <For each={connections.slice().reverse()}>
                {(conn) => <ConnectionItem conn={conn} />}
              </For>
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
  );
};

// Item de nodo
const NodeItem = (props: { node: Node }) => {
  const { node } = props;
  const isSelected = () => selectedNodesIds().includes(node.id);

  const handleToggleLock = (e: MouseEvent) => {
    e.stopPropagation();
    if (!ocupadoPor(node.id)) {
      actionToggleLockNodes([node.id], !node.lock);
    }
  };

  return (
    <div
      classList={{
        [styles.item]: true,
        [styles.selected]: isSelected(),
      }}
      onClick={() => jumpToNode(node)}
    >
      <span
        class={styles.colorDot}
        style={{ "background-color": node.color }}
      />
      <span classList={{[styles.itemTitle]: true, [styles.empty]: !node.title}}>{node.title?.substring(0, 22) || "Untitled"}</span>
      <span>{`(${node.style === 1? "S" : node.style === 2? "E" : "D"})`}</span>
      <button
        class={styles.actionBtn}
        onClick={handleToggleLock}
        title={node.lock ? "Unlock node" : "Lock node"}
      >
        {node.lock ? <LockIcon /> : <UnlockIcon />}
      </button>
    </div>
  );
};

// Item de conexión
const ConnectionItem = (props: { conn: Connection }) => {
  const { conn } = props;
  const isSelected = () => selectedConnectionId() === conn.id;
  const fromNode = () => getNode(conn.from);
  const toNode = () => getNode(conn.to);

  const handleSelect = () => {
    setSelectedConnectionId(conn.id);
    setSelectedNodesIds([]);
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    actionDeleteConnection(conn.id);
  };

  const handleStyle = (e: MouseEvent) => {
    e.stopPropagation();
    actionChangeConnectionStyle(conn.id, 1 + ((conn.tipo) % 7));
  };

  return (
    <div
      classList={{
        [styles.item]: true,
        [styles.selected]: isSelected(),
      }}
      onClick={handleSelect}
    >
      <span class={styles.connectionLabel}>
        <span classList={{[styles.nodeRef]: true, [styles.empty]: !fromNode()?.title}}>
          {fromNode()?.title?.substring(0, 12) || "Empty"}
        </span>
        <span class={styles.arrow}>→</span>
        <span classList={{[styles.nodeRef]: true, [styles.empty]: !toNode()?.title}}>
          {toNode()?.title?.substring(0, 12) || "Empty"}
        </span>
      </span>
      <div class={styles.actionGroup}>
        <span>{`(${conn.tipo})`}</span>
        <button
          class={styles.actionBtn}
          onClick={handleStyle}
          title="Change connection style"
        >
          <StyleIcon />
        </button>
        <button
          class={styles.actionBtn}
          onClick={handleDelete}
          title="Delete connection"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
};