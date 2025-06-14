import { Interactions, Interaction } from 'types/common';
import { Vat } from 'types/create-vat';

const API_BASE = '/api';

export const checkHealth = async () => {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error('Failed to connect to database');
};

export const getVats = async ({
  blockHeight,
  endTime,
  startTime,
}: Partial<{
  blockHeight: number;
  endTime: number;
  startTime: number;
}>): Promise<Vat[]> => {
  let route = `${API_BASE}/vats?`;
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

export const getInteractions = async ({
  blockHeight,
  endTime,
  startTime,
}: Partial<{
  blockHeight: number;
  endTime: number;
  startTime: number;
}>): Promise<Interactions> => {
  let route = `${API_BASE}/interactions?`;
  route += [
    blockHeight && `blockHeight=${blockHeight}`,
    endTime && `endTime=${endTime}`,
    startTime && `startTime=${startTime}`,
  ]
    .filter(Boolean)
    .join('&');

  const response = await fetch(route);
  if (!response.ok)
    throw new Error(`Error fetching interactions: ${response.statusText}`);

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
