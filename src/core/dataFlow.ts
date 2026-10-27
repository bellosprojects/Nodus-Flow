/**
 * En este archivo gestionamos el simulacro de flujo de datos
 * Cuando el proyecto esta en modo dataFlow seguimos el flujo desde el punto de inicio (ovalo) seleccionado hata el punto final
 * Los Ovalos son puntos de inicio/fin.
 * Los puntos de inicio contienen un dato inicial que viaja por las conexiones a los demas nodos
 * Los nodos rectangulares definen operaciones sobre el dato de entrada y propagan nuevamente la salida en la otra direccion
 * Los nodos en forma de rombo definen una condicion que determina a que nodo se propaga el dato de entrada
 * El flujo de datos es puramente local, con fines de simulacion, no se propaga a otros usuarios ni se guarda en la base de datos
 */

import { userData } from "../models/userStore";
import { getNode, Node, selectedNodes, setSelectedNodesIds } from "../models/nodes";
import { showToast, ToastType } from "../models/toast";
import { Connection, connections } from "../models/connections";
import { evalValueFromCommand } from "../utils/commands";
import { setDataFlowResult, setIsRunningDataFlow } from "../views/Editor/Editor";
import { Path } from "canvaskit-wasm";
import { nodusCanvas } from "./NodusCanvas";
import { NodeToNode } from "../utils/path";

/**
 * Esta es la funcion que llama el editor para iniciar el flujo de datos
 */
export async function initDataFlow(){

    // Primero verificamos que realmente estemos en modo dataFlow
    if(!userData.currentProjectProperties.enableDataFlowMode) return;

    //Verificamos que haya un nodo seleccionado
    if(!selectedNodes() || selectedNodes().length === 0){
        showToast("No hay nodos seleccionados", ToastType.ERROR);
        return;
    }

    //Verificamos que solo haya un nodo seleccionado
    if(selectedNodes().length > 1){
        showToast("Solo se puede iniciar el flujo de datos desde un nodo", ToastType.ERROR);
        return;
    }

    //Verificamos que el nodo seleccionado sea un nodo de inicio (ovalo)
    const selectedNode = selectedNodes()[0];
    if(!selectedNode || selectedNode.style != 2){
        showToast("El nodo seleccionado no es un nodo de inicio", ToastType.ERROR);
        return;
    }

    setSelectedNodesIds([]);
    showToast("Iniciando Flujo", ToastType.INFO);
    setIsRunningDataFlow(true);

    // Tenemos el punto de inicio
    // Creamos el camino (lista de nodos) con sus conexiones

    const initNode = selectedNode;

    // Todo el camino debe que el usuario creo las conexiones bien (partio del origin a nodo que recibe el dato, por lo tanto no buscamos conexiones que vayan en sentido contrario)
    //Obtenemos la lista de conexiones

    const conexiones = [...connections];

    // Creamos una funcion para obetner las conexiones que salen de un nodo
    function getConnectionsFromNode(nodeId: string){
        return conexiones.filter(c => c.from === nodeId);
    }

    //Creamos el camino de nodos a partir del nodo de inicio
    const path = [initNode];
    let currentNode : typeof initNode | undefined = initNode;

    while (currentNode) {
        const outgoingConnections = getConnectionsFromNode(currentNode.id);
        if (outgoingConnections.length === 0) break;

        const nextNode = getNode(outgoingConnections[0].to); // Suponemos una conexión por ahora
        if(nextNode){
            path.push(nextNode);
        }
        currentNode = nextNode;
    }

    // Limpiar el estado de la consola
    await evalValueFromCommand("~RESET KEY~");
    
    // Obtener los datos procesados
    const results : string[] = [];
    path.forEach(async n => {
        const n_val = await evalValueFromCommand(n.title);
        if (n_val)
        results.push(n_val);
    });

    await simulateFlow(path, conexiones, results);

    setIsRunningDataFlow(false);
    showToast("Flujo Terminado", ToastType.INFO);
    setSelectedNodesIds([initNode.id]);
}

function animateProgress(durationMs: number, onFrame: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
        const startTime = performance.now();
        function step(now: number) {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / durationMs);
            onFrame(t);
            if(t < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const centerOfNode = (node: Node) => ({
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
});

const esperar = async (ms: number) => new Promise((r) => setTimeout(r, ms));

function getPointAtPath(path: Path, t: number): {x: number, y: number} | null {
    const ck = nodusCanvas.getCK();

    const iter = new ck.ContourMeasureIter(path, false, 1.0);
    const cotour = iter.next();

    if(!cotour){
        iter.delete();
        return null;
    }

    const totalLength = cotour.length();

    const campledT = Math.max(0, Math.min(1, t));
    const targetDistance = totalLength * campledT;

    const posTan = cotour.getPosTan(targetDistance);

    cotour.delete();
    iter.delete();

    if(posTan){
        return {
            x: posTan[0],
            y: posTan[1]
        };
    }

    return null;
}

const getConnFromNodes = (conns: Connection[], from: string, to: string): Connection | null => {
    const cnns = conns.filter(c => c.from === from && c.to === to);
    if (cnns.length === 0){
        return null;
    } 
    return cnns[0];
}

async function simulateFlow(path: Node[], conns: Connection[], results: string[]) {

    console.log("Simulating flow for:", results);

    if(path.length === 0) return;

    const centerOfFirstNode = centerOfNode(path[0]);
    const required = nodusCanvas.camera.offsetToCenterPoint(centerOfFirstNode.x, centerOfFirstNode.y, 1.5);
    nodusCanvas.camera.animateTo(required.offsetX, required.offsetY, 1.5, 600);
    await esperar(600);
    setDataFlowResult(results[0]);
    await esperar(400);
    
    for(let i = 0; i < path.length -1; i++){
        const currentNode = path[i];
        const nextNode = path[i + 1];
        const conn = getConnFromNodes(conns, currentNode.id, nextNode.id);

        const centerOfCurrentNode = centerOfNode(currentNode);
        const centerOfNextNode = centerOfNode(nextNode);

        if(conn){

            const pathConn = NodeToNode(nodusCanvas.getCK(), currentNode, nextNode, conn);
            const startPointOfPath = getPointAtPath(pathConn, 0);
            const endPointOfPAth = getPointAtPath(pathConn, 1);

            if(startPointOfPath && endPointOfPAth){

                await animateProgress(250, (t) => {
                    const x = lerp(centerOfCurrentNode.x, startPointOfPath.x, t);
                    const y = lerp(centerOfCurrentNode.y, startPointOfPath.y, t);
                    nodusCanvas.camera.centerOnPoint(x,y);
                });

                await animateProgress(800, (t) => {
                    const pt = getPointAtPath(pathConn, t);
                    if(pt) {
                        nodusCanvas.camera.centerOnPoint(pt.x, pt.y);
                    }
                });

                await animateProgress(250, (t) => {
                    const x = lerp(endPointOfPAth.x, centerOfNextNode.x, t);
                    const y = lerp(endPointOfPAth.y, centerOfNextNode.y, t);
                    nodusCanvas.camera.centerOnPoint(x,y);
                });

                setDataFlowResult(results[i + 1]);
                await esperar(400);
            }

            pathConn.delete();
        }
    }

    setDataFlowResult("");
    nodusCanvas.camera.animateTo(required.offsetX, required.offsetY, 1.5, 800);
    await esperar(1500);
}