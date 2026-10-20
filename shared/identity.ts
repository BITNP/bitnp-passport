export const departments = {
  techdept: "技术部",
  clinic: "电脑诊所",
  digimedia: "数字媒体中心",
  techsvc: "技术保障中心",
} as const;

export type Department = keyof typeof departments;
export const departmentCodes = Object.keys(
  departments,
) as readonly Department[];
export const systemAdministratorRole = "permission-system-admin";

export const memberRole = (department: Department) =>
  `position-${department}-member`;

export const positionLabels = {
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

/**
 * The generic vice-chair role is only the composite parent of the
 * portfolio-specific vice-chair roles, not a separately managed appointment.
 */
export const isCurrentPositionRole = (name: string) =>
  name.startsWith("position-") && name !== "position-association-vice-chair";

export const appointmentRoles = Object.keys(positionLabels).filter(
  (role) => !role.endsWith("-member") && isCurrentPositionRole(role),
);

export function roleLabel(name: string) {
  if (name in positionLabels) {
    return positionLabels[name as keyof typeof positionLabels];
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
