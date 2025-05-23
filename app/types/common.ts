import {
  Block,
  CosmicSwingsetBeginBlockLogEntry,
} from './cosmic-swingset-block';
import { CreateVatLogEntry, Vat } from './create-vat';
import { DeliverLogEntry, Delivery } from './delivery';
import { Syscall, SyscallLogEntry } from './syscall';

type PromiseState = 'fulfilled' | 'rejected' | 'pending';

export type TrackedPromise = {
  kpid: string;
  state: PromiseState;
  created: number;
  creator: string; // vatID
  // These fields are added once resolved (optional initially)
  resolved?: number;
  resolver?: string; // vatID
};

export type Interaction = {
  sourceVat: string;
  targetVat: string;
  method: string;
  time: number;
  type: string;
};

export type Interactions = {
  interactions: Interaction[];
  vats: Vat[];
  meta: {
    startTime: number;
    endTime: number;
    count: number;
  };
};

export type SlogData = {
  vats: Vat[];
  deliveries: Delivery[];
  syscalls: Syscall[];
  blocks: Block[];
  promises: TrackedPromise[];
};

export type SupportedSlogEntryType =
  | 'create-vat'
  | 'cosmic-swingset-begin-block'
  | 'deliver'
  | 'syscall';

export type SlogEntries =
  | CosmicSwingsetBeginBlockLogEntry
  | CreateVatLogEntry
  | DeliverLogEntry
  | SyscallLogEntry;
