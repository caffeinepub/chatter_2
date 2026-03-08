import { Button } from "@/components/ui/button";
import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AudioMessageProps {
  audio: Uint8Array;
  isSent: boolean;
}

export function AudioMessage({ audio, isSent }: AudioMessageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const blob = new Blob([audio.buffer as ArrayBuffer], {
      type: "audio/webm",
    });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audio]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[180px] max-w-[240px]">
      {blobUrl && (
        // biome-ignore lint/a11y/useMediaCaption: audio message playback, captions not applicable
        <audio
          ref={audioRef}
          src={blobUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className={`h-8 w-8 shrink-0 rounded-full transition-all ${
          isSent
            ? "bg-black/20 hover:bg-black/30 text-white"
            : "bg-primary/20 hover:bg-primary/30 text-primary"
        }`}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        {/* Waveform-like progress bar */}
        <div
          role="slider"
          aria-label="Audio progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          className={`relative h-1.5 rounded-full overflow-hidden cursor-pointer ${
            isSent ? "bg-black/25" : "bg-muted"
          }`}
          onClick={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;
            el.currentTime = ratio * duration;
          }}
          onKeyDown={(e) => {
            const el = audioRef.current;
            if (!el || !duration) return;
            if (e.key === "ArrowRight")
              el.currentTime = Math.min(el.currentTime + 5, duration);
            if (e.key === "ArrowLeft")
              el.currentTime = Math.max(el.currentTime - 5, 0);
          }}
        >
          <div
            className={`h-full rounded-full transition-all duration-100 ${
              isSent ? "bg-white/80" : "bg-primary"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className={`flex items-center justify-between mt-1 text-[10px] font-body ${
            isSent ? "text-white/70" : "text-muted-foreground"
          }`}
        >
          <Volume2 className="h-2.5 w-2.5" />
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
