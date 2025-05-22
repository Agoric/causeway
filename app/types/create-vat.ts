export type CreateVatLogEntry = {
  type: 'create-vat';
  vatID: string;
  dynamic: boolean;
  description: string;
  name: string;
  managerType: 'xsnap' | string;
  vatSourceBundle: {
    moduleFormat: 'endoZipBase64' | string;
    endoZipBase64Sha512: string;
    endoZipBase64: string;
  };
  time: number;
  monotime: number;
};

/**
 * A simplified subset of CreateVatLogEntry.
 * Vat is used for tracking only the basic metadata needed for UI or internal state.
 */
export type Vat = {
  vatID: string;
  name: string;
  time: number;
};
