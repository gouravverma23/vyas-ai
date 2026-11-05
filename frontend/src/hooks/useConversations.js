import { useState, useEffect, useCallback } from 'react';
import {
  fetchConversations as apiFetchConversations,
  createConversation as apiCreateConversation,
  updateConversation as apiUpdateConversation,
  deleteConversation as apiDeleteConversation,
} from '../api/conversations';
import {
  createGroup as apiCreateGroup,
  updateGroup as apiUpdateGroup,
  deleteGroup as apiDeleteGroup,
} from '../api/groups';

export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async (targetActiveId = null) => {
    try {
      setIsLoading(true);
      const data = await apiFetchConversations();
      const convList = data.conversations || [];
      const grpList = data.groups || [];

      setConversations(convList);
      setGroups(grpList);

      let nextActiveId = targetActiveId || activeConversationId;
      if (!nextActiveId || !convList.some((c) => c.id === nextActiveId)) {
        nextActiveId = convList.length > 0 ? convList[0].id : null;
      }

      setActiveConversationId(nextActiveId);
      return { conversations: convList, groups: grpList, activeId: nextActiveId };
    } catch (err) {
      console.warn('Failed to load conversations from backend:', err);
      return { conversations: [], groups: [], activeId: null };
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId]);

  useEffect(() => {
    loadConversations();
  }, []);

  const handleSelectConversation = useCallback((convId) => {
    setActiveConversationId(convId);
  }, []);

  const handleNewConversation = useCallback(async (groupId = null) => {
    try {
      const created = await apiCreateConversation('New Chat', groupId);
      await loadConversations(created.id);
      return created;
    } catch (err) {
      console.error('Failed to create new conversation:', err);
      return null;
    }
  }, [loadConversations]);

  const handleRenameConversation = useCallback(async (convId, newTitle) => {
    try {
      const updated = await apiUpdateConversation(convId, { title: newTitle });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: updated.title } : c))
      );
      return updated;
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      return null;
    }
  }, []);

  const handleDeleteConversation = useCallback(async (convId) => {
    try {
      await apiDeleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConversationId === convId) {
        const nextId = remaining.length > 0 ? remaining[0].id : null;
        setActiveConversationId(nextId);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [conversations, activeConversationId]);

  const handleCreateGroup = useCallback(async (name) => {
    try {
      const group = await apiCreateGroup(name);
      setGroups((prev) => [...prev, group]);
      return group;
    } catch (err) {
      console.error('Failed to create group:', err);
      return null;
    }
  }, []);

  const handleRenameGroup = useCallback(async (groupId, newName) => {
    try {
      const updated = await apiUpdateGroup(groupId, { name: newName });
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name: updated.name } : g))
      );
    } catch (err) {
      console.error('Failed to rename group:', err);
    }
  }, []);

  const handleToggleGroup = useCallback(async (groupId, isExpanded) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, is_expanded: isExpanded } : g))
    );
    try {
      await apiUpdateGroup(groupId, { isExpanded });
    } catch (err) {
      console.error('Failed to toggle group expansion:', err);
    }
  }, []);

  const handleDeleteGroup = useCallback(async (groupId) => {
    try {
      await apiDeleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setConversations((prev) =>
        prev.map((c) => (c.group_id === groupId ? { ...c, group_id: null, group_name: null } : c))
      );
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  }, []);

  const handleMoveConversationToGroup = useCallback(async (convId, targetGroupId) => {
    try {
      await apiUpdateConversation(convId, {
        groupId: targetGroupId,
        clearGroup: !targetGroupId
      });
      await loadConversations(activeConversationId);
    } catch (err) {
      console.error('Failed to move conversation to group:', err);
    }
  }, [loadConversations, activeConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return {
    conversations,
    groups,
    activeConversationId,
    activeConversation,
    isLoading,
    loadConversations,
    handleSelectConversation,
    handleNewConversation,
    handleRenameConversation,
    handleDeleteConversation,
    handleCreateGroup,
    handleRenameGroup,
    handleToggleGroup,
    handleDeleteGroup,
    handleMoveConversationToGroup,
  };
}

