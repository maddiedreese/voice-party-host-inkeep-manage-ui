'use client';

import {
  Background,
  type Connection,
  ConnectionMode,
  Controls,
  type Edge,
  type IsValidConnection,
  type Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useOnSelectionChange,
  useReactFlow,
} from '@xyflow/react';
import { nanoid } from 'nanoid';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { commandManager } from '@/features/graph/commands/command-manager';
import { AddNodeCommand, AddPreparedEdgeCommand } from '@/features/graph/commands/commands';
import {
  deserializeGraphData,
  type ExtendedFullGraphDefinition,
  extractGraphMetadata,
  serializeGraphData,
} from '@/features/graph/domain';
import { useGraphStore } from '@/features/graph/state/use-graph-store';
import { useGraphShortcuts } from '@/features/graph/ui/use-graph-shortcuts';
import { useGraphErrors } from '@/hooks/use-graph-errors';
import { useSidePane } from '@/hooks/use-side-pane';
import type { ArtifactComponent } from '@/lib/api/artifact-components';
import type { Credential } from '@/lib/api/credentials';
import type { DataComponent } from '@/lib/api/data-components';
import { saveGraph } from '@/lib/services/save-graph';
import type { MCPTool } from '@/lib/types/tools';
import { getErrorSummaryMessage, parseGraphValidationErrors } from '@/lib/utils/graph-error-parser';
import { getToolTypeAndName } from '@/lib/utils/mcp-utils';
import { detectOrphanedToolsAndGetWarning } from '@/lib/utils/orphaned-tools-detector';

// Type for agent tool configuration lookup including both selection and headers
export type AgentToolConfig = {
  toolId: string;
  toolSelection?: string[];
  headers?: Record<string, string>;
};

// AgentToolConfigLookup: agentId -> relationshipId -> config
export type AgentToolConfigLookup = Record<string, Record<string, AgentToolConfig>>;

import { EdgeType, edgeTypes, initialEdges } from './configuration/edge-types';
import {
  agentNodeSourceHandleId,
  agentNodeTargetHandleId,
  externalAgentNodeTargetHandleId,
  type MCPNodeData,
  mcpNodeHandleId,
  NodeType,
  newNodeDefaults,
  nodeTypes,
} from './configuration/node-types';
import { GraphErrorSummary } from './error-display/graph-error-summary';
import { DefaultMarker } from './markers/default-marker';
import { SelectedMarker } from './markers/selected-marker';
import NodeLibrary from './node-library/node-library';
import { Playground } from './playground/playground';
import { SidePane } from './sidepane/sidepane';
import { Toolbar } from './toolbar/toolbar';

function getEdgeId(a: string, b: string) {
  const [low, high] = [a, b].sort();
  return `edge-${low}-${high}`;
}

interface GraphProps {
  graph?: ExtendedFullGraphDefinition;
  dataComponentLookup?: Record<string, DataComponent>;
  artifactComponentLookup?: Record<string, ArtifactComponent>;
  toolLookup?: Record<string, MCPTool>;
  credentialLookup?: Record<string, Credential>;
}

function Flow({
  graph,
  dataComponentLookup = {},
  artifactComponentLookup = {},
  toolLookup = {},
  credentialLookup = {},
}: GraphProps) {
  const [showPlayground, setShowPlayground] = useState(false);
  const router = useRouter();

  const { tenantId, projectId } = useParams<{
    tenantId: string;
    projectId: string;
  }>();

  const initialNodes = useMemo<Node[]>(
    () => [
      {
        id: nanoid(),
        type: NodeType.Agent,
        position: { x: 0, y: 0 },
        data: { name: '', isDefault: true },
        deletable: false,
      },
    ],
    []
  );

  // Helper to enrich MCP nodes with tool data
  const enrichNodes = useCallback(
    (nodes: Node[]): Node[] => {
      return nodes.map((node) => {
        if (node.type === NodeType.MCP && node.data && 'toolId' in node.data) {
          const tool = toolLookup[node.data.toolId as string];
          if (tool) {
            let provider = null;
            provider = getToolTypeAndName(tool).type;

            return {
              ...node,
              data: {
                ...node.data,
                name: tool.name,
                imageUrl: tool.imageUrl,
                provider,
              },
            };
          }
        }
        return node;
      });
    },
    [toolLookup]
  );

  const { nodes: graphNodes, edges: graphEdges } = useMemo(() => {
    const result = graph
      ? deserializeGraphData(graph)
      : { nodes: initialNodes, edges: initialEdges };
    return {
      ...result,
      nodes: enrichNodes(result.nodes),
    };
  }, [graph, enrichNodes, initialNodes]);

  // Create agent tool configuration lookup from graph data
  const agentToolConfigLookup = useMemo((): AgentToolConfigLookup => {
    if (!graph?.agents) return {} as AgentToolConfigLookup;

    const lookup: AgentToolConfigLookup = {};
    Object.entries(graph.agents).forEach(([agentId, agentData]) => {
      if ('canUse' in agentData && agentData.canUse) {
        const toolsMap: Record<string, AgentToolConfig> = {};
        agentData.canUse.forEach((tool) => {
          if (tool.agentToolRelationId) {
            const config: AgentToolConfig = {
              toolId: tool.toolId,
            };

            if (tool.toolSelection) {
              config.toolSelection = tool.toolSelection;
            }

            if (tool.headers) {
              config.headers = tool.headers;
            }

            toolsMap[tool.agentToolRelationId] = config;
          }
        });
        if (Object.keys(toolsMap).length > 0) {
          lookup[agentId] = toolsMap;
        }
      }
    });
    return lookup;
  }, [graph?.agents]);

  const { screenToFlowPosition, updateNodeData, fitView } = useReactFlow();
  const {
    nodes: storeNodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    metadata,
    setMetadata,
    setInitial,
    markSaved,
    clearSelection,
    markUnsaved,
  } = useGraphStore();

  // Always use enriched nodes for ReactFlow
  const nodes = useMemo(() => enrichNodes(storeNodes), [storeNodes, enrichNodes]);
  const { nodeId, edgeId, setQueryState, openGraphPane, isOpen } = useSidePane();
  const { errors, showErrors, setErrors, clearErrors, setShowErrors } = useGraphErrors();

  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to run this effect on first render
  useEffect(() => {
    setInitial(
      graphNodes,
      graphEdges,
      extractGraphMetadata(graph),
      dataComponentLookup,
      artifactComponentLookup,
      toolLookup,
      agentToolConfigLookup
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to run this effect on first render
  useEffect(() => {
    if (!graph) {
      openGraphPane();
      return;
    }

    if (!nodeId && !edgeId) {
      openGraphPane();
    }

    if (nodeId) {
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          selected: node.id === nodeId,
        }))
      );
    }

    if (edgeId) {
      setEdges((edges) =>
        edges.map((edge) => ({
          ...edge,
          selected: edge.id === edgeId,
        }))
      );
    }

    // If the nodeId or edgeId in URL doesn't exist in the graph, clear it
    if (nodeId && !graphNodes.some((node) => node.id === nodeId)) {
      setQueryState((prev) => ({
        ...prev,
        nodeId: null,
        pane: 'graph',
      }));
    }
    if (edgeId && !graphEdges.some((edge) => edge.id === edgeId)) {
      setQueryState((prev) => ({
        ...prev,
        edgeId: null,
        pane: 'graph',
      }));
    }
  }, []);

  // Auto-center graph when sidepane opens/closes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to trigger on isOpen changes
  useEffect(() => {
    // Delay to allow CSS transition to complete (300ms transition + 50ms buffer)
    const timer = setTimeout(() => {
      fitView({ maxZoom: 1, duration: 200 });
    }, 350);

    return () => clearTimeout(timer);
  }, [isOpen, fitView]);

  // Auto-center graph when playground opens/closes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to trigger on showPlayground changes
  useEffect(() => {
    // Delay to allow CSS transition to complete
    const timer = setTimeout(() => {
      fitView({ maxZoom: 1, duration: 200 });
    }, 350);

    return () => clearTimeout(timer);
  }, [showPlayground, fitView]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to add/connect edges once
  const onConnectWrapped = useCallback((params: Connection) => {
    markUnsaved();
    const isSelfLoop = params.source === params.target;
    const id = isSelfLoop ? `edge-self-${params.source}` : getEdgeId(params.source, params.target);
    let newEdge: Edge = { id, ...params };
    const { sourceHandle, targetHandle } = params;

    // Check for self-loop
    if (isSelfLoop) {
      newEdge = {
        ...newEdge,
        type: EdgeType.SelfLoop,
        selected: true,
        data: {
          relationships: {
            transferTargetToSource: false,
            transferSourceToTarget: true,
            delegateTargetToSource: false,
            delegateSourceToTarget: false,
          },
        },
      };
    } else if (
      (sourceHandle === agentNodeSourceHandleId || sourceHandle === agentNodeTargetHandleId) &&
      (targetHandle === agentNodeTargetHandleId || targetHandle === agentNodeSourceHandleId)
    ) {
      newEdge = {
        ...newEdge,
        type: EdgeType.A2A,
        selected: true,
        data: {
          relationships: {
            transferTargetToSource: false,
            transferSourceToTarget: true,
            delegateTargetToSource: false,
            delegateSourceToTarget: false,
          },
        },
      };
    } else if (
      (sourceHandle === agentNodeSourceHandleId || sourceHandle === agentNodeTargetHandleId) &&
      targetHandle === externalAgentNodeTargetHandleId
    ) {
      newEdge = {
        ...newEdge,
        type: EdgeType.A2AExternal,
        data: {
          relationships: {
            transferTargetToSource: false,
            transferSourceToTarget: false,
            delegateTargetToSource: false,
            delegateSourceToTarget: true, // this is the only valid option for external agents to connect to internal agents
          },
        },
      };
    }

    // Update MCP node agentId when connecting agent to MCP tool
    if (
      targetHandle === mcpNodeHandleId &&
      (sourceHandle === agentNodeSourceHandleId || sourceHandle === agentNodeTargetHandleId)
    ) {
      const targetNode = nodes.find((n) => n.id === params.target);
      if (targetNode && targetNode.type === NodeType.MCP) {
        const agentId = params.source;
        updateNodeData(targetNode.id, {
          ...targetNode.data,
          agentId,
          relationshipId: null, // Will be set after saving to database
        });
      }
    }

    requestAnimationFrame(() => {
      commandManager.execute(
        new AddPreparedEdgeCommand(newEdge, { deselectOtherEdgesIfA2A: true })
      );
    });
  }, []);

  const isValidConnection: IsValidConnection = useCallback(({ sourceHandle, targetHandle }) => {
    // we don't want to allow connections between MCP nodes
    if (sourceHandle === mcpNodeHandleId && targetHandle === mcpNodeHandleId) {
      return false;
    }
    return true;
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const node = event.dataTransfer.getData('application/reactflow');
      if (!node) {
        return;
      }
      const nodeData = JSON.parse(node);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const nodeId = nanoid();
      const newNode = {
        id: nodeId,
        type: nodeData.type,
        position,
        selected: true,
        data: {
          ...newNodeDefaults[nodeData.type as keyof typeof newNodeDefaults],
        },
      };

      clearSelection();
      commandManager.execute(new AddNodeCommand(newNode as Node));
    },
    [screenToFlowPosition, clearSelection]
  );

  const onSelectionChange = useCallback(
    ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      const node = nodes.length === 1 ? nodes[0] : null;
      const edge =
        edges.length === 1 &&
        (edges[0]?.type === EdgeType.A2A || edges[0]?.type === EdgeType.SelfLoop)
          ? edges[0]
          : null;
      const defaultPane = isOpen ? 'graph' : null;

      setQueryState(
        {
          pane: node ? 'node' : edge ? 'edge' : defaultPane,
          nodeId: node ? node.id : null,
          edgeId: edge ? edge.id : null,
        },
        { history: 'replace' }
      );
    },
    [setQueryState, isOpen]
  );

  useOnSelectionChange({
    onChange: onSelectionChange,
  });

  useGraphShortcuts();

  const closeSidePane = useCallback(() => {
    setEdges((edges) => edges.map((edge) => ({ ...edge, selected: false })));
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: false })));
    setQueryState({
      pane: null,
      nodeId: null,
      edgeId: null,
    });
  }, [setQueryState, setEdges, setNodes]);

  const backToGraph = useCallback(() => {
    setEdges((edges) => edges.map((edge) => ({ ...edge, selected: false })));
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: false })));
    setQueryState({
      pane: 'graph',
      nodeId: null,
      edgeId: null,
    });
  }, [setQueryState, setEdges, setNodes]);

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      // The nodeId parameter is actually the agent ID from error parsing
      // We need to find the React Flow node that has this agent ID
      const targetNode = nodes.find(
        (node) =>
          node.id === nodeId || // Direct match (no custom ID set)
          (node.data as any)?.id === nodeId // Custom agent ID match
      );

      if (targetNode) {
        // Clear selection and select the target node
        setNodes((nodes) =>
          nodes.map((node) => ({
            ...node,
            selected: node.id === targetNode.id,
          }))
        );
        setEdges((edges) => edges.map((edge) => ({ ...edge, selected: false })));

        // Open the sidepane for the selected node
        setQueryState({
          pane: 'node',
          nodeId: targetNode.id,
          edgeId: null,
        });
      }
    },
    [setNodes, setEdges, nodes, setQueryState]
  );

  const handleNavigateToEdge = useCallback(
    (edgeId: string) => {
      // The edgeId parameter is from error parsing
      // We need to find the React Flow edge that has this ID
      const targetEdge = edges.find((edge) => edge.id === edgeId);

      if (targetEdge) {
        // Clear selection and select the target edge
        setEdges((edges) =>
          edges.map((edge) => ({
            ...edge,
            selected: edge.id === targetEdge.id,
          }))
        );
        setNodes((nodes) => nodes.map((node) => ({ ...node, selected: false })));

        // Open the sidepane for the selected edge
        setQueryState({
          pane: 'edge',
          nodeId: null,
          edgeId: targetEdge.id,
        });
      }
    },
    [setEdges, setNodes, edges, setQueryState]
  );

  const onSubmit = useCallback(async () => {
    // Check for orphaned tools before saving
    const warningMessage = detectOrphanedToolsAndGetWarning(
      nodes,
      agentToolConfigLookup,
      toolLookup
    );

    if (warningMessage) {
      toast.warning(warningMessage, {
        closeButton: true,
        duration: 6000,
      });
    }

    const serializedData = serializeGraphData(
      nodes,
      edges,
      metadata,
      dataComponentLookup,
      artifactComponentLookup,
      agentToolConfigLookup
    );

    const res = await saveGraph(
      tenantId,
      projectId,
      serializedData,
      graph?.id // graphid is required and added to the serialized data if it does not exist so we need to pass is separately to know whether to create or update
    );

    if (res.success) {
      // Clear any existing errors on successful save
      clearErrors();
      toast.success('Graph saved', {
        closeButton: true,
      });
      markSaved();

      // Update MCP nodes with new relationshipIds from backend response
      if (res.data) {
        // Create a map to track which relationships were processed
        const processedRelationships = new Set<string>();

        // Update nodes with the new relationshipIds
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type === NodeType.MCP) {
              const mcpNode = node as Node & { data: MCPNodeData };
              if (mcpNode.data.agentId && mcpNode.data.toolId) {
                // If node already has a relationshipId, keep it (it's an existing relationship)
                if (mcpNode.data.relationshipId) {
                  return node;
                }

                // For new nodes (relationshipId is null), find the first unprocessed relationship
                // that matches this agent and tool
                const agentId = mcpNode.data.agentId;
                const toolId = mcpNode.data.toolId;

                if ('canUse' in res.data.agents[agentId] && res.data.agents[agentId].canUse) {
                  const matchingRelationship = res.data.agents[agentId].canUse.find(
                    (tool: any) =>
                      tool.toolId === toolId &&
                      tool.agentToolRelationId &&
                      !processedRelationships.has(tool.agentToolRelationId)
                  );

                  if (matchingRelationship?.agentToolRelationId) {
                    processedRelationships.add(matchingRelationship.agentToolRelationId);
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        relationshipId: matchingRelationship.agentToolRelationId,
                      },
                    };
                  }
                }
              }
            }
            return node;
          })
        );
      }

      if (!graph?.id && res.data?.id) {
        setMetadata('id', res.data.id);
        router.push(`/${tenantId}/projects/${projectId}/graphs/${res.data.id}`);
      }
    } else {
      try {
        const errorSummary = parseGraphValidationErrors(res.error);
        setErrors(errorSummary);

        const summaryMessage = getErrorSummaryMessage(errorSummary);
        toast.error(summaryMessage || 'Failed to save graph - validation errors found');
      } catch (parseError) {
        // Fallback for unparseable errors
        console.error('Failed to parse validation errors:', parseError);
        toast.error('Failed to save graph', {
          closeButton: true,
        });
      }
    }
  }, [
    nodes,
    edges,
    metadata,
    dataComponentLookup,
    artifactComponentLookup,
    markSaved,
    setMetadata,
    setNodes,
    router,
    graph?.id,
    tenantId,
    projectId,
    clearErrors,
    setErrors,
    agentToolConfigLookup,
    toolLookup,
  ]);

  return (
    <div className="w-full h-full relative bg-muted/20 dark:bg-background flex rounded-b-[14px] overflow-hidden">
      <div className={`flex-1 h-full relative transition-all duration-300 ease-in-out`}>
        <DefaultMarker />
        <SelectedMarker />
        <ReactFlow
          defaultEdgeOptions={{
            type: 'default',
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnectWrapped}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          fitViewOptions={{
            maxZoom: 1,
          }}
          connectionMode={ConnectionMode.Loose}
          isValidConnection={isValidConnection}
        >
          <Background color="#a8a29e" gap={20} />
          <Controls className="text-foreground" showInteractive={false} />
          <Panel position="top-left">
            <NodeLibrary />
          </Panel>
          <Panel position="top-right">
            <Toolbar
              onSubmit={onSubmit}
              isPreviewDisabled={!graph?.id}
              toggleSidePane={isOpen ? backToGraph : openGraphPane}
              setShowPlayground={() => {
                closeSidePane();
                setShowPlayground(true);
              }}
            />
          </Panel>
          {errors && showErrors && (
            <Panel position="bottom-left" className="max-w-sm !left-8 mb-4">
              <GraphErrorSummary
                errorSummary={errors}
                onClose={() => setShowErrors(false)}
                onNavigateToNode={handleNavigateToNode}
                onNavigateToEdge={handleNavigateToEdge}
              />
            </Panel>
          )}
        </ReactFlow>
      </div>
      <SidePane
        selectedNodeId={nodeId}
        selectedEdgeId={edgeId}
        isOpen={isOpen}
        onClose={closeSidePane}
        backToGraph={backToGraph}
        dataComponentLookup={dataComponentLookup}
        artifactComponentLookup={artifactComponentLookup}
        agentToolConfigLookup={agentToolConfigLookup}
        credentialLookup={credentialLookup}
      />
      {showPlayground && graph?.id && (
        <Playground
          graphId={graph?.id}
          projectId={projectId}
          tenantId={tenantId}
          setShowPlayground={setShowPlayground}
          closeSidePane={closeSidePane}
        />
      )}
    </div>
  );
}

export function Graph({
  graph,
  dataComponentLookup,
  artifactComponentLookup,
  toolLookup,
  credentialLookup,
}: GraphProps) {
  return (
    <ReactFlowProvider>
      <Flow
        graph={graph}
        dataComponentLookup={dataComponentLookup}
        artifactComponentLookup={artifactComponentLookup}
        toolLookup={toolLookup}
        credentialLookup={credentialLookup}
      />
    </ReactFlowProvider>
  );
}
