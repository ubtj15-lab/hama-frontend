/**
 * Central event_name strings for hama_events. Wire UI in follow-up PRs as needed.
 */
export const HamaEventNames = {
  recommendationImpression: "recommendation_impression",
  recommendationClick: "recommendation_click",
  directionsClick: "directions_click",
  choosePlace: "choose_place",
  loginRequiredAction: "login_required_action",
  receiptVerifyClick: "receipt_verify_click",
  visitFeedbackSubmit: "visit_feedback_submit",
  recommendationHelpfulFeedback: "recommendation_helpful_feedback",
} as const;
