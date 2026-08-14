const englishErrors: Record<string, string> = {
  auth_required: "Sign in to continue.",
  body_too_large: "The request is too large.",
  chat_capacity:
    "This chat reached its message limit. Continue through a trusted channel.",
  chat_not_open: "Chat opens after the connection request is accepted.",
  comment_capacity: "This discussion reached its comment limit.",
  comments_closed: "This discussion is closed because the post was resolved.",
  content_type: "JSON content is required.",
  edge_rate_limited: "Too many requests. Wait a moment before continuing.",
  geocode_busy: "Address search is busy. Wait two seconds and try again.",
  geocode_failed:
    "The address could not be found. Choose the point directly on the map.",
  daily_report_limit: "You reached the daily post limit. Try again tomorrow.",
  internal_error: "We could not complete the request. Try again.",
  invalid_credentials: "The access code does not match.",
  invalid_field: "Check the submitted fields and try again.",
  invalid_json: "The JSON content is invalid.",
  invalid_location: "Choose a valid location in Colombia.",
  location_outside_city:
    "The location must be inside the selected city or region.",
  invalid_recovery_code: "The access code is invalid.",
  message_not_saved: "The message could not be saved.",
  not_allowed: "You are not allowed to perform this action.",
  not_found: "Route not found.",
  offer_closed: "This connection request has already been updated.",
  offer_capacity: "This post already has enough active connection requests.",
  offer_exists: "You already sent an active connection request for this post.",
  offer_not_found: "The connection request was not found.",
  origin_rejected: "The request origin is not allowed.",
  post_not_confirmable: "Only community need posts can be confirmed.",
  public_contact_info:
    "Do not post phone numbers or email addresses. Coordinate through private messages.",
  rate_limited: "Too many attempts. Wait a moment before continuing.",
  report_not_found: "The community post was not found.",
  report_resolved: "This community post is already closed.",
  security_check_failed: "The security check expired or was invalid. Try again.",
  security_check_required: "Complete the security check to continue.",
  security_check_unavailable: "The security check is unavailable. Try again.",
  self_confirmation: "You cannot confirm your own post.",
  self_flag: "You cannot report your own post.",
  self_offer: "You cannot send a connection request to yourself.",
  too_many_open_reports: "Update or close one of your posts before creating another."
};

function wantsEnglish(request: Request): boolean {
  const selected = request.headers.get("x-pulso-language");
  if (selected === "en") return true;
  if (selected === "es") return false;
  return (request.headers.get("accept-language") ?? "").toLowerCase().startsWith("en");
}

export function localizedError(request: Request, code: string, spanishFallback: string): string {
  return wantsEnglish(request) ? englishErrors[code] ?? "Something went wrong. Try again." : spanishFallback;
}
