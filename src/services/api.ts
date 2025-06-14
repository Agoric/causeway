import { Interactions, Interaction } from 'types/common';
import { Vat } from 'types/create-vat';

const API_BASE = '/api';

export const checkHealth = async (): Promise<Record<string, unknown>> => {
  const response = await fetch(`${API_BASE}/health`);
  const data = await response.json();
  return data;
};

export const getVats = async (
  endTime?: number,
  startTime?: number,
): Promise<Vat[]> => {
  let route = `${API_BASE}/vats?`;
  route += [
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

export const getInteractions = async (
  startTime: number,
  endTime: number,
): Promise<Interactions> => {
  const url = new URL(`${window.location.origin}${API_BASE}/interactions`);
  url.searchParams.append('startTime', startTime.toString());
  url.searchParams.append('endTime', endTime.toString());

  console.log(`Fetching interactions from: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error fetching interactions: ${response.statusText}`);
  }

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
