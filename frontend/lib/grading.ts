const BANDS = [
  { min: 70, grade: "A", remark: "Excellent" },
  { min: 60, grade: "B", remark: "Very Good" },
  { min: 50, grade: "C", remark: "Good" },
  { min: 45, grade: "D", remark: "Fair" },
  { min: 40, grade: "E", remark: "Pass" },
  { min: 0, grade: "F", remark: "Fail" },
];

export function clamp(value: number | string, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(max, Math.round(numeric)));
}

export function total(ca1: number | string, ca2: number | string, exam: number | string): number {
  return clamp(ca1, 20) + clamp(ca2, 20) + clamp(exam, 60);
}

export function gradeFor(score: number): string {
  return BANDS.find((band) => score >= band.min)?.grade || "F";
}

export function remarkFor(score: number): string {
  return BANDS.find((band) => score >= band.min)?.remark || "Fail";
}

export function gradeTone(grade: string): "green" | "blue" | "amber" | "red" | "gray" {
  if (grade === "A" || grade === "B") return "green";
  if (grade === "C") return "blue";
  if (grade === "D" || grade === "E") return "amber";
  if (grade === "F") return "red";
  return "gray";
}
