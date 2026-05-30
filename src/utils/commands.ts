import { nodusCanvas } from "../core/NodusCanvas";
import { addConnection, addConnectionProperty, areConnected, connections, deleteConnection, deleteConnectionProperty } from "../models/connections";
import { addNode, addNodeProperty, bulkDelete, deleteAllDisconnected, deleteNode, deleteNodeProperty, nodes, selectedNodesIds } from "../models/nodes";

export const createNodesFromCommand = (query? : string) => {

    /** Formato de la query
     *  Create Node: [newNodeNameN]
     */

    const centerPoint = nodusCanvas.camera.getWorldCenter();

    addNode(centerPoint.x - 80, centerPoint.y - 40, true, query);

}

export const connectGraph = (query?: string) => {

    /**
     * Formate de la query
     * Connect: Complete
     * Connect: Circuit
     */

    if(query === null) return;

    if(query === "Complete"){
        for(let i =0; i<selectedNodesIds().length; i++){
            for(let j=i; j<selectedNodesIds().length; j++){
                if(!areConnected(selectedNodesIds()[i], selectedNodesIds()[j]))
                addConnection(selectedNodesIds()[i], selectedNodesIds()[j]);
            }
        }
    }
}

export const deleteFromQuery = (query?: string) => {

    /**
     * formato de la query
     * Delete: All Disconnected
     * Delete: All Connections
     * Delete: All Nodes
     * Delete: Selected Nodes
     * Delete: NodeName
     */

    if(query === undefined || query === "Selected Nodes"){
        bulkDelete();
    }

    else if(query === "All Disconnected"){
        deleteAllDisconnected();
    }

    else if(query === "All Connections"){
        [...connections].forEach(conn => {
            deleteConnection(conn.id);
        });
    }
    else if(query === "All Nodes"){
        [...nodes].forEach(node => {
            deleteNode(node.id);
        });
    }

    else {
        const node = [...nodes].find(node => node.title === query);

        if(node) deleteNode(node.id);
    }
}

export const addNodePropertyFromQuery = (query?: string) => {

    /**
     * Formato de la query
     * Add Property: NodeName propertyName propertyValue?
     * 
     * Ejemplo:
     * Add Property: Node1 underline
     * Add Property: Node1 color #ff0000
     */


    const node = [...nodes].find(node => node.title === query?.split(" ")[0]);

    if(node){
        const propertyName = query?.split(" ")[1];
        const propertyValue = query?.split(" ").slice(2).join(" ") || true;

        if(propertyName)

        addNodeProperty(node.id, propertyName, propertyValue);
    }

    console.log(node);
}

export const deleteNodePropertyFromQuery = (query?: string) => {

    /**
     * Formato de la query
     * Delete Property: NodeName propertyName
     * 
     * Ejemplo:
     * Delete Property: Node1 underline
     * Delete Property: Node1 color
     */

    const node = [...nodes].find(node => node.title === query?.split(" ")[0]);

    if(node){
            const propertyName = query?.split(" ")[1];

            if(propertyName)

            deleteNodeProperty(node.id, propertyName);
    }

}

export const addConnectionPropertyFromQuery = (query?: string) => {

    /**
     * Formato de la query
     * 
     * Add Property: fromNodeName toNodeName propertyName propertyValue?
     */
    
    const fromNode = [...nodes].find(node => node.title === query?.split(" ")[0]);
    const toNode = [...nodes].find(node => node.title === query?.split(" ")[1]);

    if(fromNode && toNode){
        const propertyName = query?.split(" ")[2];
        const propertyValue = query?.split(" ").slice(3).join(" ") || true;

        if(propertyName) addConnectionProperty(connections.find(conn => (conn.from === fromNode.id && conn.to === toNode.id) || (conn.from === toNode.id && conn.to === fromNode.id))?.id || "", propertyName, propertyValue);
    }
}

export const deleteConnectionPropertyFromQuery = (query?: string) => {

    /**
     * Formato de la query
     * 
     * Delete Property: fromNodeName toNodeName propertyName
     */

    const fromNode = [...nodes].find(node => node.title === query?.split(" ")[0]);
    const toNode = [...nodes].find(node => node.title === query?.split(" ")[1]);

    if(fromNode && toNode){
        const propertyName = query?.split(" ")[2];

        if(propertyName) deleteConnectionProperty(connections.find(conn => (conn.from === fromNode.id && conn.to === toNode.id) || (conn.from === toNode.id && conn.to === fromNode.id))?.id || "", propertyName);
    }
}