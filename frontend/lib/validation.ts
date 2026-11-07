export const PASSWORD_POLICY =
  "At least 8 characters with an uppercase letter, lowercase letter, number, and special character.";

export function isStrongPassword(value: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

export function passwordChecks(value: string) {
  return [
    { label: "8+ characters", met: value.length >= 8 },
    { label: "Uppercase", met: /[A-Z]/.test(value) },
    { label: "Lowercase", met: /[a-z]/.test(value) },
    { label: "Number", met: /\d/.test(value) },
    { label: "Symbol", met: /[^A-Za-z0-9]/.test(value) },
  ];
}
