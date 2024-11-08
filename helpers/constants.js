export const networks = {
  mainnet: {
    container_name: 'log-slog',
    cluster_name: 'puffynet',
    namespace_name: 'followmain',
    pod_name: 'follower-0',
  },
  emerynet: {
    container_name: 'log-slog',
    cluster_name: 'emerynet',
    namespace_name: 'instagoric',
    pod_name: 'validator-primary-0',
  },
  devnet: {
    container_name: 'log-slog',
    cluster_name: 'devnet',
    namespace_name: 'instagoric',
    pod_name: 'validator-primary-0',
  },
};
