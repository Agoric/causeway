import { createContext, useState } from 'react';
import { Interaction } from 'types/common';
import { Vat } from 'types/create-vat';

type ContextType = {
  interactions: Array<Interaction>;
  setData: (interactions: Array<Interaction>, vats: Array<Vat>) => void;
  vats: Array<Vat>;
};

const defaultContextValue: ContextType = {
  interactions: [],
  setData: () => {},
  vats: [],
};

export const Context = createContext<ContextType>(defaultContextValue);

const InteractionProvider = ({ children }: { children?: React.ReactNode }) => {
  const [state, setState] =
    useState<Omit<ContextType, 'setData'>>(defaultContextValue);

  return (
    <Context.Provider
      value={{
        interactions: state.interactions,
        setData: (interactions, vats) => setState({ interactions, vats }),
        vats: state.vats,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default InteractionProvider;
