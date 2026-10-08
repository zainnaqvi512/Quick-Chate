export type UsernameDiscovery = "everyone" | "friends_of_friends" | "nobody";
export function canDiscoverUsername(
  mode: UsernameDiscovery,
  mutualContact: boolean,
  mutualFriend: boolean
) {
  return (
    mutualContact ||
    mode === "everyone" ||
    (mode === "friends_of_friends" && mutualFriend)
  );
}
