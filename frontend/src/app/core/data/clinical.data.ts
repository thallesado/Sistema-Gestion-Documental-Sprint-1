import { Patient } from './data.types';

import { patientsGroupA } from './patients-group-a.data';
import { patientsGroupB } from './patients-group-b.data';
import { patientsGroupC } from './patients-group-c.data';

export const patients: Patient[] = [
  ...patientsGroupA,
  ...patientsGroupB,
  ...patientsGroupC
];
