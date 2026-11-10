export const departmentCodes = [
  "techdept",
  "clinic",
  "digimedia",
  "techsvc",
] as const;

export type Department = (typeof departmentCodes)[number];

export const departments = {
  techdept: "技术部",
  clinic: "电脑诊所",
  digimedia: "数字媒体中心",
  techsvc: "技术保障中心",
} as const satisfies Record<Department, string>;
export const activeOrganizationRole = "bitnp-active";
export const systemAdministratorRole = "permission-system-admin";
export const supportGroupNames = ["master", "management"] as const;

export const memberRole = (department: Department) =>
  `position-${department}-member`;

const positionLabels = {
  "position-association-chair": "主席",
  "position-association-vice-chair": "副主席",
  "position-association-vice-chair-techdept": "分管技术部副主席",
  "position-association-vice-chair-clinic": "分管电脑诊所副主席",
  "position-association-vice-chair-digimedia": "分管数字媒体中心副主席",
  "position-techdept-member": "技术部成员",
  "position-techdept-head": "技术部部长",
  "position-techdept-deputy-head": "技术部副部长",
  "position-techdept-advisor": "技术部顾问",
  "position-clinic-member": "电脑诊所成员",
  "position-clinic-head": "电脑诊所部长",
  "position-clinic-deputy-head": "电脑诊所副部长",
  "position-clinic-advisor": "电脑诊所顾问",
  "position-digimedia-member": "数字媒体中心成员",
  "position-digimedia-head": "数字媒体中心部长",
  "position-digimedia-deputy-head": "数字媒体中心副部长",
  "position-digimedia-advisor": "数字媒体中心顾问",
  "position-techsvc-member": "技术保障中心成员",
  "position-techsvc-director": "技术保障中心主任",
  "position-techsvc-deputy-director": "技术保障中心副主任",
} as const;

type PositionRole = keyof typeof positionLabels;

export type AppointmentRole = Exclude<
  PositionRole,
  `${string}-member` | "position-association-vice-chair"
>;

const isPositionLabel = (name: string): name is keyof typeof positionLabels =>
  Object.hasOwn(positionLabels, name);

/**
 * The generic vice-chair role is only the composite parent of the
 * portfolio-specific vice-chair roles, not a separately managed appointment.
 */
export const isCurrentPositionRole = (name: string): name is PositionRole =>
  isPositionLabel(name) && name !== "position-association-vice-chair";

const isAppointmentRole = (name: string): name is AppointmentRole =>
  isPositionLabel(name) &&
  name !== "position-association-vice-chair" &&
  !name.endsWith("-member");

export const appointmentRoles =
  Object.keys(positionLabels).filter(isAppointmentRole);

export function roleLabel(name: string) {
  if (isPositionLabel(name)) {
    return positionLabels[name];
  }

  if (name === activeOrganizationRole) {
    return "网协现任";
  }

  if (name === systemAdministratorRole) {
    return "系统管理";
  }

  for (const department of departmentCodes) {
    const label = departments[department];

    if (name === `permission-${department}-admin`) {
      return `${label}管理`;
    }

    if (name === `permission-${department}-access`) {
      return `${label}访问`;
    }
  }

  return name;
}

export const roleSourceLabel = (role: string, groupId: string | null) =>
  groupId === null && role === systemAdministratorRole
    ? "个人特批"
    : roleLabel(role);

export const managedDepartmentCodes = (roles: ReadonlySet<string>) =>
  departmentCodes.filter(
    (code) =>
      roles.has(systemAdministratorRole) ||
      roles.has(`permission-${code}-admin`),
  );
