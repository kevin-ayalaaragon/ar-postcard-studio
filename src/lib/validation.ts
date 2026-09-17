import { z } from "zod";

export const submitPostcardSchema = z.object({
  senderName: z.string().trim().min(1, "Your name is required").max(80),
  recipientName: z.string().trim().min(1, "Recipient's name is required").max(80),
  message: z.string().trim().min(1, "Message is required").max(500),
});

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // 15MB
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const ACCEPTED_VIDEO_TYPES = ["video/mp4"];
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_MIND_BYTES = 20 * 1024 * 1024; // 20MB
