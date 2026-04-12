import styles from "../Editor.module.css";
import { setSearchQuery } from "../Editor";

import searchIco from "../../../assets/search.svg";
import { Accessor, createSignal, For } from "solid-js";
import { filteredNodes, jumpToNode } from "../../../models/nodes";

export const [activeIndex, setActiveIndex] = createSignal(0);

export const COMMAND_PALETTE = () => {
    return (

        <div
        class={styles.commandPalette}
        >
            <div class={styles.searchBar}>
                <img src={searchIco}/>
                <input type="text" id="search" placeholder="Search objects by name..." onInput={(e) => setSearchQuery(e.currentTarget.value)}/>
            </div>

            <div class={styles.searchResults}>
                <For each={filteredNodes().slice().reverse()}>
                    {(node, index) => 
                    
                        SEARCH_ITEM(`Go to: ${node.title?.trim() || "Empty"} (${node.id})`, node.color, index, () => jumpToNode(node))
                    }
                </For>
            </div>
        </div>

    )
}

const SEARCH_ITEM = (text: string, color: string | null, index: Accessor<number>, onClick: () => void) => {
    return (
        <div style={{"--node-color": color || "#444"}} classList={{[styles.searchItem]: true, [styles.selected]: index() == activeIndex()}} onClick={onClick} onMouseEnter={() => setActiveIndex(index)}>{text}</div>
    )
}