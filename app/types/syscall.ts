type CapData = {
  body: string;
  slots: string[];
};

/**
 * A parsed log entry representing a syscall event emitted by the swingset kernel.
 */
export type SyscallLogEntry = {
  type: 'syscall';
  crankNum: number;
  vatID: string;
  deliveryNum: number;
  syscallNum: number;
  replay: boolean;
  time: number;
  monotime: number;
  ksc:
    | ['send', string, { methargs: CapData; result: string }]
    | ['subscribe', string, string]
    | ['vatstoreGet', string, string]
    | ['vatstoreSet', string, string, string]
    | ['invoke', string, string, CapData]
    | ['resolve', string, [string, boolean, CapData][]];
  vsc:
    | ['send', string, { methargs: CapData; result: string }]
    | ['subscribe', string]
    | ['vatstoreGet', string]
    | ['vatstoreSet', string, string]
    | ['callNow', string, string, CapData]
    | ['resolve', [string, boolean, CapData][]];
};

export type SyscallSend = {
  type: 'send';
  vatID: string;
  target: string;
  method: string;
  result: string;
  time: number;
  blockHeight?: number;
  rejected?: boolean;
};

export type SyscallResolve = {
  type: 'resolve';
  vatID: string;
  kpid: string;
  rejected: boolean;
  time: number;
  blockHeight: number;
};

/**
 * A simplified and normalized representation of a syscall,
 * derived from the raw SyscallLogEntry structure.
 *
 * Unlike SyscallLogEntry—which retains the original kernel/vat tuple formats—
 * Syscall distills only the essential details for tracking specific syscall types,
 * such as 'send' and 'resolve', in a consistent object-based format.
 */
export type Syscall = SyscallSend | SyscallResolve;
