import React, { useState } from 'react';
import { 
  Folder, ChevronRight, ChevronDown, Layers, Inbox, 
  HelpCircle, Star, Sparkles, Building2, Briefcase, Cpu, Users
} from 'lucide-react';

export default function HierarchySidebar({
  hierarchyTree,
  selectedHierarchyId,
  onSelectHierarchy,
  totalEmailsCount,
  unreadCount
}) {
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleExpand = (nodeId, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Randare recursiva a arborelui ierarhic cu nivele nelimitate
  const renderTreeNodes = (nodes, depth = 1) => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes[node.id] !== false; // implicit desfacut
      const isSelected = selectedHierarchyId === String(node.id);

      return (
        <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            className={`tree-item ${isSelected ? 'active' : ''}`}
            style={{ paddingLeft: `${10 + (depth - 1) * 16}px` }}
            onClick={() => onSelectHierarchy(String(node.id))}
          >
            {hasChildren ? (
              <span
                onClick={(e) => toggleExpand(node.id, e)}
                style={{ cursor: 'pointer', marginRight: '4px', display: 'flex', alignItems: 'center' }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            ) : (
              <span style={{ width: '18px' }} />
            )}

            <span
              className="level-badge"
              style={{
                backgroundColor: `${node.color || '#3b82f6'}25`,
                color: node.color || '#93c5fd',
                border: `1px solid ${node.color || '#3b82f6'}50`
              }}
            >
              Nv.{node.level_depth}
            </span>

            <span className="tree-node-title" title={`${node.name} (${node.code || ''})`}>
              {node.name}
            </span>

            {node.total_emails > 0 && (
              <span className="tree-count-badge">
                {node.total_emails}
              </span>
            )}
          </div>

          {hasChildren && isExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <aside className="sidebar">
      {/* Filtre Rapide Generale */}
      <div className="sidebar-header">
        <h3>Navigare & Filtre</h3>
      </div>
      <div className="tree-list" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <div
          className={`tree-item ${selectedHierarchyId === '' ? 'active' : ''}`}
          onClick={() => onSelectHierarchy('')}
        >
          <Inbox size={16} style={{ marginRight: '8px', color: '#60a5fa' }} />
          <span className="tree-node-title">Toate E-mailurile</span>
          <span className="tree-count-badge">{totalEmailsCount}</span>
        </div>

        <div
          className={`tree-item ${selectedHierarchyId === 'unassigned' ? 'active' : ''}`}
          onClick={() => onSelectHierarchy('unassigned')}
        >
          <HelpCircle size={16} style={{ marginRight: '8px', color: '#f59e0b' }} />
          <span className="tree-node-title">Neclasificate în Ierarhie</span>
        </div>

        <div
          className={`tree-item ${selectedHierarchyId === 'flagged' ? 'active' : ''}`}
          onClick={() => onSelectHierarchy('flagged')}
        >
          <Star size={16} style={{ marginRight: '8px', color: '#ec4899' }} />
          <span className="tree-node-title">Mesaje Importante / Marcate</span>
        </div>
      </div>

      {/* Structura Ierarhica Arbore */}
      <div className="sidebar-header">
        <h3>Structuri Ierarhice (Nivele)</h3>
      </div>
      <div className="tree-list">
        {hierarchyTree && hierarchyTree.length > 0 ? (
          renderTreeNodes(hierarchyTree, 1)
        ) : (
          <div style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Nicio structură definită. Puteți defini structuri pe oricâte nivele din Panoul de Administrare.
          </div>
        )}
      </div>
    </aside>
  );
}
