import type { CoursePlan } from "@/lib/scenarioEngine/types";

const KEY = (id: string) => `hama_course_${id}`;

export function stashCoursePlan(plan: CoursePlan): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY(plan.id), JSON.stringify(plan));
  } catch {}
}

export function readCoursePlanFromSession(id: string): CoursePlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY(id));
    if (!raw) return null;
    return JSON.parse(raw) as CoursePlan;
  } catch {
    return null;
  }
}
