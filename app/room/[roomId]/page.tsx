import GameRoom from "@/components/GameRoom";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <GameRoom roomId={roomId} />;
}
