import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { scaleOrdinal } from 'd3-scale';
import { schemeSet3 } from 'd3-scale-chromatic';

const calculateJaccardSimilarity = (text1, text2) => {
    const set1 = new Set(text1.toLowerCase().split(/\W+/));
    const set2 = new Set(text2.toLowerCase().split(/\W+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
};

const AnalysisGraph = ({ analysis }) => {
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedNodeLinks, setSelectedNodeLinks] = useState([]);
    const SIMILARITY_THRESHOLD = 0.1;
    const NODE_SIZE = 12;
    const TEXT_SIZE = 3;
    const EDGE_TEXT_SIZE = 2;
    const GLOW_STRENGTH = 35; // Increased glow strength
    const HIGHLIGHT_WIDTH_MULTIPLIER = 5; // Increased highlight width

    // Add responsive sizing
    const [dimensions, setDimensions] = useState({
        width: 500,
        height: 500
    });

    useEffect(() => {
        const updateDimensions = () => {
            const container = document.querySelector('.graph-container');
            if (container) {
                const width = container.clientWidth;
                const height = container.clientHeight;
                setDimensions({
                    width: width,
                    height: height
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Add to existing useEffect
    useEffect(() => {
        const container = document.querySelector('.graph-container');
        if (container) {
            container.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    e.preventDefault(); // Prevent default only for single touch
                }
            }, { passive: false });
        }
    }, []);

    const { nodes, links, topPairs } = useMemo(() => {
        if (!analysis) return { nodes: [], links: [], topPairs: [] };

        const colorScale = scaleOrdinal(schemeSet3);
        
        const nodes = Object.entries(analysis).map(([key, value], index) => ({
            id: key,
            name: key,
            val: NODE_SIZE,
            color: colorScale(index),
            text: value.Analysis || (value.Comments ? value.Comments.join(' ') : '')
        }));

        const links = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const similarity = calculateJaccardSimilarity(nodes[i].text, nodes[j].text);
                if (similarity > SIMILARITY_THRESHOLD) {
                    links.push({
                        source: nodes[i].id,
                        target: nodes[j].id,
                        value: similarity,
                        width: similarity * 2,
                        highlighted: false
                    });
                }
            }
        }

        // Calculate top pairs
        const sortedLinks = [...links].sort((a, b) => b.value - a.value);
        const topThree = sortedLinks.slice(0, 3);

        return { nodes, links, topPairs: topThree };
    }, [analysis]);

    const handleNodeClick = useCallback((node, event) => {
        // Stop event propagation
        if (event) event.stopPropagation();
        
        if (selectedNode?.id === node.id) {
            // Deselect current node
            setSelectedNode(null);
            setSelectedNodeLinks([]);
            
            // Reset all links
            links.forEach(link => {
                link.highlighted = false;
                link.width = link.value * 2;
            });
        } else {
            // Select new node
            setSelectedNode(node);
            
            // Find connected links
            const connectedLinks = links.filter(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                return sourceId === node.id || targetId === node.id;
            });
            
            // Sort connected links by strength
            const sortedLinks = connectedLinks.map(link => ({
                source: typeof link.source === 'object' ? link.source.id : link.source,
                target: typeof link.target === 'object' ? link.target.id : link.target,
                value: link.value
            })).sort((a, b) => b.value - a.value);

            setSelectedNodeLinks(sortedLinks);
            
            // Update link visibility
            links.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const isConnected = sourceId === node.id || targetId === node.id;
                
                link.highlighted = isConnected;
                link.width = isConnected ? link.value * HIGHLIGHT_WIDTH_MULTIPLIER : link.value * 2;
            });
        }
    }, [selectedNode, links]);

    if (!analysis) return null;

    return (
        <div className="analysis-graph-section">
            <div className="graph-container">
                <ForceGraph2D
                    graphData={{ nodes, links }}
                    width={dimensions.width}
                    height={dimensions.height}
                    nodeRelSize={NODE_SIZE}
                    linkWidth={link => link.width}
                    linkColor={link => link.highlighted ? '#2ecc71' : '#95a5a6'}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                        const x = node.x || 0;
                        const y = node.y || 0;
                        const radius = node.val * 0.5;

                        // Draw node circle with glow if selected
                        ctx.beginPath();
                        if (selectedNode?.id === node.id) {
                            ctx.shadowColor = node.color;
                            ctx.shadowBlur = GLOW_STRENGTH;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 0;
                        }
                        ctx.fillStyle = node.color;
                        ctx.arc(x, y, radius, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        // Always draw node label
                        const label = node.name;
                        ctx.font = `${EDGE_TEXT_SIZE}px Arial`;
                        ctx.fillStyle = '#2c3e50';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(label, x, y);
                    }}
                    nodePointerAreaPaint={(node, color, ctx) => {
                        // Define clickable area that moves with the node
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, node.val * 0.5, 0, 2 * Math.PI);
                        ctx.fill();
                    }}
                    onNodeClick={handleNodeClick}
                    d3VelocityDecay={0.3}
                    cooldownTime={2000}
                    enableNodeDrag={true}
                    enableZoom={true}
                    enablePanInteraction={true}
                    minZoom={0.5}
                    maxZoom={2}
                />
            </div>
            
            <div className="top-pairs-analysis">
                <h4>Relationship Strengths</h4>
                {selectedNode ? (
                    <div>
                        <h5>Connections for {selectedNode.id}</h5>
                        <ul>
                            {selectedNodeLinks.map((link, index) => (
                                <li key={index}>
                                    {link.source === selectedNode.id ? link.target : link.source}:
                                    {' '}{(link.value * 100).toFixed(1)}% similarity
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p>Click a node to see its relationships</p>
                )}
            </div>
        </div>
    );
};

export default AnalysisGraph;