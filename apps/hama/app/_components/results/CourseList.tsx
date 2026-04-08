"use client";

import React from "react";
import type { CoursePlan } from "@/lib/scenarioEngine/types";
import { CourseCard } from "./CourseCard";
import { space } from "@/lib/designTokens";

type Props = {
  plans: CoursePlan[];
  logExtras: Record<string, unknown>;
  onCta: (plan: CoursePlan) => void;
  onCardOpen: (plan: CoursePlan) => void;
};

export function CourseList({ plans, logExtras, onCta, onCardOpen }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.section }}>
      {plans.slice(0, 3).map((plan) => (
        <CourseCard key={plan.id} plan={plan} logExtras={logExtras} onCta={onCta} onCardOpen={onCardOpen} />
      ))}
    </div>
  );
}
