import { useLocalSearchParams } from "expo-router";
import { ArchiveDetail } from "../../../src/screens/ArchiveScreens";

export default function ArchiveDetailRoute() {
  const { quarterId } = useLocalSearchParams<{ quarterId: string }>();
  return <ArchiveDetail quarterId={String(quarterId ?? "")} />;
}
