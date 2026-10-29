import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Search,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  MoreVertical,
  Edit3,
  Trash2,
  FolderInput,
  Check,
  X,
  Layers,
  Database,
  Ghost
} from 'lucide-react';

export default function Sidebar({
  isOpen,
  onToggleOpen,
  conversations = [],
  groups = [],
  activeConversationId,
  isTemporaryMode = false,
  onStartTemporaryChat,
  onExitTemporaryChat,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onMoveConversation,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onToggleGroupExpand,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingConvTitle, setEditingConvTitle] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Active contextual menu states
  const [activeMenuConvId, setActiveMenuConvId] = useState(null);
  const [activeMenuGroupId, setActiveMenuGroupId] = useState(null);
  const [movingConversation, setMovingConversation] = useState(null); // conv object
  const [moveModalNewGroupName, setMoveModalNewGroupName] = useState('');
  const [isCreatingGroupInMove, setIsCreatingGroupInMove] = useState(false);

  const searchInputRef = useRef(null);
  const editInputRef = useRef(null);
  const groupInputRef = useRef(null);

  // Focus rename input on start
  useEffect(() => {
    if (editingConvId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingConvId]);

  // Focus new group input on open
  useEffect(() => {
    if (isCreatingGroup && groupInputRef.current) {
      groupInputRef.current.focus();
    }
  }, [isCreatingGroup]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.context-menu-container') && !e.target.closest('.context-menu-btn')) {
        setActiveMenuConvId(null);
        setActiveMenuGroupId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    (c.title || 'Untitled Chat').toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Separate conversations into grouped vs ungrouped
  const groupedConvsMap = {};
  groups.forEach((g) => {
    groupedConvsMap[g.id] = [];
  });

  const ungroupedConvs = [];

  filteredConversations.forEach((conv) => {
    if (conv.group_id && groupedConvsMap[conv.group_id]) {
      groupedConvsMap[conv.group_id].push(conv);
    } else {
      ungroupedConvs.push(conv);
    }
  });

  // Handlers for conversation rename
  const handleStartRenameConv = (conv, e) => {
    e?.stopPropagation();
    setEditingConvId(conv.id);
    setEditingConvTitle(conv.title || '');
    setActiveMenuConvId(null);
  };

  const handleSaveConvRename = (convId) => {
    if (editingConvTitle.trim()) {
      onRenameConversation(convId, editingConvTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleKeyDownConvRename = (e, convId) => {
    if (e.key === 'Enter') {
      handleSaveConvRename(convId);
    } else if (e.key === 'Escape') {
      setEditingConvId(null);
    }
  };

  // Handlers for group rename
  const handleStartRenameGroup = (group, e) => {
    e?.stopPropagation();
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setActiveMenuGroupId(null);
  };

  const handleSaveGroupRename = (groupId) => {
    if (editingGroupName.trim()) {
      onRenameGroup(groupId, editingGroupName.trim());
    }
    setEditingGroupId(null);
  };

  const handleCreateGroupSubmit = (e) => {
    e?.preventDefault();
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim());
      setNewGroupName('');
      setIsCreatingGroup(false);
    }
  };

  // Helper to open move modal
  const handleOpenMoveModal = (conv, e) => {
    e?.stopPropagation();
    setMovingConversation(conv);
    setActiveMenuConvId(null);
    setIsCreatingGroupInMove(false);
    setMoveModalNewGroupName('');
  };

  const handleConfirmMove = (targetGroupId) => {
    if (movingConversation) {
      onMoveConversation(movingConversation.id, targetGroupId);
      setMovingConversation(null);
    }
  };

  const handleCreateAndMove = async (e) => {
    e?.preventDefault();
    if (moveModalNewGroupName.trim() && movingConversation) {
      const newGroup = await onCreateGroup(moveModalNewGroupName.trim());
      if (newGroup && newGroup.id) {
        onMoveConversation(movingConversation.id, newGroup.id);
      }
      setMovingConversation(null);
    }
  };

  // Collapsed rail mode view
  if (!isOpen) {
    return (
      <aside className="w-14 flex-shrink-0 bg-[#0C0C0E] border-r border-white/[0.08] flex flex-col items-center py-3 z-30 select-none transition-all duration-200">
        {/* Toggle open button */}
        <button
          onClick={onToggleOpen}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all mb-4"
          title="Expand navigation sidebar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>

        {/* New Chat Icon Button */}
        <button
          onClick={() => onNewChat()}
          className="w-10 h-10 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 flex items-center justify-center transition-all shadow-sm mb-2.5 group relative"
          title="New Conversation"
        >
          <Plus className="w-5 h-5" />
          <span className="absolute left-14 ml-1 px-2 py-1 rounded-md bg-[#18181B] border border-white/10 text-xs text-white opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 shadow-lg">
            New Chat
          </span>
        </button>

        {/* Temporary Chat Icon Button */}
        <button
          onClick={() => onStartTemporaryChat()}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm mb-3 group relative border ${
            isTemporaryMode
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-zinc-400 hover:text-amber-300 hover:border-amber-500/30'
          }`}
          title="Temporary Chat (Not saved to database)"
        >
          <Ghost className="w-5 h-5" />
          <span className="absolute left-14 ml-1 px-2 py-1 rounded-md bg-[#18181B] border border-white/10 text-xs text-white opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 shadow-lg">
            {isTemporaryMode ? 'Temporary Chat (Active)' : 'Temporary Chat'}
          </span>
        </button>

        {/* Search quick button */}
        <button
          onClick={() => {
            onToggleOpen();
            setTimeout(() => searchInputRef.current?.focus(), 150);
          }}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all mb-4 group relative"
          title="Search conversations"
        >
          <Search className="w-4 h-4" />
          <span className="absolute left-14 ml-1 px-2 py-1 rounded-md bg-[#18181B] border border-white/10 text-xs text-white opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 shadow-lg">
            Search
          </span>
        </button>

        {/* Mini conversation icons indicator */}
        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center space-y-2 px-1">
          {conversations.slice(0, 8).map((conv) => {
            const isActive = !isTemporaryMode && conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative group ${
                  isActive
                    ? 'bg-white/15 text-white ring-1 ring-white/20'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                }`}
                title={conv.title}
              >
                <MessageSquare className="w-4 h-4" />
                {isActive && (
                  <span className="absolute -left-1 top-2.5 w-1 h-4 bg-indigo-500 rounded-r-full" />
                )}
                <span className="absolute left-14 ml-1 px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-white/10 text-xs text-white opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 shadow-xl max-w-xs truncate">
                  {conv.title}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  // Expanded full sidebar view (matching the reference image layout)
  return (
    <aside className="w-64 md:w-72 flex-shrink-0 bg-[#0C0C0E] border-r border-white/[0.08] flex flex-col h-full z-30 select-none transition-all duration-200">
      {/* Top Header: Workspace Switcher & Collapse Button */}
      <div className="p-3 pb-2 flex items-center justify-between border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 cursor-pointer text-left flex-1 min-w-0 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate tracking-tight">
              Local AI Workspace
            </div>
            <div className="text-[10px] text-zinc-400 truncate">
              SQLite WAL • Ollama
            </div>
          </div>
        </div>

        <button
          onClick={onToggleOpen}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all ml-1 flex-shrink-0"
          title="Fold to icon rail"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Top Action Items: Search & New Chat */}
      <div className="p-3 pb-2 space-y-2">
        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#161618] hover:bg-[#1A1A1E] focus:bg-[#1A1A1E] text-zinc-200 placeholder-zinc-400 rounded-xl border border-white/5 focus:border-indigo-500/40 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Primary Action Buttons: New Chat & Temporary Chat */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onNewChat()}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600/15 via-indigo-600/10 to-transparent hover:from-indigo-600/25 hover:via-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 hover:text-indigo-200 text-xs font-medium transition-all group shadow-sm"
            title="Start a new persistent conversation"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>New Chat</span>
          </button>

          <button
            onClick={() => onStartTemporaryChat()}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all group shadow-sm border ${
              isTemporaryMode
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-500/10'
                : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/10 text-zinc-400 hover:text-amber-300 hover:border-amber-500/30'
            }`}
            title="Start a temporary unsaved chat (not stored in database)"
          >
            <Ghost className={`w-3.5 h-3.5 ${isTemporaryMode ? 'text-amber-400 animate-pulse' : 'text-zinc-400 group-hover:text-amber-400'}`} />
            <span>Temporary</span>
          </button>
        </div>

        {/* Temporary Mode Status Banner in Sidebar */}
        {isTemporaryMode && (
          <div className="px-2.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-300 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2 truncate">
              <Ghost className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <div className="truncate">
                <div className="font-semibold text-[11px] leading-tight">Temporary Mode Active</div>
                <div className="text-[10px] text-amber-400/70 truncate">Messages not saved to DB</div>
              </div>
            </div>
            <button
              onClick={onExitTemporaryChat}
              className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors font-medium flex-shrink-0 ml-1"
              title="Exit temporary chat"
            >
              Exit
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Conversation Tree & Workspaces */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {/* SECTION: GROUPS / WORKSPACES */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3 h-3" />
              <span>Groups</span>
            </span>
            <button
              onClick={() => setIsCreatingGroup(true)}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Create new conversation group"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Inline Create Group Input */}
          {isCreatingGroup && (
            <form onSubmit={handleCreateGroupSubmit} className="px-2 py-1 mb-2">
              <div className="flex items-center gap-1 bg-[#18181B] border border-indigo-500/40 rounded-lg p-1 shadow-md">
                <FolderPlus className="w-3.5 h-3.5 text-indigo-400 ml-1 flex-shrink-0" />
                <input
                  ref={groupInputRef}
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name..."
                  className="bg-transparent text-xs text-white px-1.5 py-0.5 focus:outline-none flex-1"
                />
                <button
                  type="submit"
                  disabled={!newGroupName.trim()}
                  className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingGroup(false);
                    setNewGroupName('');
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </form>
          )}

          {/* Group Accordions */}
          <div className="space-y-1">
            {groups.map((group) => {
              const groupConvs = groupedConvsMap[group.id] || [];
              const isExpanded = group.is_expanded || Boolean(searchQuery);

              return (
                <div key={group.id} className="group/item">
                  {/* Group Header Row */}
                  {editingGroupId === group.id ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#18181B] border border-indigo-500/40 rounded-lg mb-1">
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveGroupRename(group.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        autoFocus
                        className="bg-transparent text-xs text-white px-1.5 py-0.5 focus:outline-none flex-1"
                      />
                      <button
                        onClick={() => handleSaveGroupRename(group.id)}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEditingGroupId(null)}
                        className="p-1 text-zinc-400 hover:text-zinc-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => onToggleGroupExpand(group.id, !group.is_expanded)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/[0.04] text-zinc-300 hover:text-white cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-zinc-400">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium truncate">
                          {group.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-400 font-mono px-1 rounded bg-white/5">
                          {groupConvs.length}
                        </span>

                        {/* Group Actions Menu Trigger */}
                        <div className="relative context-menu-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuGroupId(
                                activeMenuGroupId === group.id ? null : group.id
                              );
                              setActiveMenuConvId(null);
                            }}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                            title="Group options"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </button>

                          {activeMenuGroupId === group.id && (
                            <div className="absolute right-0 top-6 w-44 rounded-xl bg-[#18181B] border border-white/10 shadow-2xl p-1 z-50 text-xs">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNewChat(group.id);
                                  setActiveMenuGroupId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:bg-white/5 hover:text-white"
                              >
                                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                <span>New chat in group</span>
                              </button>
                              <button
                                onClick={(e) => handleStartRenameGroup(group, e)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:bg-white/5 hover:text-white"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Rename group</span>
                              </button>
                              <div className="my-1 border-t border-white/5" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete group "${group.name}"? Conversations will be moved to ungrouped.`)) {
                                    onDeleteGroup(group.id);
                                  }
                                  setActiveMenuGroupId(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete group</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Group Children (Indented tree items matching screenshot) */}
                  {isExpanded && (
                    <div className="border-l border-zinc-800 ml-4 pl-2 space-y-0.5 my-0.5">
                      {groupConvs.length === 0 ? (
                        <div className="px-2 py-1.5 text-[11px] text-zinc-400 italic flex items-center justify-between">
                          <span>No conversations</span>
                          <button
                            onClick={() => onNewChat(group.id)}
                            className="text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      ) : (
                        groupConvs.map((conv) => renderConversationItem(conv, true))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {groups.length === 0 && !isCreatingGroup && (
              <div className="px-3 py-2 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                <p className="text-[11px] text-zinc-400 mb-1.5">No groups yet</p>
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-indigo-400 text-[11px] font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" /> Create Group
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SECTION: UNGROUPED / RECENT CONVERSATIONS */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              <span>Recent Chats</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {ungroupedConvs.length}
            </span>
          </div>

          <div className="space-y-0.5">
            {ungroupedConvs.map((conv) => renderConversationItem(conv, false))}

            {ungroupedConvs.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-zinc-400">
                {searchQuery ? 'No matching conversations' : 'No ungrouped chats'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info / DB Badge */}
      <div className="p-3 border-t border-white/[0.06] bg-[#0A0A0C] text-[11px] text-zinc-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>SQLite Local-First</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400">
          {conversations.length} total
        </span>
      </div>

      {/* Move Conversation Modal */}
      {movingConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-[#141416] border border-white/10 p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <FolderInput className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-semibold text-white">
                  Move Conversation
                </h3>
              </div>
              <button
                onClick={() => setMovingConversation(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 truncate">
              Assign "<span className="text-zinc-200 font-medium">{movingConversation.title}</span>" to a group:
            </p>

            <div className="max-h-52 overflow-y-auto space-y-1 py-1">
              {/* Option: Ungrouped */}
              <button
                onClick={() => handleConfirmMove(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                  !movingConversation.group_id
                    ? 'bg-indigo-600/20 text-indigo-300 font-medium border border-indigo-500/30'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                  <span>No Group (Ungrouped)</span>
                </span>
                {!movingConversation.group_id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>

              {/* Existing Groups */}
              {groups.map((g) => {
                const isSelected = movingConversation.group_id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleConfirmMove(g.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-300 font-medium border border-indigo-500/30'
                        : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate">{g.name}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Quick create group & move inside modal */}
            {isCreatingGroupInMove ? (
              <form onSubmit={handleCreateAndMove} className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                <input
                  type="text"
                  value={moveModalNewGroupName}
                  onChange={(e) => setMoveModalNewGroupName(e.target.value)}
                  placeholder="New group name..."
                  autoFocus
                  className="flex-1 bg-[#1A1A1E] text-xs text-white px-2.5 py-1.5 rounded-lg border border-indigo-500/40 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!moveModalNewGroupName.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-40"
                >
                  Create & Move
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingGroupInMove(false)}
                  className="p-1.5 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={() => setIsCreatingGroupInMove(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-indigo-400 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create new group and move</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );

  // Render individual conversation row
  function renderConversationItem(conv, isNested = false) {
    const isActive = !isTemporaryMode && conv.id === activeConversationId;
    const isEditing = editingConvId === conv.id;
    const isMenuOpen = activeMenuConvId === conv.id;

    if (isEditing) {
      return (
        <div
          key={conv.id}
          className="flex items-center gap-1 px-2 py-1 bg-[#1A1A1E] border border-indigo-500/50 rounded-xl my-0.5 shadow-md"
        >
          <input
            ref={editInputRef}
            type="text"
            value={editingConvTitle}
            onChange={(e) => setEditingConvTitle(e.target.value)}
            onKeyDown={(e) => handleKeyDownConvRename(e, conv.id)}
            className="flex-1 bg-transparent text-xs text-white px-1 py-0.5 focus:outline-none"
          />
          <button
            onClick={() => handleSaveConvRename(conv.id)}
            className="p-1 text-emerald-400 hover:text-emerald-300"
            title="Save (Enter)"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEditingConvId(null)}
            className="p-1 text-zinc-400 hover:text-zinc-200"
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={conv.id}
        onClick={() => onSelectConversation(conv.id)}
        onDoubleClick={(e) => handleStartRenameConv(conv, e)}
        className={`group/conv relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-all ${
          isActive
            ? 'bg-[#222227] text-white font-medium shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
        }`}
        title={`${conv.title} (Double click to rename)`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isNested ? (
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isActive ? 'bg-indigo-400' : 'bg-zinc-600 group-hover/conv:bg-zinc-400'
              }`}
            />
          ) : (
            <MessageSquare
              className={`w-3.5 h-3.5 flex-shrink-0 ${
                isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover/conv:text-zinc-400'
              }`}
            />
          )}

          <span className="text-xs truncate">{conv.title || 'Untitled Chat'}</span>
        </div>

        {/* Options 3-dots Menu Button */}
        <div className="relative context-menu-container flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuConvId(isMenuOpen ? null : conv.id);
              setActiveMenuGroupId(null);
            }}
            className={`p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-opacity ${
              isMenuOpen ? 'opacity-100 bg-white/10' : 'opacity-0 group-hover/conv:opacity-100'
            }`}
            title="Conversation options"
          >
            <MoreVertical className="w-3 h-3" />
          </button>

          {/* Context Menu Dropdown */}
          {isMenuOpen && (
            <div className="absolute right-0 top-6 w-44 rounded-xl bg-[#18181B] border border-white/10 shadow-2xl p-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={(e) => handleStartRenameConv(conv, e)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Rename chat</span>
              </button>

              <button
                onClick={(e) => handleOpenMoveModal(conv, e)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                <FolderInput className="w-3.5 h-3.5 text-indigo-400" />
                <span>Move to group...</span>
              </button>

              <div className="my-1 border-t border-white/5" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete conversation "${conv.title}"?`)) {
                    onDeleteConversation(conv.id);
                  }
                  setActiveMenuConvId(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete conversation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
