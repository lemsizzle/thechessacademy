import { fetchUserRatings } from "@/lib/lichess/fetchUserRatings";

export async function syncRatings(studentId: string, username: string) {
  return fetchUserRatings(studentId, username);
}
