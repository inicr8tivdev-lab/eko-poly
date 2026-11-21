import { tokenOf, type Player } from "@/game/engine";
import { isImageAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { PLAYER_BG } from "./styles";

interface AvatarCircleProps {
  seatIndex: number;
  avatar?: string | null | undefined;
  name?: string | undefined;
  token?: number | undefined;
  className?: string | undefined;
  emojiClassName?: string | undefined;
  style?: React.CSSProperties | undefined;
  title?: string | undefined;
}

export function AvatarCircle({
  seatIndex,
  avatar,
  name,
  token,
  className,
  emojiClassName,
  style,
  title,
}: AvatarCircleProps) {
  const tokenIdx = token ?? seatIndex;
  const hasPhoto = isImageAvatar(avatar);
  const symbol = !hasPhoto && avatar ? avatar : tokenOf(tokenIdx).emoji;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        PLAYER_BG[seatIndex],
        className,
      )}
      style={style}
      title={title}
    >
      {hasPhoto ? (
        <img
          src={avatar}
          alt={name ? `${name}'s avatar` : "Player avatar"}
          className="size-full rounded-full object-cover"
        />
      ) : (
        <span className={cn("leading-none", emojiClassName)}>{symbol}</span>
      )}
    </span>
  );
}

export function PlayerAvatar({
  player,
  seatIndex,
  className,
  emojiClassName,
  style,
  title,
}: {
  player: Pick<Player, "name" | "token" | "avatar">;
  seatIndex: number;
  className?: string | undefined;
  emojiClassName?: string | undefined;
  style?: React.CSSProperties | undefined;
  title?: string | undefined;
}) {
  return (
    <AvatarCircle
      seatIndex={seatIndex}
      avatar={player.avatar}
      name={player.name}
      token={player.token}
      className={className}
      emojiClassName={emojiClassName}
      style={style}
      title={title ?? player.name}
    />
  );
}
