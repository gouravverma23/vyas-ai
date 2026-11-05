import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  FolderInput,
  FolderMinus,
  Check,
  X,
  Sparkles,
  Bot,
  Search,
  Ghost,
  PanelLeftClose,
  ShieldAlert
} from 'lucide-react';

export default function Sidebar({
  conversations = [],
  groups = [],
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onToggleGroup,
  onToggleGroupExpand,
  onMoveConversationToGroup,
  onMoveConversation,
  isOpen = true,
  onClose,
  onToggleOpen,
  isTemporaryMode = false,
  onStartTemporaryChat,
  onExitTemporaryChat
}) {
  const handleNewChatAction = onNewConversation || onNewChat;
  const handleToggleGroupAction = onToggleGroup || onToggleGroupExpand;
  const handleMoveAction = onMoveConversationToGroup || onMoveConversation;
  const handleCloseAction = onClose || onToggleOpen;
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingConvTitle, setEditingConvTitle] = useState('');
  const [activeMenuConvId, setActiveMenuConvId] = useState(null);
  const [activeMenuGroupId, setActiveMenuGroupId] = useState(null);
  const [activeMoveConvId, setActiveMoveConvId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const groupInputRef = useRef(null);
  const editGroupInputRef = useRef(null);
  const editConvInputRef = useRef(null);

  // Close context menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.context-menu-container')) {
        setActiveMenuConvId(null);
        setActiveMenuGroupId(null);
        setActiveMoveConvId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Auto-focus inputs on creation/edit
  useEffect(() => {
    if (isCreatingGroup && groupInputRef.current) {
      groupInputRef.current.focus();
    }
  }, [isCreatingGroup]);

  useEffect(() => {
    if (editingGroupId && editGroupInputRef.current) {
      editGroupInputRef.current.focus();
      editGroupInputRef.current.select();
    }
  }, [editingGroupId]);

  useEffect(() => {
    if (editingConvId && editConvInputRef.current) {
      editConvInputRef.current.focus();
      editConvInputRef.current.select();
    }
  }, [editingConvId]);

  // Group Handlers
  const handleCreateGroupSubmit = (e) => {
    e.preventDefault();
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim());
      setNewGroupName('');
      setIsCreatingGroup(false);
    }
  };

  const handleStartRenameGroup = (group, e) => {
    e.stopPropagation();
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

  const handleDeleteGroupClick = (group, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete group "${group.name}"? Conversations inside it will be moved to Ungrouped.`)) {
      onDeleteGroup(group.id);
    }
    setActiveMenuGroupId(null);
  };

  // Conversation Handlers
  const handleStartRenameConv = (conv, e) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingConvTitle(conv.title);
    setActiveMenuConvId(null);
  };

  const handleSaveConvRename = (convId) => {
    if (editingConvTitle.trim()) {
      onRenameConversation(convId, editingConvTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleDeleteConvClick = (conv, e) => {
    e.stopPropagation();
    if (window.confirm(`Delete conversation "${conv.title}"?`)) {
      onDeleteConversation(conv.id);
    }
    setActiveMenuConvId(null);
  };

  const handleMoveToGroup = (convId, targetGroupId, e) => {
    e.stopPropagation();
    handleMoveAction?.(convId, targetGroupId);
    setActiveMoveConvId(null);
    setActiveMenuConvId(null);
  };

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = (c.title || '').toLowerCase().includes(q);
    const matchesLastMsg = (c.last_message || '').toLowerCase().includes(q);
    return matchesTitle || matchesLastMsg;
  });

  // Group conversations
  const groupedConversations = {};
  const ungroupedConversations = [];

  groups.forEach((g) => {
    groupedConversations[g.id] = [];
  });

  filteredConversations.forEach((conv) => {
    if (conv.group_id && groupedConversations[conv.group_id]) {
      groupedConversations[conv.group_id].push(conv);
    } else {
      ungroupedConversations.push(conv);
    }
  });

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main Sidebar Drawer / Pane */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col h-full bg-[#0C0C0E] border-r border-white/[0.08] transition-all duration-300 ease-in-out select-none ${
          isOpen
            ? 'w-[280px] sm:w-[300px] translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
        }`}
      >
        {/* Sidebar Header: App Brand + Close Button */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-white block leading-tight">
                Local AI
              </span>
              <span className="text-[10px] text-zinc-500 font-mono tracking-wider block">
                PRIVACY-FIRST CHAT
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Header: New Chat & Temporary Mode */}
        <div className="p-3 space-y-2 border-b border-white/[0.08]">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (isTemporaryMode) onExitTemporaryChat?.();
                handleNewChatAction?.();
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95"
              title="Start a new persistent conversation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            <button
              onClick={() => {
                if (isTemporaryMode) {
                  onExitTemporaryChat?.();
                } else {
                  onStartTemporaryChat?.();
                }
              }}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                isTemporaryMode
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-zinc-300 hover:text-white'
              }`}
              title="Start an incognito session that leaves no logs on disk"
            >
              <Ghost className={`w-3.5 h-3.5 ${isTemporaryMode ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span>{isTemporaryMode ? 'Exit Temp' : 'Temp Chat'}</span>
            </button>
          </div>

          {/* Quick Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[#141416] text-xs text-zinc-200 placeholder-zinc-500 rounded-xl pl-8 pr-7 py-1.5 border border-white/5 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Group Management Toolbar Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.05] text-xs text-zinc-400">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Conversations
          </span>
          <button
            onClick={() => setIsCreatingGroup(true)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-indigo-400 hover:bg-white/5 px-2 py-0.5 rounded-lg transition-colors"
            title="Create a new folder group"
          >
            <FolderPlus className="w-3 h-3" />
            <span>New Group</span>
          </button>
        </div>

        {/* New Group Inline Input */}
        {isCreatingGroup && (
          <form onSubmit={handleCreateGroupSubmit} className="p-3 border-b border-white/[0.08] bg-[#141416]">
            <div className="flex items-center gap-1.5">
              <input
                ref={groupInputRef}
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name (e.g. Work, Ideas)..."
                className="flex-1 bg-[#1A1A1E] text-xs text-white placeholder-zinc-500 px-2.5 py-1.5 rounded-lg border border-indigo-500/50 focus:outline-none"
              />
              <button
                type="submit"
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingGroup(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Conversation Groups & Recents Tree */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {/* 1. Folders / Groups Section */}
          {groups.map((group) => {
            const groupConvs = groupedConversations[group.id] || [];
            const isExpanded = group.is_expanded;

            return (
              <div key={group.id} className="rounded-xl overflow-hidden group/folder">
                {/* Group Title Bar */}
                {editingGroupId === group.id ? (
                  <div className="flex items-center gap-1.5 p-1.5 bg-[#16161A] rounded-lg">
                    <input
                      ref={editGroupInputRef}
                      type="text"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveGroupRename(group.id);
                        if (e.key === 'Escape') setEditingGroupId(null);
                      }}
                      className="flex-1 bg-black/40 text-xs text-white px-2 py-1 rounded border border-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveGroupRename(group.id)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingGroupId(null)}
                      className="p-1 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleGroupAction?.(group.id, !Boolean(isExpanded));
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-white/[0.04] cursor-pointer text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate text-zinc-300">
                        {group.name}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono ml-auto mr-1">
                        {groupConvs.length}
                      </span>
                    </div>

                    {/* Group context menu button */}
                    <div className="relative context-menu-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuGroupId(activeMenuGroupId === group.id ? null : group.id);
                        }}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/10 opacity-0 group-hover/folder:opacity-100 transition-opacity"
                        title="Group options"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>

                      {activeMenuGroupId === group.id && (
                        <div
                          className="absolute right-0 top-6 w-32 bg-[#1A1A1E] border border-white/10 rounded-xl shadow-2xl p-1 z-50 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleStartRenameGroup(group, e)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:bg-white/5 hover:text-white"
                          >
                            <Edit2 className="w-3 h-3 text-zinc-400" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteGroupClick(group, e)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-conversations in Group */}
                {isExpanded && (
                  <div className="border-l border-zinc-800 ml-4 pl-2 space-y-0.5 my-0.5">
                    {groupConvs.length === 0 ? (
                      <div className="px-3 py-1.5 text-[11px] text-zinc-600 italic">
                        No chats in folder
                      </div>
                    ) : (
                      groupConvs.map((conv) => (
                        <ConversationItem
                          key={conv.id}
                          conv={conv}
                          activeConversationId={activeConversationId}
                          editingConvId={editingConvId}
                          editingConvTitle={editingConvTitle}
                          setEditingConvTitle={setEditingConvTitle}
                          editConvInputRef={editConvInputRef}
                          activeMenuConvId={activeMenuConvId}
                          setActiveMenuConvId={setActiveMenuConvId}
                          activeMoveConvId={activeMoveConvId}
                          setActiveMoveConvId={setActiveMoveConvId}
                          groups={groups}
                          onSelectConversation={onSelectConversation}
                          handleStartRenameConv={handleStartRenameConv}
                          handleSaveConvRename={handleSaveConvRename}
                          setEditingConvId={setEditingConvId}
                          handleDeleteConvClick={handleDeleteConvClick}
                          handleMoveToGroup={handleMoveToGroup}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 2. Ungrouped / Recent Conversations Section */}
          <div className="pt-2">
            {groups.length > 0 && ungroupedConversations.length > 0 && (
              <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Recent Chats
              </div>
            )}

            {ungroupedConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                activeConversationId={activeConversationId}
                editingConvId={editingConvId}
                editingConvTitle={editingConvTitle}
                setEditingConvTitle={setEditingConvTitle}
                editConvInputRef={editConvInputRef}
                activeMenuConvId={activeMenuConvId}
                setActiveMenuConvId={setActiveMenuConvId}
                activeMoveConvId={activeMoveConvId}
                setActiveMoveConvId={setActiveMoveConvId}
                groups={groups}
                onSelectConversation={onSelectConversation}
                handleStartRenameConv={handleStartRenameConv}
                handleSaveConvRename={handleSaveConvRename}
                setEditingConvId={setEditingConvId}
                handleDeleteConvClick={handleDeleteConvClick}
                handleMoveToGroup={handleMoveToGroup}
              />
            ))}

            {filteredConversations.length === 0 && (
              <div className="p-6 text-center text-xs text-zinc-500">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer: App status info */}
        <div className="p-3 border-t border-white/[0.08] text-[11px] text-zinc-500 font-mono flex items-center justify-between">
          <span>{conversations.length} saved chats</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
            Offline
          </span>
        </div>
      </aside>
    </>
  );
}

// Sub-component for individual conversation row item
function ConversationItem({
  conv,
  activeConversationId,
  editingConvId,
  editingConvTitle,
  setEditingConvTitle,
  editConvInputRef,
  activeMenuConvId,
  setActiveMenuConvId,
  activeMoveConvId,
  setActiveMoveConvId,
  groups,
  onSelectConversation,
  handleStartRenameConv,
  handleSaveConvRename,
  setEditingConvId,
  handleDeleteConvClick,
  handleMoveToGroup
}) {
  const isActive = conv.id === activeConversationId;

  if (editingConvId === conv.id) {
    return (
      <div className="flex items-center gap-1.5 p-1 bg-[#16161A] rounded-lg">
        <input
          ref={editConvInputRef}
          type="text"
          value={editingConvTitle}
          onChange={(e) => setEditingConvTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveConvRename(conv.id);
            if (e.key === 'Escape') setEditingConvId(null);
          }}
          className="flex-1 bg-black/40 text-xs text-white px-2 py-1 rounded border border-indigo-500 focus:outline-none"
        />
        <button
          onClick={() => handleSaveConvRename(conv.id)}
          className="p-1 text-emerald-400 hover:text-emerald-300"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setEditingConvId(null)}
          className="p-1 text-zinc-500 hover:text-zinc-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectConversation(conv.id)}
      className={`group/conv relative flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer text-xs transition-colors ${
        isActive
          ? 'bg-indigo-600/15 border border-indigo-500/30 text-white font-medium shadow-sm'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <MessageSquare
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover/conv:text-zinc-400'
          }`}
        />
        <span className="truncate">{conv.title || 'Untitled Chat'}</span>
      </div>

      {/* Context Menu Button */}
      <div className="relative context-menu-container flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenuConvId(activeMenuConvId === conv.id ? null : conv.id);
            setActiveMoveConvId(null);
          }}
          className={`p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover/conv:opacity-100'
          }`}
          title="Conversation options"
        >
          <MoreVertical className="w-3 h-3" />
        </button>

        {activeMenuConvId === conv.id && (
          <div
            className="absolute right-0 top-6 w-40 bg-[#1A1A1E] border border-white/10 rounded-xl shadow-2xl p-1 z-50 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => handleStartRenameConv(conv, e)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              <Edit2 className="w-3 h-3 text-zinc-400" />
              <span>Rename</span>
            </button>

            {/* Move to Group sub-action */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveMoveConvId(activeMoveConvId === conv.id ? null : conv.id);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <FolderInput className="w-3 h-3 text-zinc-400" />
                <span>Move to folder</span>
              </div>
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            </button>

            {/* Folder targets dropdown */}
            {activeMoveConvId === conv.id && (
              <div className="pl-3 py-1 my-1 border-t border-white/5 space-y-0.5">
                {conv.group_id && (
                  <button
                    onClick={(e) => handleMoveToGroup(conv.id, null, e)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] text-amber-400 hover:bg-white/5 rounded"
                  >
                    <FolderMinus className="w-3 h-3" />
                    <span>Remove from group</span>
                  </button>
                )}
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={(e) => handleMoveToGroup(conv.id, g.id, e)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] rounded transition-colors ${
                      conv.group_id === g.id
                        ? 'text-indigo-400 font-semibold bg-indigo-500/10'
                        : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <Folder className="w-3 h-3 text-indigo-400" />
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="my-1 border-t border-white/5" />

            <button
              onClick={(e) => handleDeleteConvClick(conv, e)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

