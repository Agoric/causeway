export type Vat = {
  vatID: string;
  name: string;
  time: number;
};

export type Block = { height: any; time: any; blockTime: any };
export type Delivery =
  | {
      type: 'message';
      method: string;
      vatID: string;
      time: number;
      target: any;
      result: any;
      crankNum: any;
      blockHeight: any;
    }
  | {
      type: 'notify';
      state: any;
      vatID: string;
      time: number;
      kpid: any;
      blockHeight: any;
    };

export type Syscall = {
  type: 'send';
  method: string;
  vatID: string;
  time: number;
  target: any;
  result: any;
  rejected?: any;
};

export type PromiseObj = {
  kpid?: any;
  creator?: any;
  resolver?: any;
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

export type Neo4jGraphInput = {
  vats: Vat[];
  deliveries: Delivery[];
  syscalls: Syscall[];
  blocks: Block[];
  promises: PromiseObj[];
};
