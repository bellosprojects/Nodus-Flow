import { getNode, Node, nodes } from "../models/nodes";
import { Connection, connections } from "../models/connections";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { removeToast, showToast, ToastType } from "../models/toast";

/**
 * Tipado para los tipos de generalizacion
 * OVERLAPPING: Generalizacion solapada (ej. Persona(Empleado, Cliente), un empleado puede ser un cliente )
 * DISJOINT: Generalizacion disjunta (ej. Animal(Gato, Perro), un perro no puede ser un gato )
 */
enum Membership {
    OVERLAPPING,
    DISJOINT
};

/**
 * Entidad de un modelo entidad relacion
 * 
 * name: Nombre de la entidad
 * isParent: Indica si es padre (Generalizacion)
 * membership: Indica si es pare por generalizacion solapada o disjunta
 * isWeak: Indica si es una entidad debil
 * parent: Indica el id de su padre (solo si aplica, debe ser una entidad)
 * id: identificador (no se imprime)
 */
interface Entity {
    name: string,
    isParent: boolean,
    membership?: Membership,
    isWeak: boolean,
    parent?: string,
    isSon: boolean,
    id: string
};

/**
 * Relacion del modelo entidad relacion
 * 
 * name: Nombre de la relacion
 * isWeak: Indica si es una relacion debil (una relacion debil conecta una entidad debil con la entidad fuerte que necesita para identificarse)
 * entities: Lista de las entidades a las que estan conectadas (>2 necesariamnete) indicando su id y su cardinalidad. Generalmente son entre 2 - 3 entidades
 * id: Identificador (no se imprime)
 */
interface Relation {
    name: string,
    isWeak: boolean,
    entities: {
        id: string,
        cardinality: string
    }[],
    id: string
}

/**
 * Atributo del modelo entidad relacion
 * 
 * name: nombre del atributo
 * type: tipo de dato (si se especifica)
 * parent: Id de la entidad o relacion a la que pertenecen (debe existir)
 * isMulti: Indica si es multivalorado
 * isPrimearyKey: Indica si es clave primaria
 * isForeingKey: Indica si es clave foranea
 * isDerivativa: Indica si es derivado (ej. Edad de deriva de fecha de nacimiento)
 * id: Identificador (no se imprime)
 */
interface Attribute {
    name: string,
    type?: string,
    parent?: string,
    isMulti: boolean,
    isPrimaryKey: boolean,
    isDerivative: boolean,
    id: string
}

interface ColumnDef {
    name: string;
    type?: string;
    isPK: boolean;
    isFK: boolean;
    refTable?: string;
    refColumn?: string;
    isDerived?: boolean;
    isMulti?: boolean;
}

interface TableDef {
    name: string;
    columns: ColumnDef[];
    pkColumns: string[];
    fkConstraints: { column: string; refTable: string; refColumn: string }[];
    parentEntity?: string;
    children?: string[];
}

function convertToRelationalModel(
    entities: Entity[],
    relations: Relation[],
    attributes: Attribute[]
): string {
    const entityMap = new Map<string, Entity>();
    entities.forEach(e => entityMap.set(e.id, e));

    const relationMap = new Map<string, Relation>();
    relations.forEach(r => relationMap.set(r.id, r));

    const attributesByParent = new Map<string, Attribute[]>();
    attributes.forEach(a => {
        if (a.parent) {
            if (!attributesByParent.has(a.parent)) {
                attributesByParent.set(a.parent, []);
            }
            attributesByParent.get(a.parent)!.push(a);
        }
    });

    const parentChildrenMap = new Map<string, string[]>();
    for (const entity of entities) {
        if (entity.parent) {
            if (!parentChildrenMap.has(entity.parent)) {
                parentChildrenMap.set(entity.parent, []);
            }
            parentChildrenMap.get(entity.parent)!.push(entity.name);
        }
    }

    const pkCache = new Map<string, string[]>();

    function getEntityPK(entityId: string): string[] {
        if (pkCache.has(entityId)) return pkCache.get(entityId)!;
        const entity = entityMap.get(entityId);
        if (!entity) return [];

        const directAttrs = attributesByParent.get(entityId) || [];

        if (entity.isWeak) {
            // Discriminante (atributos propios con PK) + PK del fuerte
            const ownPK = directAttrs.filter(a => a.isPrimaryKey && !a.isMulti).map(a => a.name);
            const weakRel = relations.find(r =>
                r.isWeak && r.entities.some(e => e.id === entityId)
            );
            let strongPK: string[] = [];
            if (weakRel) {
                const strongId = weakRel.entities.find(e => e.id !== entityId)?.id;
                if (strongId) {
                    strongPK = getEntityPK(strongId);
                }
            }
            const result = Array.from(new Set([...ownPK, ...strongPK]));
            pkCache.set(entityId, result);
            return result;
        } else if (entity.parent) {
            // Hija: si tiene PK propia, la usa; si no, hereda del padre
            const ownPK = directAttrs.filter(a => a.isPrimaryKey && !a.isMulti).map(a => a.name);
            if (ownPK.length > 0) {
                pkCache.set(entityId, ownPK);
                return ownPK;
            } else {
                const parentPK = getEntityPK(entity.parent);
                pkCache.set(entityId, parentPK);
                return parentPK;
            }
        } else {
            // Normal
            const pk = directAttrs.filter(a => a.isPrimaryKey && !a.isMulti).map(a => a.name);
            pkCache.set(entityId, pk);
            return pk;
        }
    }

    const tableDefs = new Map<string, TableDef>();

    // 1. Crear tablas base con todos los atributos (sin PK/FK aún)
    for (const entity of entities) {
        const tableName = entity.name;
        const attrs = attributesByParent.get(entity.id) || [];
        const cols: ColumnDef[] = attrs.map(attr => ({
            name: attr.name,
            type: attr.type,
            isPK: false,
            isFK: false,
            refTable: undefined,
            refColumn: undefined,
            isDerived: attr.isDerivative,
            isMulti: attr.isMulti,
        }));

        tableDefs.set(tableName, {
            name: tableName,
            columns: cols,
            pkColumns: [],
            fkConstraints: [],
            parentEntity: entity.parent ? entityMap.get(entity.parent)?.name : undefined,
            children: parentChildrenMap.get(entity.id) || [],
        });
    }

    // 2. Procesar relaciones débiles: añadir PK del fuerte a la tabla débil (como PK y FK)
    for (const relation of relations) {
        if (!relation.isWeak) continue;
        const entityIds = relation.entities.map(e => e.id);
        const weakId = entityIds.find(id => entityMap.get(id)?.isWeak === true);
        const strongId = entityIds.find(id => entityMap.get(id)?.isWeak === false);
        if (!weakId || !strongId) continue;

        const weakEntity = entityMap.get(weakId)!;
        const strongEntity = entityMap.get(strongId)!;
        const weakTable = tableDefs.get(weakEntity.name)!;
        const strongPK = getEntityPK(strongId);

        for (const pkCol of strongPK) {
            // Verificar si ya existe una columna con ese nombre (puede ser el discriminante con mismo nombre, aunque improbable)
            let col = weakTable.columns.find(c => c.name === pkCol);
            if (!col) {
                const strongAttrs = attributesByParent.get(strongId) || [];
                const attr = strongAttrs.find(a => a.name === pkCol && a.isPrimaryKey);
                col = {
                    name: pkCol,
                    type: attr?.type,
                    isPK: false, // se ajustará luego
                    isFK: false,
                    refTable: undefined,
                    refColumn: undefined,
                    isDerived: false,
                    isMulti: false,
                };
                weakTable.columns.push(col);
            }
            // Marcamos como PK (parte de la clave) y FK
            col.isPK = true;
            col.isFK = true;
            col.refTable = strongEntity.name;
            col.refColumn = pkCol;
            weakTable.fkConstraints.push({
                column: pkCol,
                refTable: strongEntity.name,
                refColumn: pkCol,
            });
        }
    }

    // 3. Procesar generalizaciones: añadir PK del padre al hijo (como FK)
    for (const entity of entities) {
        if (!entity.parent) continue;
        const parentEntity = entityMap.get(entity.parent);
        if (!parentEntity) continue;

        const childTable = tableDefs.get(entity.name)!;
        const parentPK = getEntityPK(entity.parent);

        for (const pkCol of parentPK) {
            // Verificar si la columna ya existe (puede ser que el hijo tenga un atributo con ese nombre)
            let col = childTable.columns.find(c => c.name === pkCol);
            if (!col) {
                const parentAttrs = attributesByParent.get(entity.parent) || [];
                const attr = parentAttrs.find(a => a.name === pkCol && a.isPrimaryKey);
                col = {
                    name: pkCol,
                    type: attr?.type,
                    isPK: false,
                    isFK: false,
                    refTable: undefined,
                    refColumn: undefined,
                    isDerived: false,
                    isMulti: false,
                };
                childTable.columns.push(col);
            }
            // No lo marcamos como PK porque el hijo puede tener su propia PK; si no tiene, luego se marcará como PK
            col.isFK = true;
            col.refTable = parentEntity.name;
            col.refColumn = pkCol;
            const exists = childTable.fkConstraints.some(fk => fk.column === pkCol && fk.refTable === parentEntity.name);
            if (!exists) {
                childTable.fkConstraints.push({
                    column: pkCol,
                    refTable: parentEntity.name,
                    refColumn: pkCol,
                });
            }
        }
    }

    // 4. Asignar PK a cada tabla según getEntityPK
    for (const entity of entities) {
        const table = tableDefs.get(entity.name)!;
        const pkColumns = getEntityPK(entity.id);
        table.pkColumns = pkColumns;
        for (const col of table.columns) {
            if (pkColumns.includes(col.name) && !col.isMulti) {
                col.isPK = true;
            } else {
                col.isPK = false;
            }
        }
    }

    // 5. Procesar relaciones no débiles
    function createRelationTable(relation: Relation, entityIds: string[]) {
        const tableName = relation.name;
        if (tableDefs.has(tableName)) return;

        const cols: ColumnDef[] = [];
        const fkConstraints: { column: string; refTable: string; refColumn: string }[] = [];
        const pkColumns: string[] = [];

        for (const entityId of entityIds) {
            const entity = entityMap.get(entityId)!;
            const pk = getEntityPK(entityId);
            for (const pkCol of pk) {
                const colName = entity.name + '_' + pkCol;
                // Evitar duplicados (si dos entidades tienen la misma PK column name, se concatenan)
                const existing = cols.find(c => c.name === colName);
                if (!existing) {
                    const attrs = attributesByParent.get(entityId) || [];
                    const attr = attrs.find(a => a.name === pkCol && a.isPrimaryKey);
                    cols.push({
                        name: colName,
                        type: attr?.type,
                        isPK: true,
                        isFK: true,
                        refTable: entity.name,
                        refColumn: pkCol,
                        isDerived: false,
                        isMulti: false,
                    });
                    pkColumns.push(colName);
                    fkConstraints.push({
                        column: colName,
                        refTable: entity.name,
                        refColumn: pkCol,
                    });
                }
            }
        }

        // Atributos propios de la relación
        const relAttrs = attributesByParent.get(relation.id) || [];
        for (const attr of relAttrs) {
            cols.push({
                name: attr.name,
                type: attr.type,
                isPK: false,
                isFK: false,
                refTable: undefined,
                refColumn: undefined,
                isDerived: attr.isDerivative,
                isMulti: attr.isMulti,
            });
        }

        tableDefs.set(tableName, {
            name: tableName,
            columns: cols,
            pkColumns: pkColumns,
            fkConstraints: fkConstraints,
            parentEntity: undefined,
            children: [],
        });
    }

    function addForeignKeyToEntity(targetId: string, referencedId: string) {
        const targetEntity = entityMap.get(targetId)!;
        const targetTable = tableDefs.get(targetEntity.name)!;
        const referencedPK = getEntityPK(referencedId);
        const referencedEntity = entityMap.get(referencedId)!;

        for (const pkCol of referencedPK) {
            // Verificar si la columna ya existe (puede ser que el target ya tenga un atributo con ese nombre)
            let col = targetTable.columns.find(c => c.name === pkCol);
            if (!col) {
                const refAttrs = attributesByParent.get(referencedId) || [];
                const attr = refAttrs.find(a => a.name === pkCol && a.isPrimaryKey);
                col = {
                    name: pkCol,
                    type: attr?.type,
                    isPK: false,
                    isFK: false,
                    refTable: undefined,
                    refColumn: undefined,
                    isDerived: false,
                    isMulti: false,
                };
                targetTable.columns.push(col);
            }
            col.isFK = true;
            col.refTable = referencedEntity.name;
            col.refColumn = pkCol;
            const exists = targetTable.fkConstraints.some(fk => fk.column === pkCol && fk.refTable === referencedEntity.name);
            if (!exists) {
                targetTable.fkConstraints.push({
                    column: pkCol,
                    refTable: referencedEntity.name,
                    refColumn: pkCol,
                });
            }
        }
    }

    for (const relation of relations) {
        if (relation.isWeak) continue;
        const entityIds = relation.entities.map(e => e.id);
        const hasAttributes = (attributesByParent.get(relation.id) || []).length > 0;
        const cardMap = new Map(relation.entities.map(e => [e.id, e.cardinality]));
        const isMany = (id: string) => cardMap.get(id) !== "1";

        if (entityIds.length === 2) {
            const [id1, id2] = entityIds;
            const many1 = isMany(id1);
            const many2 = isMany(id2);

            if ((many1 && many2) || hasAttributes) {
                createRelationTable(relation, entityIds);
            } else if (!many1 && many2) {
                addForeignKeyToEntity(id2, id1);
            } else if (many1 && !many2) {
                addForeignKeyToEntity(id1, id2);
            } else {
                // 1:1, elegimos id1 como lado que recibe FK
                addForeignKeyToEntity(id1, id2);
            }
        } else {
            createRelationTable(relation, entityIds);
        }
    }

    // 6. Formateo de salida
    let output = '';
    const sortedTableNames = Array.from(tableDefs.keys()).sort();

    for (const tableName of sortedTableNames) {
        const table = tableDefs.get(tableName)!;
        let header = `Table: ${tableName}`;
        if (table.parentEntity) {
            header += ` << ${table.parentEntity}`;
        }
        output += header + '\n';

        if (table.children && table.children.length > 0) {
            output += `  >> ${table.children.join(', ')}\n`;
        }

        const colStrings = table.columns.map(col => {
            let str = col.name;
            if (col.type) str += ` (${col.type})`;
            if (col.isPK) str += ' [PK]';
            if (col.isFK) str += ` [FK references ${col.refTable}(${col.refColumn})]`;
            if (col.isDerived) str += ' [Derived]';
            if (col.isMulti) str += ' [MV]';
            return str;
        });
        output += `  Columns: ${colStrings.join(', ')}\n`;

        output += `  Primary Key: (${table.pkColumns.join(', ') || 'none'})\n`;

        if (table.fkConstraints.length > 0) {
            const fkStrings = table.fkConstraints.map(
                fk => `${fk.column} references ${fk.refTable}(${fk.refColumn})`
            );
            output += `  Foreign Keys: ${fkStrings.join('; ')}\n`;
        } else {
            output += `  Foreign Keys: none\n`;
        }

        output += '\n';
    }

    return output;
}

export { convertToRelationalModel };

async function guardarComoTxt(relationalModel: string) {
    
    const filePath = await save({
        defaultPath: 'relationalModel.txt',
        filters: [{name: 'Texto', extensions: ['txt']}]
    });

    if(!filePath) return;

    await writeFile(filePath, new TextEncoder().encode(relationalModel));
    console.log('Modelo relacional guardado en: ', filePath);

}

const getType = (node: Node) => {

    if(node.properties.textAbove){
        const text = node.properties.textAbove as string;

        if(text.startsWith("(") && text.endsWith(")")) return text.substring(1, text.length - 1);
    } else if(node.properties.textBelow){
        const text = node.properties.textBelow as string;

        if(text.startsWith("(") && text.endsWith(")")) return text.substring(1, text.length - 1);
    } else if(node.properties.textLeft){
        const text = node.properties.textLeft as string;

        if(text.startsWith("(") && text.endsWith(")")) return text.substring(1, text.length - 1);
    } else if(node.properties.textRight){
        const text = node.properties.textRight as string;

        if(text.startsWith("(") && text.endsWith(")")) return text.substring(1, text.length - 1);
    }

    return undefined;
}

const optionalText = (conn: Connection, node: Node) => {

    if(conn.from !== node.id && conn.to != node.id) return null;

    let anchorPoint: string | undefined = undefined;

    if(conn.from === node.id){
        anchorPoint = conn.properties.fromPoint;
    } else {
        anchorPoint = conn.properties.toPoint;
    }

    if(anchorPoint){

        switch(anchorPoint){
            case "TOP":
                return node.properties.textAbove as string;
            case "BOTTOM":
                return node.properties.textBelow as string;
            case "LEFT":
                return node.properties.textLeft as string;
            case "RIGHT":
                return node.properties.textRight as string;
            default:
                return null;
        }

    }

    return null;
}

export async function generateMRFromER() {

    const toastID = showToast("Generating a relational model...", ToastType.PROCESSING);

    try {

        const updatedNodes = [...nodes];
        const updatedConnections = [...connections];

        const entities: Entity[] = [];
        const attributes: Attribute[] = []; 
        const relations: Relation[] = [];

        updatedNodes.forEach(node => {

            if(node.style < 2 || node.style > 3){

                const isParent = node.properties.disjointMembership || node.properties.overlappingMembership || node.properties.overlappingMembership;

                entities.push({
                    name: node.title || "Unnamed Entity",
                    isWeak: node.properties.doubleBorder,
                    isParent: isParent,
                    membership: !isParent? undefined: (node.properties.disjointMembership? Membership.DISJOINT : Membership.OVERLAPPING),
                    isSon: node.properties.isSon,
                    id: node.id
                });
            }

        });

        updatedNodes.forEach(node => {

            if(node.style === 3){

                relations.push({
                    name: node.title || "Unnamed Relation",
                    isWeak: node.properties.doubleBorder,
                    entities: [],
                    id: node.id
                });

            }

        });

        updatedNodes.forEach(node => {

            if(node.style === 2){

                attributes.push({
                    name: node.title || "Unnamed Attribute",
                    isDerivative: node.properties.dashedBorder,
                    isPrimaryKey: node.properties.underline,
                    isMulti: node.properties.doubleBorder,
                    type: getType(node),
                    id: node.id
                });

            }

        });

        const entitiesIds = () => entities.map(r => r.id);
        const attributesIds = () => attributes.map(r => r.id);
        const relationsIds = () => relations.map(r => r.id);


        updatedConnections.forEach(conn => {

            // Va de entidad a atributoo
            if(entitiesIds().includes(conn.from) && attributesIds().includes(conn.to)){

                const entity_ = entities.find(r => r.id === conn.from);
                const attr_ = attributes.find(a => a.id === conn.to);

                if(entity_ && attr_){
                    attr_.parent = entity_.id;
                }

            }

            // Va de atributo a entidad
            if(entitiesIds().includes(conn.to) && attributesIds().includes(conn.from)){

                const attr_ = attributes.find(a => a.id === conn.from);
                const entity_ = entities.find(r => r.id === conn.to);

                if(entity_ && attr_){
                    attr_.parent = entity_.id;
                }

            }

            // Va de atributo a relacion
            if(relationsIds().includes(conn.to) && attributesIds().includes(conn.from)){

                const relation_ = relations.find(r => r.id === conn.to);
                const attr_ = attributes.find(a => a.id === conn.from);

                if(relation_ && attr_){
                    attr_.parent = relation_.id;
                }

            }

            // Va de relacion a atributo
            if(relationsIds().includes(conn.from) && attributesIds().includes(conn.to)){

                const relation_ = relations.find(r => r.id === conn.from);
                const attr_ = attributes.find(a => a.id === conn.to);

                if(relation_ && attr_){
                    attr_.parent = relation_.id;
                }

            }

            // Va de entidad a entidad (Herencia)
            if(entitiesIds().includes(conn.from) && entitiesIds().includes(conn.to)){

                const entityFrom = entities.find(r => r.id === conn.from);
                const entityTo = entities.find(r => r.id === conn.to);

                if(entityFrom && entityTo){

                    if(entityFrom.isParent && entityTo.isSon){
                        entityTo.parent = entityFrom.id;
                    } else if(entityTo.isParent && entityFrom.isSon){
                        entityFrom.parent = entityTo.id;
                    }

                }

            }

            // Va de entidad a relacion
            if(entitiesIds().includes(conn.from) && relationsIds().includes(conn.to)){

                const entity_ = entities.find(a => a.id === conn.from);
                const relation_ = relations.find(r => r.id === conn.to);

                if(entity_ && relation_){

                    const relationNode = getNode(relation_.id);

                    if(relationNode){

                        const cardinality = optionalText(conn, relationNode);

                        relation_.entities.push({
                            id: entity_.id,
                            cardinality: cardinality?.trim() || "1"
                        });
                    }

                }

            }


            // va de relacion a entidad
            if(entitiesIds().includes(conn.to) && relationsIds().includes(conn.from)){

                const relation_ = relations.find(r => r.id === conn.from);
                const entity_ = entities.find(a => a.id === conn.to);

                if(entity_ && relation_){

                    const relationNode = getNode(relation_.id);

                    if(relationNode){

                        const cardinality = optionalText(conn, relationNode);

                        relation_.entities.push({
                            id: entity_.id,
                            cardinality: cardinality?.trim() || "1"
                        });
                    }

                }

            }


        });

        const relationalModel = convertToRelationalModel(entities, relations, attributes);

        await guardarComoTxt(relationalModel);

        if(toastID){
            removeToast(toastID);
        }

        showToast("Exported model", ToastType.SUCCES);
    } catch (error) {
        console.error("Error al exportar el modelo relacional: ", error);
        if(toastID){
            removeToast(toastID);
        }

        showToast("Export error", ToastType.ERROR);
    }
}