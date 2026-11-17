import { Patient } from './data.types';

import { patientsGroupC1 } from './patients-group-c1.data';
import { patientsGroupC2 } from './patients-group-c2.data';

export const patientsGroupC: Patient[] = [
  ...patientsGroupC1,
  ...patientsGroupC2,
];
