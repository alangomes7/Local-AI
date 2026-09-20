'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Download } from 'lucide-react';

export interface VoiceNotePlayerProps {
  url: string;
  duration?: number;
  fileName?: string;
}

export default function VoiceNotePlayer({
  url,
  duration: initialDuration = 0,
  fileName = 'voice-message.webm',
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (
        audio.duration &&
        !isNaN(audio.duration) &&
        isFinite(audio.duration)
      ) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const handleSeek = (index: number, total: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const targetTime = (index / total) * duration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextRate: 1 | 1.5 | 2 =
      playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // WhatsApp-style sound waveform pattern
  const barHeights = [
    30, 45, 70, 95, 60, 40, 80, 100, 75, 50, 85, 65, 35, 90, 70, 45, 60, 85,
    100, 70, 40, 60, 80, 50, 30, 65, 90, 45, 25,
  ];

  const progressPercent = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-700/50 text-emerald-100 max-w-sm sm:max-w-md shadow-md shadow-emerald-950/20">
      <audio ref={audioRef} src={url} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Avatar with Mic badge */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-emerald-700/60 border border-emerald-500/50 flex items-center justify-center text-white font-bold text-xs shadow-inner">
            <Mic className="w-5 h-5 text-emerald-200" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border border-neutral-900 flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
          </span>
        </div>

        {/* Play / Pause button */}
        <button
          type="button"
          onClick={togglePlay}
          className="shrink-0 w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 flex items-center justify-center transition shadow-md cursor-pointer"
          title={isPlaying ? 'Pause voice message' : 'Play voice message'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform Scrubber */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-[2.5px] h-7 cursor-pointer select-none">
            {barHeights.map((h, i) => {
              const barFraction = i / barHeights.length;
              const isPlayed = barFraction <= progressPercent;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSeek(i, barHeights.length)}
                  className="flex-1 h-full flex items-center justify-center group focus:outline-none"
                  title={`Seek to ${formatTime((i / barHeights.length) * duration)}`}
                >
                  <span
                    className={`w-full rounded-full transition-all duration-100 ${
                      isPlayed
                        ? 'bg-emerald-400 group-hover:bg-emerald-300'
                        : 'bg-emerald-900/80 group-hover:bg-emerald-700'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                </button>
              );
            })}
          </div>

          {/* Time & Speed Controls */}
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300/80 px-0.5">
            <span>{formatTime(currentTime > 0 ? currentTime : duration)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 transition"
                title="Change playback speed"
              >
                {playbackRate}x
              </button>
              <a
                href={url}
                download={fileName}
                className="hover:text-emerald-100 transition"
                title="Download audio"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
