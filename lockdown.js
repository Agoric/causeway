import 'ses';

const options = {
  overrideTaming: 'severe',
  stackFiltering: 'verbose',
  errorTaming: 'unsafe',
};

lockdown(options);
