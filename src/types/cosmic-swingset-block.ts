export type CosmicSwingsetBeginBlockLogEntry = {
  type: 'cosmic-swingset-begin-block';
  blockHeight: number;
  blockTime: number;
  interBlockSeconds: number | null;
  afterCommitHangoverSeconds: number;
  blockLagSeconds: number | null;
  inboundQueueStats: {
    cosmic_swingset_inbound_queue_length_forced: number;
    cosmic_swingset_inbound_queue_length_priority: number;
    cosmic_swingset_inbound_queue_length_inbound: number;
    cosmic_swingset_inbound_queue_length: number;
    cosmic_swingset_inbound_queue_add_forced: number;
    cosmic_swingset_inbound_queue_add_priority: number;
    cosmic_swingset_inbound_queue_add_inbound: number;
    cosmic_swingset_inbound_queue_add: number;
    cosmic_swingset_inbound_queue_remove_forced: number;
    cosmic_swingset_inbound_queue_remove_priority: number;
    cosmic_swingset_inbound_queue_remove_inbound: number;
    cosmic_swingset_inbound_queue_remove: number;
  };
  time: number;
  monotime: number;
};

/**
 * A simplified version of CosmicSwingsetBeginBlockLogEntry.
 * Used to store only the most relevant block information for tracking block sequence and timing.
 */
export type Block = { height: number; time: number; blockTime: number };
