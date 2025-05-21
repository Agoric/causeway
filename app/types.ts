export type Vat = {
  id: string;
};

export type Interaction = {
  source: string;
  target: string;
  method?: string;
  interactions: any;
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
