import { Interactions, Interaction } from 'types/common';
import { Vat } from 'types/create-vat';

const API_BASE = '/api';

export const checkHealth = async () => {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error('Failed to connect to database');
};

export const getInteractions = async ({
  blockHeight,
  endTime,
  runId,
  startTime,
}: Partial<{
  blockHeight: number;
  endTime: number;
  runId: string;
  startTime: number;
}>): Promise<Interactions> => {
  let route = `${API_BASE}/interactions?`;
  route += [
    blockHeight && `blockHeight=${blockHeight}`,
    endTime && `endTime=${endTime}`,
    runId && `runId=${runId}`,
    startTime && `startTime=${startTime}`,
  ]
    .filter(Boolean)
    .join('&');

  const response = await fetch(route);
  if (!response.ok)
    throw new Error(`Error fetching interactions: ${response.statusText}`);

  return await response.json();
};

export const getRunId = async ({
  runId,
}: {
  runId: string;
}): Promise<Run> => {
  const response = await fetch(`${API_BASE}/run-id/${runId}`);
  if (!response.ok)
    throw new Error(`Error fetching vats: ${response.statusText}`);

  return await response.json();
};

export const getRunIds = async ({
  blockHeight,
  endTime,
  startTime,
}: Partial<{
  blockHeight: number;
  endTime: number;
  startTime: number;
}>): Promise<Array<string>> => {
  let route = `${API_BASE}/run-id?`;
  route += [
    blockHeight && `blockHeight=${blockHeight}`,
    endTime && `endTime=${endTime}`,
    startTime && `startTime=${startTime}`,
  ]
    .filter(Boolean)
    .join('&');

  const response = await fetch(route);
  if (!response.ok)
    throw new Error(`Error fetching vats: ${response.statusText}`);

  return await response.json();
};

export const getVats = async ({
  blockHeight,
  endTime,
  runId,
  startTime,
}: Partial<{
  blockHeight: number;
  endTime: number;
  runId: string;
  startTime: number;
}>): Promise<Array<Vat>> => {
  let route = `${API_BASE}/vats?`;
  route += [
    blockHeight && `blockHeight=${blockHeight}`,
    endTime && `endTime=${endTime}`,
    runId && `runId=${runId}`,
    startTime && `startTime=${startTime}`,
  ]
    .filter(Boolean)
    .join('&');

  const response = await fetch(route);
  if (!response.ok)
    throw new Error(`Error fetching vats: ${response.statusText}`);

  return await response.json();
};

export const sanitizeInteractions = (
  interactions: Interaction[],
): Interaction[] => {
  return interactions.map((interaction) => {
    if (interaction.method) {
      interaction.method = String(interaction.method).replace(
        /[^\w\s\-.,;:()]/g,
        '_',
      );
    }
    return interaction;
  });
};
