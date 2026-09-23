import { useContext } from "react";
import { AnnouncerContext, type Announce } from "../components/announcer-context";

export function useAnnounce(): Announce {
  return useContext(AnnouncerContext);
}
