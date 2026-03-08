import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials, usernameToHue } from "@/utils/formatters";

interface UserAvatarProps {
  username: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function UserAvatar({
  username,
  size = "md",
  className,
}: UserAvatarProps) {
  const hue = usernameToHue(username);
  const initials = getInitials(username) || username[0]?.toUpperCase() || "?";

  return (
    <Avatar className={cn(sizeMap[size], className)}>
      <AvatarFallback
        style={{
          background: `oklch(0.45 0.14 ${hue})`,
          color: "oklch(0.95 0.01 255)",
          fontFamily: "var(--font-display, 'Bricolage Grotesque')",
          fontWeight: "700",
        }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
