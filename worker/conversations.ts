export type ConversationPostType = "need" | "offer" | "update";
export type ConversationStatus = "pending" | "accepted" | "declined" | "withdrawn";

export function initialConversationStatus(
  postType: ConversationPostType
): Extract<ConversationStatus, "pending" | "accepted"> {
  return postType === "need" ? "pending" : "accepted";
}

export function canOpenConversation(
  status: ConversationStatus,
  postType: ConversationPostType
): boolean {
  return status === "accepted" || (status === "pending" && postType !== "need");
}
