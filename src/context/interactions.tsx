import { createContext, useState } from 'react';
import { Interaction } from 'types/common';
import { Vat } from 'types/create-vat';

type ContextType = {
  interactions: Array<Interaction>;
  runIds: Array<string>;
  setData: (data: Partial<Omit<ContextType, 'setData'>>) => void;
  vats: Array<Vat>;
};

const defaultContextValue: ContextType = {
  interactions: [],
  runIds: [],
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
        runIds: state.runIds,
        setData: (data) =>
          setState((prevState) => ({
            ...prevState,
            ...data,
          })),
        vats: state.vats,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default InteractionProvider;
