/**
 * Map prediction level/percentage to feedback messages (Section 6c).
 */

export type PredictionLevel = "Low" | "Medium" | "High";

export function getMessageForLevel(level: PredictionLevel, _percentage?: number): string {
  switch (level) {
    case "Low":
      return "Your results indicate a high level of commitment and consistency. Keep up the excellent work.";
    case "Medium":
      return "You have assignments approaching soon; consider starting early.";
    case "High":
      return "Your procrastination risk is high. Immediate action is recommended to avoid academic penalties.";
    default:
      return "Review your tasks and deadlines to stay on track.";
  }
}

/** Returns [firstLine, secondLine] for dashboard motivational boxes (e.g. Low = two lines). */
export function getMessageLines(level: PredictionLevel): [string, string | null] {
  switch (level) {
    case "Low":
      return [
        "Your results indicate a high level of commitment and consistency.",
        "Keep up the excellent work",
      ];
    case "Medium":
      return ["You have assignments approaching soon; consider starting early.", null];
    case "High":
      return ["Your procrastination risk is high. Immediate action is recommended to avoid academic penalties.", null];
    default:
      return ["Review your tasks and deadlines to stay on track.", null];
  }
}
