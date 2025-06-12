export const networks = {
  mainnet: {
    container_name: 'log-slog',
    cluster_name: 'instagoric',
    namespace_name: 'followmain',
    pod_name: 'follower-0',
  },
  emerynet: {
    container_name: 'log-slog',
    cluster_name: 'instagoric',
    namespace_name: 'emerynet',
    pod_name: 'validator-primary-0',
  },
  devnet: {
    container_name: 'log-slog',
    cluster_name: 'instagoric',
    namespace_name: 'devnet',
    pod_name: 'validator-primary-0',
  },
};

export const ADDITIONAL_QUERY_FILTERS = `
    (
        jsonPayload.type = "create-vat" OR 
        jsonPayload.type = "cosmic-swingset-end-block-start" OR 
        jsonPayload.type = "deliver" OR 
        jsonPayload.type = "deliver-result" OR 
        jsonPayload.type = "syscall"
    )
`;
