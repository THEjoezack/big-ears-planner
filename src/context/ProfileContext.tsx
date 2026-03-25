import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  type ProfileEntry,
  ensureProfileRegistry,
  readActiveProfileId,
  writeActiveProfileId,
} from "@/lib/profiles";

type ProfileContextValue = {
  profiles: ProfileEntry[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  refreshProfiles: () => void;
  friendProfiles: ProfileEntry[];
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  festivalId,
  children,
}: {
  festivalId: string;
  children: ReactNode;
}) {
  const [profiles, setProfiles] = useState<ProfileEntry[]>(() =>
    ensureProfileRegistry(festivalId)
  );
  const [activeProfileId, setActiveState] = useState(() =>
    readActiveProfileId(festivalId)
  );

  useEffect(() => {
    const list = ensureProfileRegistry(festivalId);
    setProfiles(list);
    const active = readActiveProfileId(festivalId);
    if (!list.some((p) => p.id === active)) {
      writeActiveProfileId(festivalId, "default");
      setActiveState("default");
    } else {
      setActiveState(active);
    }
  }, [festivalId]);

  const refreshProfiles = useCallback(() => {
    setProfiles(ensureProfileRegistry(festivalId));
  }, [festivalId]);

  const setActiveProfileId = useCallback(
    (id: string) => {
      writeActiveProfileId(festivalId, id);
      setActiveState(id);
    },
    [festivalId]
  );

  const friendProfiles = useMemo(
    () => profiles.filter((p) => p.id !== activeProfileId),
    [profiles, activeProfileId]
  );

  const value = useMemo(
    () => ({
      profiles,
      activeProfileId,
      setActiveProfileId,
      refreshProfiles,
      friendProfiles,
    }),
    [
      profiles,
      activeProfileId,
      setActiveProfileId,
      refreshProfiles,
      friendProfiles,
    ]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfileContext must be used within ProfileProvider");
  }
  return ctx;
}
