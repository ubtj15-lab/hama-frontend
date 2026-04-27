export type PlaceCategory = "food" | "cafe" | "beauty" | "activity" | "course" | "default";

export const categoryImages: Record<PlaceCategory, string[]> = {
  food: [
    "/images/category/food-1.jpg",
    "/images/category/food-2.jpg",
    "/images/category/food-3.jpg",
    "/images/category/food-4.jpg",
    "/images/category/food-5.jpg",
  ],
  cafe: [
    "/images/category/cafe-1.jpg",
    "/images/category/cafe-2.jpg",
    "/images/category/cafe-3.jpg",
    "/images/category/cafe-4.jpg",
    "/images/category/cafe-5.jpg",
  ],
  beauty: [
    "/images/category/beauty-1.jpg",
    "/images/category/beauty-2.jpg",
    "/images/category/beauty-3.jpg",
    "/images/category/beauty-4.jpg",
    "/images/category/beauty-5.jpg",
  ],
  activity: [
    "/images/category/activity-1.jpg",
    "/images/category/activity-2.jpg",
    "/images/category/activity-3.jpg",
    "/images/category/activity-4.jpg",
    "/images/category/activity-5.jpg",
  ],
  course: [
    "/images/category/course-1.jpg",
    "/images/category/course-2.jpg",
    "/images/category/course-3.jpg",
    "/images/category/course-4.jpg",
    "/images/category/course-5.jpg",
  ],
  default: ["/images/category/default-1.jpg", "/images/category/default-2.jpg", "/images/category/default-3.jpg"],
};

export function normalizeCategory(category?: string): PlaceCategory {
  if (!category) return "default";

  const value = category.toLowerCase();

  if (
    value.includes("food") ||
    value.includes("restaurant") ||
    value.includes("식당") ||
    value.includes("푸드") ||
    value.includes("한식") ||
    value.includes("중식") ||
    value.includes("일식") ||
    value.includes("양식")
  ) {
    return "food";
  }

  if (
    value.includes("cafe") ||
    value.includes("coffee") ||
    value.includes("카페") ||
    value.includes("커피") ||
    value.includes("디저트")
  ) {
    return "cafe";
  }

  if (
    value.includes("beauty") ||
    value.includes("hair") ||
    value.includes("nail") ||
    value.includes("salon") ||
    value.includes("미용") ||
    value.includes("헤어") ||
    value.includes("네일")
  ) {
    return "beauty";
  }

  if (
    value.includes("activity") ||
    value.includes("park") ||
    value.includes("museum") ||
    value.includes("액티비티") ||
    value.includes("공원") ||
    value.includes("박물관") ||
    value.includes("전시") ||
    value.includes("체험")
  ) {
    return "activity";
  }

  if (value.includes("course") || value.includes("코스") || value.includes("묶음")) {
    return "course";
  }

  return "default";
}

export function getCategoryImage(category?: string, seed?: string | number): string {
  const normalized = normalizeCategory(category);
  const images = categoryImages[normalized] || categoryImages.default;

  if (!seed) {
    return images[Math.floor(Math.random() * images.length)] ?? categoryImages.default[0];
  }

  const seedString = String(seed);
  let hash = 0;

  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % images.length;
  return images[index] ?? categoryImages.default[0];
}
