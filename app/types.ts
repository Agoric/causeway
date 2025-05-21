export type Vat = {
  vatID: string;
  name: string;
  time: number;
};

export type Block = { height: number; time: number; blockTime: number };

export type State = 'fulfilled' | 'rejected' | 'pending';

type DeliveryMessage = {
  type: 'message';
  crankNum: number;
  vatID: string;
  target: string;
  method: string;
  result: string | null;
  time: number;
  blockHeight: number;
};

type DeliveryNotify = {
  type: 'notify';
  vatID: string;
  kpid: string;
  state: State;
  time: number;
  blockHeight: number;
};

export type Delivery = DeliveryMessage | DeliveryNotify;

type SyscallSend = {
  type: 'send';
  vatID: string;
  target: string;
  method: string;
  result: string;
  time: number;
  blockHeight?: number;
  rejected?: boolean;
};

type SyscallResolve = {
  type: 'resolve';
  vatID: string;
  kpid: string;
  rejected: boolean;
  time: number;
  blockHeight: number;
};

export type Syscall = SyscallSend | SyscallResolve;

export type PromiseObj = {
  kpid: string;
  state: State;
  created: number;
  creator: string;
  resolved?: number;
  resolver?: string;
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
  promises: PromiseObj[];
};
