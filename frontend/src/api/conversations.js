import { fetchJson } from './client';

export async function fetchConversations() {
  return fetchJson('/conversations');
}

export async function fetchConversation(conversationId) {
  return fetchJson(`/conversations/${conversationId}`);
}

export async function createConversation(title = 'New Chat', groupId = null) {
  return fetchJson('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title, group_id: groupId })
  });
}

export async function updateConversation(conversationId, { title, groupId, clearGroup = false }) {
  return fetchJson(`/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title,
      group_id: groupId,
      clear_group: clearGroup
    })
  });
}

export async function deleteConversation(conversationId) {
  return fetchJson(`/conversations/${conversationId}`, {
    method: 'DELETE'
  });
}

export async function clearHistory(conversationId = null) {
  const query = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : '';
  return fetchJson(`/history${query}`, {
    method: 'DELETE'
  });
}

