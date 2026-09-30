import { Patient } from './data.types';

import { patientsGroupC2b1 } from './patients-group-c2b1.data';
import { patientsGroupC2b2 } from './patients-group-c2b2.data';

export const patientsGroupC2b: Patient[] = [
  ...patientsGroupC2b1,
  ...patientsGroupC2b2,
];
