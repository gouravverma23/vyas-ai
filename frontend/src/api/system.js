import { fetchJson } from './client';

export async function fetchHealth() {
  return fetchJson('/health');
}

export async function fetchModels() {
  return fetchJson('/models');
}

