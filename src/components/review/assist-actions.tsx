import { BookOpen, MessageSquareText, Sparkles, Wand2 } from "lucide-react";
import type { AssistAction } from "@/lib/assist-protocol";

export const ASSIST_ACTION_BUTTONS: {
  action: AssistAction;
  label: string;
  icon: React.ReactNode;
}[] = [
  { action: "explain", label: "Explain", icon: <BookOpen /> },
  { action: "simplify", label: "Simplify", icon: <Wand2 /> },
  { action: "comment", label: "Comment", icon: <MessageSquareText /> },
  { action: "ask", label: "Ask", icon: <Sparkles /> },
];
