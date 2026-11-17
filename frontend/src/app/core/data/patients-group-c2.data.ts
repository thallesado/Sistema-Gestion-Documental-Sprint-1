import { Patient } from './data.types';

import { patientsGroupC2a } from './patients-group-c2a.data';
import { patientsGroupC2b } from './patients-group-c2b.data';

export const patientsGroupC2: Patient[] = [
  ...patientsGroupC2a,
  ...patientsGroupC2b,
];
