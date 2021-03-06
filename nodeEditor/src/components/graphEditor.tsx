import {
    DiagramEngine,
    DiagramModel,
    DiagramWidget,
    MoveCanvasAction
} from "storm-react-diagrams";

import * as React from "react";
import { GlobalState } from '../globalState';

import { GenericNodeFactory } from './diagram/generic/genericNodeFactory';
import { NodeMaterialBlockConnectionPointTypes } from 'babylonjs/Materials/Node/nodeMaterialBlockConnectionPointTypes';
import { GenericNodeModel } from './diagram/generic/genericNodeModel';
import { GenericPortModel } from './diagram/generic/genericPortModel';
import { Engine } from 'babylonjs/Engines/engine';
import { NodeMaterialBlock } from 'babylonjs/Materials/Node/nodeMaterialBlock';
import { NodeMaterialConnectionPoint } from 'babylonjs/Materials/Node/nodeMaterialBlockConnectionPoint';
import { Texture } from 'babylonjs/Materials/Textures/texture';
import { Vector2, Vector3, Vector4, Matrix } from 'babylonjs/Maths/math';
import { NodeListComponent } from './nodeList/nodeListComponent';
import { PropertyTabComponent } from './propertyTab/propertyTabComponent';

require("storm-react-diagrams/dist/style.min.css");
require("./main.scss");
require("./diagram/diagram.scss");

/*
Graph Editor Overview

Storm React setup:
GenericNodeModel - Represents the nodes in the graph and can be any node type (eg. texture, vector2, etc)
GenericNodeWidget - Renders the node model in the graph 
GenericPortModel - Represents the input/output of a node (contained within each GenericNodeModel)

Generating/modifying the graph:
Generating node graph - the createNodeFromObject method is used to recursively create the graph
Modifications to the graph - The listener in the constructor of GraphEditor listens for port changes and updates the node material based on changes
Saving the graph/generating code - Not yet done
*/

interface IGraphEditorProps {
    globalState: GlobalState;
}

export class GraphEditor extends React.Component<IGraphEditorProps> {
    private _engine: DiagramEngine;
    private _model: DiagramModel;

    private _nodes = new Array<GenericNodeModel>();

    /**
     * Current row/column position used when adding new nodes
     */
    private _rowPos = new Array<number>()

    /**
     * Creates a node and recursivly creates its parent nodes from it's input
     * @param nodeMaterialBlock 
     */
    public createNodeFromObject(
        options: {
            column: number,
            nodeMaterialBlock?: NodeMaterialBlock
        }
    ) {
        // Update rows/columns
        if (this._rowPos[options.column] == undefined) {
            this._rowPos[options.column] = 0;
        } else {
            this._rowPos[options.column]++;
        }

        // Create new node in the graph
        var outputNode = new GenericNodeModel();
        this._nodes.push(outputNode)
        outputNode.setPosition(1600 - (300 * options.column), 200 * this._rowPos[options.column])
        this._model.addAll(outputNode);

        if (options.nodeMaterialBlock) {
            outputNode.block = options.nodeMaterialBlock
            outputNode.headerLabels.push({ text: options.nodeMaterialBlock.getClassName() })

            // Create output ports
            options.nodeMaterialBlock._outputs.forEach((connection: any) => {
                var outputPort = new GenericPortModel(connection.name, "output");
                outputPort.syncWithNodeMaterialConnectionPoint(connection);
                outputNode.addPort(outputPort)
            })

            // Create input ports and nodes if they exist
            options.nodeMaterialBlock._inputs.forEach((connection) => {
                var inputPort = new GenericPortModel(connection.name, "input");
                inputPort.connection = connection;
                outputNode.addPort(inputPort)

                if (connection._connectedPoint) {
                    // Block is not a leaf node, create node for the given block type
                    var connectedNode;
                    var existingNodes = this._nodes.filter((n) => { return n.block == (connection as any)._connectedPoint._ownerBlock });
                    if (existingNodes.length == 0) {
                        connectedNode = this.createNodeFromObject({ column: options.column + 1, nodeMaterialBlock: connection._connectedPoint._ownerBlock });
                    } else {
                        connectedNode = existingNodes[0];
                    }

                    let link = connectedNode.ports[connection._connectedPoint.name].link(inputPort);
                    this._model.addAll(link);

                } else {
                    // Create value node for the connection
                    var type = ""
                    if (connection.type == NodeMaterialBlockConnectionPointTypes.Texture) {
                        type = "Texture"
                    } else if (connection.type == NodeMaterialBlockConnectionPointTypes.Matrix) {
                        type = "Matrix"
                    } else if (connection.type & NodeMaterialBlockConnectionPointTypes.Vector3OrColor3) {
                        type = "Vector3"
                    } else if (connection.type & NodeMaterialBlockConnectionPointTypes.Vector2) {
                        type = "Vector2"
                    } else if (connection.type & NodeMaterialBlockConnectionPointTypes.Vector3OrColor3OrVector4OrColor4) {
                        type = "Vector4"
                    }

                    // Create links
                    var localNode = this.addValueNode(type, options.column + 1, connection);
                    var ports = localNode.getPorts()
                    for (var key in ports) {
                        let link = (ports[key] as GenericPortModel).link(inputPort);
                        this._model.addAll(link);
                    }
                }
            })
        }

        return outputNode;
    }

    componentDidMount() {
        if (this.props.globalState.hostDocument) {
            var widget = (this.refs["test"] as DiagramWidget);
            widget.setState({ document: this.props.globalState.hostDocument })
            this.props.globalState.hostDocument!.addEventListener("keyup", widget.onKeyUpPointer as any, false);
        }
    }

    componentWillUnmount() {
        if (this.props.globalState.hostDocument) {
            var widget = (this.refs["test"] as DiagramWidget);
            this.props.globalState.hostDocument!.removeEventListener("keyup", widget.onKeyUpPointer as any, false);
        }
    }

    constructor(props: IGraphEditorProps) {
        super(props);

        // setup the diagram engine
        this._engine = new DiagramEngine();
        this._engine.installDefaultFactories()
        this._engine.registerNodeFactory(new GenericNodeFactory(this.props.globalState));

        // setup the diagram model
        this._model = new DiagramModel();

        // Listen to events to connect/disconnect blocks or
        this._model.addListener({
            linksUpdated: (e) => {
                if (!e.isCreated) {
                    // Link is deleted
                    console.log("link deleted");
                    var link = GenericPortModel.SortInputOutput(e.link.sourcePort as GenericPortModel, e.link.targetPort as GenericPortModel);
                    console.log(link)
                    if (link) {
                        if (link.output.connection && link.input.connection) {
                            // Disconnect standard nodes
                            console.log("disconnected " + link.output.connection.name + " from " + link.input.connection.name)
                            link.output.connection.disconnectFrom(link.input.connection)
                            link.input.syncWithNodeMaterialConnectionPoint(link.input.connection)
                            link.output.syncWithNodeMaterialConnectionPoint(link.output.connection)
                        } else if (link.input.connection && link.input.connection.value) {
                            console.log("value link removed");
                            link.input.connection.value = null;
                        } else {
                            console.log("invalid link error");
                        }
                    }
                } else {
                    console.log("link created")
                    console.log(e.link.sourcePort)
                }
                e.link.addListener({
                    sourcePortChanged: () => {
                        console.log("port change")
                    },
                    targetPortChanged: () => {
                        // Link is created with a target port
                        console.log("Link set to target")
                        var link = GenericPortModel.SortInputOutput(e.link.sourcePort as GenericPortModel, e.link.targetPort as GenericPortModel);

                        if (link) {
                            if (link.output.connection && link.input.connection) {
                                console.log("link standard blocks")
                                link.output.connection.connectTo(link.input.connection)
                            } else if (link.input.connection) {
                                console.log("link value to standard block")
                                link.input.connection.value = link.output.getValue();

                            }
                            if (this.props.globalState.nodeMaterial) {
                                this.props.globalState.nodeMaterial.build()
                            }
                        }
                    }

                })

            },
            nodesUpdated: (e) => {
                if (e.isCreated) {
                    console.log("new node")
                } else {
                    console.log("node deleted")
                }
            }
        })

        // Load graph of nodes from the material
        if (this.props.globalState.nodeMaterial) {
            var material: any = this.props.globalState.nodeMaterial;
            material._vertexOutputNodes.forEach((n: any) => {
                this.createNodeFromObject({ column: 0, nodeMaterialBlock: n });
            })
            material._fragmentOutputNodes.forEach((n: any) => {
                this.createNodeFromObject({ column: 0, nodeMaterialBlock: n });
            })
        }

        // Zoom out a bit at the start
        this._model.setZoomLevel(20)

        // load model into engine
        this._engine.setDiagramModel(this._model);
    }

    addNodeFromClass(ObjectClass: typeof NodeMaterialBlock) {
        var block = new ObjectClass(ObjectClass.prototype.getClassName() + "sdfsdf")
        var localNode = this.createNodeFromObject({ column: 0, nodeMaterialBlock: block })
        var widget = (this.refs["test"] as DiagramWidget);

        this.forceUpdate()

        // This is needed to fix link offsets when created, (eg. create a fog block)
        // Todo figure out how to correct this without this
        setTimeout(() => {
            widget.startFiringAction(new MoveCanvasAction(1, 0, this._model));
        }, 500);

        return localNode
    }

    addValueNode(type: string, column = 0, connection?: NodeMaterialConnectionPoint) {
        var localNode = this.createNodeFromObject({ column: column })
        var outPort = new GenericPortModel(type, "output");
        if (type == "Texture") {
            outPort.getValue = () => {
                return localNode.texture;
            }
            if (connection && connection.value) {
                localNode.texture = connection.value
            } else {
                localNode.texture = new Texture(null, Engine.LastCreatedScene)
            }
        } else if (type == "Vector2") {
            outPort.getValue = () => {
                return localNode.vector2;
            }
            if (connection && connection.value) {
                localNode.vector2 = connection.value
            } else {
                localNode.vector2 = new Vector2()
            }
        } else if (type == "Vector3") {
            outPort.getValue = () => {
                return localNode.vector3;
            }
            if (connection && connection.value) {
                localNode.vector3 = connection.value
            } else {
                localNode.vector3 = new Vector3()
            }
        } else if (type == "Vector4") {
            outPort.getValue = () => {
                return localNode.vector4;
            }
            if (connection && connection.value) {
                localNode.vector4 = connection.value
            } else {
                localNode.vector4 = new Vector4(0, 0, 0, 1)
            }
        } else if (type == "Matrix") {
            outPort.getValue = () => {
                return localNode.matrix;
            }
            if (connection && connection.value) {
                localNode.matrix = connection.value
            } else {
                localNode.matrix = new Matrix()
            }
        } else {
            console.log("Node type " + type + "is not supported")
        }
        localNode.addPort(outPort)
        this.forceUpdate()

        return localNode;
    }

    render() {
        return (
            <div id="node-editor-graph-root">
                {/* Node creation menu */}
                <NodeListComponent globalState={this.props.globalState} onAddValueNode={b => this.addValueNode(b)} onAddNodeFromClass={b => this.addNodeFromClass(b)} />

                {/* The node graph diagram */}
                <DiagramWidget deleteKeys={[46]} ref={"test"} inverseZoom={true} className="diagram-container" diagramEngine={this._engine} maxNumberPointsPerLink={0} />

                {/* Property tab */}
                <PropertyTabComponent globalState={this.props.globalState} />
            </div>
        );

    }
}