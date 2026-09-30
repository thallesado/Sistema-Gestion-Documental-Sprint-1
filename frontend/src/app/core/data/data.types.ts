export type Role =
  | 'Usuario basico'
  | 'Supervisor'
  | 'Administrador de tenant'
  | 'Superadministrador';

export type NavChild = { label: string; href: string; visible?: boolean; sprintEnabled?: boolean };
export type NavItem = { label: string; icon: string; children: NavChild[]; roles?: Role[]; sprintEnabled?: boolean };
export type NavSection = { title: string; items: NavItem[] };
export type RouteInfo = { module: string; subcategory: string; href: string };
export type ScreenCopy = { description: string; action: string };
export type DemoItem = {
  title: string;
  meta: string;
  date: string;
  status: string;
  area?: string;
  createdAt?: string;
  type?: string;
};

export type ClinicalEvent = {
  date: string;
  type: string;
  title: string;
  description: string;
  doctor: string;
  status: string;
};

export type Patient = {
  id: number;
  name: string;
  documentId: string;
  birthDate: string;
  gender: string;
  bloodType: string;
  phone: string;
  email: string;
  address: string;
  insuranceProvider: string;
  pdfFile: string;
  events: ClinicalEvent[];
};
