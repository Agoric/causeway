type CapData = {
  body: string;
  slots: string[];
};

export type PromiseState = 'fulfilled' | 'rejected' | 'pending';

type DeliverMessage = [
  'message',
  string,
  {
    methargs: CapData;
    result: string | null;
  },
];

type NotifyKernelResolution = [
  kpid: string,
  resolution: {
    state: PromiseState;
    data: CapData;
  },
];

type NotifyVatResolution = [vpid: string, rejected: boolean, data: CapData];

type DeliverNotifyKD = ['notify', [NotifyKernelResolution]];

type DeliverNotifyVD = ['notify', [NotifyVatResolution]];

export type DeliverLogEntry = {
  type: 'deliver';
  crankNum: number;
  vatID: string;
  deliveryNum: number;
  replay: boolean;
  time: number;
  monotime: number;
  // Kernel delivery: could be a message or notify
  kd: DeliverMessage | DeliverNotifyKD;
  // Vat delivery: mirrors kd but for the vat side
  vd: DeliverMessage | DeliverNotifyVD;
};

type DeliveryMessage = {
  type: 'message';
  crankNum: number;
  vatID: string;
  target: string;
  method: string;
  methargs: string;
  result: string | null;
  time: number;
  blockHeight: number;
};

type DeliveryNotify = {
  type: 'notify';
  vatID: string;
  kpid: string;
  state: PromiseState;
  time: number;
  blockHeight: number;
};

/**
 * A simplified and normalized representation of a delivery,
 * extracted from a DeliverLogEntry.
 *
 * DeliverLogEntry represents the raw log format from the swingset kernel,
 * Delivery flattens and standardizes that data into two possible forms:
 *   - DeliveryMessage: for 'message' deliveries with method and target info
 *   - DeliveryNotify: for 'notify' deliveries indicating promise resolutions
 */
export type Delivery = DeliveryMessage | DeliveryNotify;
