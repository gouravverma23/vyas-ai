import { fetchJson } from './client';

export async function createGroup(name) {
  return fetchJson('/groups', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export async function updateGroup(groupId, { name, isExpanded }) {
  return fetchJson(`/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name,
      is_expanded: isExpanded
    })
  });
}

export async function deleteGroup(groupId) {
  return fetchJson(`/groups/${groupId}`, {
    method: 'DELETE'
  });
}

