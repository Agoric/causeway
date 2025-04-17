/**
 * API Client for interacting with the backend service
 */

// API base URL - change this to match your backend URL in production
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Check the health of the API and Neo4j connection
 * @returns {Promise<Object>} Health status
 */
export const checkHealth = async () => {
  const response = await fetch(`${API_URL}/health`);
  const data = await response.json();
  return data;
};

/**
 * Get all vats from the database
 * @returns {Promise<Array>} List of vats
 */
export const getVats = async () => {
  const response = await fetch(`${API_URL}/vats`);
  if (!response.ok) {
    throw new Error(`Error fetching vats: ${response.statusText}`);
  }
  return await response.json();
};

/**
 * Get interactions between vats based on time range
 * @param {number} startTime - Start time (Unix timestamp)
 * @param {number} endTime - End time (Unix timestamp)
 * @returns {Promise<Object>} Interactions data
 */
export const getInteractions = async (startTime, endTime) => {
  const url = new URL(`${API_URL}/interactions`);
  url.searchParams.append('startTime', startTime);
  url.searchParams.append('endTime', endTime);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error fetching interactions: ${response.statusText}`);
  }
  
  return await response.json();
};

/**
 * Sanitize interactions data for Mermaid compatibility
 * @param {Array} interactions - Raw interactions from API
 * @returns {Array} Sanitized interactions
 */
export const sanitizeInteractions = (interactions) => {
  return interactions.map(interaction => {
    if (interaction.method) {
      interaction.method = String(interaction.method).replace(/[^\w\s\-.,;:()]/g, '_');
    }
    return interaction;
  });
};

// Export default API object with all methods
export default {
  checkHealth,
  getVats,
  getInteractions,
  sanitizeInteractions
};