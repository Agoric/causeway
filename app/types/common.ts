import { Block } from './cosmic-swingset-block';
import { Vat } from './create-vat';
import { Delivery } from './delivery';
import { Syscall } from './syscall';

export type State = 'fulfilled' | 'rejected' | 'pending';

export type TrackedPromise = {
  kpid: string;
  state: State;
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

export type TimeRange = {
  min: number | null;
  max: number | null;
};

export type SlogData = {
  vats: Vat[];
  deliveries: Delivery[];
  syscalls: Syscall[];
  blocks: Block[];
  promises: TrackedPromise[];
};
